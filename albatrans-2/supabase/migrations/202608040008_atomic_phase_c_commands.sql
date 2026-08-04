-- Fase C: comando transaccional, locking e idempotencia. Aditiva y forward-only.
create table public.transport_command_idempotency (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  result jsonb null check (result is null or jsonb_typeof(result)='object'),
  actor_user_id uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  primary key (organization_id,idempotency_key)
);
create index transport_command_idempotency_created_idx on public.transport_command_idempotency(created_at);
alter table public.transport_command_idempotency enable row level security;
alter table public.transport_command_idempotency force row level security;
revoke all on table public.transport_command_idempotency from public,anon,authenticated;
grant all on table public.transport_command_idempotency to service_role;

create function public.execute_transport_operation(
  p_actor_user_id uuid,
  p_actor_scope public.audit_actor_scope,
  p_organization_id uuid,
  p_transport_order_id uuid,
  p_resource text,
  p_action text,
  p_entity_id uuid,
  p_target_status text,
  p_values jsonb,
  p_reason text,
  p_correlation_id uuid,
  p_idempotency_key uuid
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_request jsonb;
  v_hash text;
  v_existing public.transport_command_idempotency%rowtype;
  v_order public.transport_orders%rowtype;
  v_execution public.transport_executions%rowtype;
  v_incident public.transport_incidents%rowtype;
  v_note public.transport_notes%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
  v_entity_id uuid;
  v_execution_id uuid;
  v_event_type text;
  v_notification_title text;
  v_status text;
  v_waiting_event boolean := false;
begin
  if p_actor_user_id is null or p_organization_id is null or p_transport_order_id is null or p_correlation_id is null or p_idempotency_key is null then
    raise exception using errcode='22023',message='required command context is missing';
  end if;
  if p_resource not in ('execution','incident','note') or p_action not in ('start','transition','create','update','archive') then
    raise exception using errcode='22023',message='unsupported operational command';
  end if;
  if p_values is null or jsonb_typeof(p_values)<>'object' then raise exception using errcode='22023',message='values must be an object'; end if;
  if not exists(select 1 from public.profiles where user_id=p_actor_user_id and status='active') then raise exception using errcode='42501',message='actor profile is inactive'; end if;
  if p_actor_scope='platform' then
    if not exists(select 1 from public.platform_admins where user_id=p_actor_user_id and role='superadmin' and status='active') then raise exception using errcode='42501',message='platform actor is not authorized'; end if;
  elsif p_actor_scope='organization' then
    if not exists(select 1 from public.organizations where id=p_organization_id and status='active') or
       not exists(select 1 from public.organization_memberships where organization_id=p_organization_id and user_id=p_actor_user_id and role='admin_empresa' and status='active') then
      raise exception using errcode='42501',message='organization actor is not authorized';
    end if;
    if not coalesce(
      (select case omo.override_mode when 'enabled' then true when 'disabled' then false else null end from public.organization_module_overrides omo join public.modules m on m.id=omo.module_id where omo.organization_id=p_organization_id and m.code='transport_execution'),
      (select pm.enabled from public.organization_subscriptions os join public.plan_modules pm on pm.plan_id=os.plan_id join public.modules m on m.id=pm.module_id where os.organization_id=p_organization_id and m.code='transport_execution'),false
    ) then raise exception using errcode='42501',message='transport_execution module is disabled'; end if;
  else raise exception using errcode='42501',message='system scope is not accepted'; end if;

  select * into v_order from public.transport_orders where id=p_transport_order_id for update;
  if not found or v_order.organization_id<>p_organization_id then raise exception using errcode='P0002',message='transport order not found in organization'; end if;
  v_request:=jsonb_build_object('actor',p_actor_user_id,'scope',p_actor_scope,'organization',p_organization_id,'order',p_transport_order_id,'resource',p_resource,'action',p_action,'entity',p_entity_id,'target',p_target_status,'values',p_values,'reason',nullif(btrim(p_reason),''));
  v_hash:=encode(extensions.digest(convert_to(v_request::text,'UTF8'),'sha256'),'hex');
  insert into public.transport_command_idempotency(organization_id,idempotency_key,request_hash,actor_user_id)
  values(p_organization_id,p_idempotency_key,v_hash,p_actor_user_id) on conflict do nothing;
  select * into v_existing from public.transport_command_idempotency where organization_id=p_organization_id and idempotency_key=p_idempotency_key for update;
  if v_existing.request_hash<>v_hash then raise exception using errcode='23505',message='idempotency key was reused with a different payload'; end if;
  if v_existing.result is not null then return v_existing.result; end if;

  if p_resource='execution' then
    if p_action='start' then
      if v_order.status='archived' then raise exception using errcode='23514',message='archived order cannot be executed'; end if;
      insert into public.transport_executions(organization_id,transport_order_id,created_by) values(p_organization_id,p_transport_order_id,p_actor_user_id) returning * into v_execution;
      v_before:=null; v_after:=to_jsonb(v_execution); v_entity_id:=v_execution.id; v_execution_id:=v_execution.id; v_event_type:='execution.started'; v_notification_title:='Ejecución iniciada';
    elsif p_action='transition' and p_target_status is not null then
      select * into v_execution from public.transport_executions where transport_order_id=p_transport_order_id for update;
      if not found then raise exception using errcode='P0002',message='execution not found'; end if;
      v_before:=to_jsonb(v_execution);
      update public.transport_executions set status=p_target_status::public.transport_execution_status where id=v_execution.id returning * into v_execution;
      v_after:=to_jsonb(v_execution); v_entity_id:=v_execution.id; v_execution_id:=v_execution.id;
      v_event_type:=case p_target_status when 'completed' then 'execution.completed' when 'cancelled' then 'execution.cancelled' else 'execution.updated' end;
      v_notification_title:=case p_target_status when 'completed' then 'Orden completada' when 'cancelled' then 'Ejecución cancelada' else 'Estado operativo actualizado' end;
      v_waiting_event:=p_target_status in ('loaded','delivered','completed');
    else raise exception using errcode='22023',message='invalid execution action'; end if;
  elsif p_resource='incident' then
    select * into v_execution from public.transport_executions where transport_order_id=p_transport_order_id for update;
    if not found then raise exception using errcode='23514',message='execution is required'; end if;
    if v_order.status='archived' then raise exception using errcode='23514',message='incidents cannot be registered on archived orders'; end if;
    if p_action='create' then
      if p_values - array['severity','category','title','description'] <> '{}'::jsonb then raise exception using errcode='22023',message='incident payload contains unsupported fields'; end if;
      insert into public.transport_incidents(organization_id,transport_order_id,severity,category,title,description,reported_by)
      values(p_organization_id,p_transport_order_id,coalesce((p_values->>'severity')::public.transport_incident_severity,'normal'),(p_values->>'category')::public.transport_incident_category,btrim(p_values->>'title'),btrim(p_values->>'description'),p_actor_user_id) returning * into v_incident;
      v_before:=null; v_after:=to_jsonb(v_incident); v_entity_id:=v_incident.id; v_execution_id:=v_execution.id; v_event_type:='incident.created'; v_notification_title:='Incidencia creada';
    elsif p_action in ('update','transition','archive') and p_entity_id is not null then
      select * into v_incident from public.transport_incidents where id=p_entity_id for update;
      if not found or v_incident.organization_id<>p_organization_id or v_incident.transport_order_id<>p_transport_order_id then raise exception using errcode='P0002',message='incident not found in transport order'; end if;
      v_before:=to_jsonb(v_incident); v_status:=case when p_action='archive' then 'archived' else coalesce(p_target_status,p_values->>'status',v_incident.status::text) end;
      if not ((v_incident.status='open' and v_status in ('open','in_progress','resolved','archived')) or (v_incident.status='in_progress' and v_status in ('in_progress','resolved','archived')) or (v_incident.status='resolved' and v_status in ('resolved','closed','in_progress','archived')) or (v_incident.status='closed' and v_status in ('closed','archived')) or (v_incident.status='archived' and v_status='archived')) then raise exception using errcode='23514',message='invalid incident transition'; end if;
      update public.transport_incidents set severity=coalesce((p_values->>'severity')::public.transport_incident_severity,severity),category=coalesce((p_values->>'category')::public.transport_incident_category,category),title=coalesce(nullif(btrim(p_values->>'title'),''),title),description=coalesce(nullif(btrim(p_values->>'description'),''),description),resolution_notes=coalesce(p_values->>'resolution_notes',resolution_notes),status=v_status::public.transport_incident_status,resolved_by=case when v_status in('resolved','closed') then coalesce(resolved_by,p_actor_user_id) else resolved_by end,resolved_at=case when v_status in('resolved','closed') then coalesce(resolved_at,statement_timestamp()) else resolved_at end,archived_at=case when v_status='archived' then coalesce(archived_at,statement_timestamp()) else archived_at end where id=v_incident.id returning * into v_incident;
      v_after:=to_jsonb(v_incident); v_entity_id:=v_incident.id; v_execution_id:=v_execution.id; v_event_type:=case when v_status='closed' then 'incident.closed' else 'incident.updated' end; v_notification_title:='Incidencia actualizada';
    else raise exception using errcode='22023',message='invalid incident action'; end if;
  else
    select * into v_execution from public.transport_executions where transport_order_id=p_transport_order_id for update;
    if not found then raise exception using errcode='23514',message='execution is required'; end if;
    if p_action='create' then
      if p_values - array['note_type','body','visible_driver','visible_customer','visible_admin'] <> '{}'::jsonb then raise exception using errcode='22023',message='note payload contains unsupported fields'; end if;
      insert into public.transport_notes(organization_id,transport_order_id,author_user_id,note_type,body,visible_driver,visible_customer,visible_admin)
      values(p_organization_id,p_transport_order_id,p_actor_user_id,coalesce((p_values->>'note_type')::public.transport_note_type,'operational'),btrim(p_values->>'body'),coalesce((p_values->>'visible_driver')::boolean,false),coalesce((p_values->>'visible_customer')::boolean,false),coalesce((p_values->>'visible_admin')::boolean,true)) returning * into v_note;
      v_before:=null; v_after:=to_jsonb(v_note); v_entity_id:=v_note.id; v_execution_id:=v_execution.id; v_event_type:='note.created'; v_notification_title:='Nueva nota';
    elsif p_action in ('update','archive') and p_entity_id is not null then
      select * into v_note from public.transport_notes where id=p_entity_id for update;
      if not found or v_note.organization_id<>p_organization_id or v_note.transport_order_id<>p_transport_order_id then raise exception using errcode='P0002',message='note not found in transport order'; end if;
      if v_note.archived_at is not null then raise exception using errcode='23514',message='archived note is immutable'; end if;
      v_before:=to_jsonb(v_note);
      update public.transport_notes set note_type=coalesce((p_values->>'note_type')::public.transport_note_type,note_type),body=coalesce(nullif(btrim(p_values->>'body'),''),body),visible_driver=coalesce((p_values->>'visible_driver')::boolean,visible_driver),visible_customer=coalesce((p_values->>'visible_customer')::boolean,visible_customer),visible_admin=coalesce((p_values->>'visible_admin')::boolean,visible_admin),archived_at=case when p_action='archive' then statement_timestamp() else archived_at end where id=v_note.id returning * into v_note;
      v_after:=to_jsonb(v_note); v_entity_id:=v_note.id; v_execution_id:=v_execution.id; v_event_type:='note.updated'; v_notification_title:=case when p_action='archive' then 'Nota archivada' else 'Nota actualizada' end;
    else raise exception using errcode='22023',message='invalid note action'; end if;
  end if;

  insert into public.transport_events(organization_id,transport_order_id,event_type,actor_user_id,entity_type,entity_id,payload,correlation_id)
  values(p_organization_id,p_transport_order_id,v_event_type,p_actor_user_id,p_resource,v_entity_id,jsonb_build_object('before',v_before,'after',v_after,'reason',nullif(btrim(p_reason),'')),p_correlation_id);
  insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,before_data,after_data,reason,correlation_id)
  values(p_organization_id,p_actor_user_id,p_actor_scope,v_event_type,'transport_'||p_resource,v_entity_id::text,v_before,v_after,nullif(btrim(p_reason),''),p_correlation_id);
  insert into public.internal_notifications(organization_id,transport_order_id,event_type,title,payload)
  values(p_organization_id,p_transport_order_id,v_event_type,v_notification_title,jsonb_build_object('entityId',v_entity_id));
  if v_waiting_event then
    insert into public.transport_events(organization_id,transport_order_id,event_type,actor_user_id,entity_type,entity_id,payload,correlation_id)
    values(p_organization_id,p_transport_order_id,'waiting_time.calculated',p_actor_user_id,'execution',v_execution_id,jsonb_build_object('status',p_target_status),p_correlation_id);
    insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,before_data,after_data,correlation_id)
    values(p_organization_id,p_actor_user_id,p_actor_scope,'waiting_time.calculated','transport_execution',v_execution_id::text,null,jsonb_build_object('status',p_target_status),p_correlation_id);
  end if;
  v_result:=jsonb_build_object('executionId',v_execution_id,'entityId',v_entity_id,'eventType',v_event_type,'correlationId',p_correlation_id,'idempotencyKey',p_idempotency_key);
  update public.transport_command_idempotency set result=v_result,completed_at=statement_timestamp() where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
  return v_result;
end $$;

revoke all on function public.execute_transport_operation(uuid,public.audit_actor_scope,uuid,uuid,text,text,uuid,text,jsonb,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.execute_transport_operation(uuid,public.audit_actor_scope,uuid,uuid,text,text,uuid,text,jsonb,text,uuid,uuid) to service_role;
comment on function public.execute_transport_operation(uuid,public.audit_actor_scope,uuid,uuid,text,text,uuid,text,jsonb,text,uuid,uuid) is 'Comando atómico e idempotente de Fase C. Solo backend service_role tras validar JWT.';
comment on table public.transport_command_idempotency is 'Resultados inmutables por tenant y key para comandos operativos atómicos.';
