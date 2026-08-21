-- Phase I additive fix: active signatures are represented by revoked_at is null.
create or replace function public.execute_driver_transport_operation(
  p_actor uuid,p_org uuid,p_order uuid,p_resource text,p_target text,p_values jsonb,p_correlation uuid,p_key uuid
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_order public.transport_orders%rowtype; v_exec public.transport_executions%rowtype;
 v_entity uuid; v_event text; v_before jsonb; v_after jsonb; v_result jsonb; v_hash text; v_existing public.transport_command_idempotency%rowtype;
 v_missing text[]:=array[]::text[]; v_policy public.driver_completion_policies%rowtype;
begin
 if p_actor is null or p_actor<>auth.uid() or p_org is null or p_order is null or p_correlation is null or p_key is null then raise exception using errcode='42501',message='invalid driver command context'; end if;
 if not public.driver_has_order_access(p_order,'transport_execution') then raise exception using errcode='42501',message='transport is not currently assigned to this driver'; end if;
 select * into v_order from public.transport_orders where id=p_order and organization_id=p_org for update;
 if not found then raise exception using errcode='P0002',message='transport not found'; end if;
 select * into v_exec from public.transport_executions where transport_order_id=p_order for update;
 if not found then raise exception using errcode='23514',message='execution must be started by the office'; end if;
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('actor',p_actor,'org',p_org,'order',p_order,'resource',p_resource,'target',p_target,'values',p_values)::text,'UTF8'),'sha256'),'hex');
 insert into public.transport_command_idempotency(organization_id,idempotency_key,request_hash,actor_user_id) values(p_org,p_key,v_hash,p_actor) on conflict do nothing;
 select * into v_existing from public.transport_command_idempotency where organization_id=p_org and idempotency_key=p_key for update;
 if v_existing.request_hash<>v_hash then raise exception using errcode='23505',message='idempotency key reused with another command'; end if;
 if v_existing.result is not null then return v_existing.result; end if;
 if p_resource='execution' then
   if p_target not in ('heading_to_pickup','arrived_pickup','waiting_pickup','loading','loaded','departed_pickup','arrived_delivery','waiting_delivery','unloading','delivered','completed') then raise exception using errcode='22023',message='driver transition is not allowed'; end if;
   if p_target='completed' then
     select * into v_policy from public.driver_completion_policies where organization_id=p_org;
     if coalesce(v_policy.require_pod,false) and not exists(select 1 from public.proofs_of_delivery where transport_order_id=p_order and status in ('captured','confirmed')) then v_missing:=array_append(v_missing,'pod'); end if;
     if coalesce(v_policy.require_signature,false) and not exists(select 1 from public.document_signatures s join public.documents d on d.id=s.document_id where d.transport_order_id=p_order and s.revoked_at is null) then v_missing:=array_append(v_missing,'signature'); end if;
     if coalesce(v_policy.require_document,false) and not exists(select 1 from public.documents where transport_order_id=p_order and status='available') then v_missing:=array_append(v_missing,'document'); end if;
     if cardinality(v_missing)>0 then raise exception using errcode='23514',message='completion requirements missing: '||array_to_string(v_missing,','); end if;
   end if;
   v_before:=to_jsonb(v_exec); update public.transport_executions set status=p_target::public.transport_execution_status where id=v_exec.id returning * into v_exec;
   v_entity:=v_exec.id; v_after:=to_jsonb(v_exec); v_event:=case when p_target='completed' then 'execution.completed' else 'execution.updated' end;
 elsif p_resource='incident' then
   if p_values - array['severity','category','title','description'] <> '{}'::jsonb then raise exception using errcode='22023',message='unsupported incident fields'; end if;
   insert into public.transport_incidents(organization_id,transport_order_id,severity,category,title,description,reported_by) values(p_org,p_order,coalesce((p_values->>'severity')::public.transport_incident_severity,'normal'),(p_values->>'category')::public.transport_incident_category,btrim(p_values->>'title'),btrim(p_values->>'description'),p_actor) returning id,to_jsonb(transport_incidents.*) into v_entity,v_after;
   v_before:=null; v_event:='incident.created';
 elsif p_resource='note' then
   if p_values - array['body'] <> '{}'::jsonb then raise exception using errcode='22023',message='unsupported note fields'; end if;
   insert into public.transport_notes(organization_id,transport_order_id,author_user_id,note_type,body,visible_driver,visible_admin) values(p_org,p_order,p_actor,'driver',btrim(p_values->>'body'),true,true) returning id,to_jsonb(transport_notes.*) into v_entity,v_after;
   v_before:=null; v_event:='note.created';
 else raise exception using errcode='22023',message='unsupported driver resource'; end if;
 insert into public.transport_events(organization_id,transport_order_id,event_type,actor_user_id,entity_type,entity_id,payload,correlation_id) values(p_org,p_order,v_event,p_actor,p_resource,v_entity,jsonb_build_object('before',v_before,'after',v_after,'source','driver_portal'),p_correlation);
 insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,before_data,after_data,correlation_id) values(p_org,p_actor,'organization',v_event,'transport_'||p_resource,v_entity::text,v_before,v_after,p_correlation);
 if v_event in ('incident.created','execution.completed') or p_target in ('arrived_pickup','arrived_delivery') then insert into public.internal_notifications(organization_id,transport_order_id,event_type,title,payload) values(p_org,p_order,v_event,case when v_event='incident.created' then 'Incidencia del conductor' when v_event='execution.completed' then 'Transporte completado' else 'Conductor en parada' end,jsonb_build_object('entityId',v_entity)); end if;
 v_result:=jsonb_build_object('executionId',v_exec.id,'entityId',v_entity,'eventType',v_event,'correlationId',p_correlation,'idempotencyKey',p_key,'criticalIncidentOpen',exists(select 1 from public.transport_incidents where transport_order_id=p_order and severity='critical' and status in('open','in_progress')));
 update public.transport_command_idempotency set result=v_result,completed_at=statement_timestamp() where organization_id=p_org and idempotency_key=p_key;
 return v_result;
end $$;
revoke all on function public.execute_driver_transport_operation(uuid,uuid,uuid,text,text,jsonb,uuid,uuid) from public,anon;
grant execute on function public.execute_driver_transport_operation(uuid,uuid,uuid,text,text,jsonb,uuid,uuid) to authenticated,service_role;
comment on function public.execute_driver_transport_operation(uuid,uuid,uuid,text,text,jsonb,uuid,uuid) is 'Comando conductor atómico: JWT, asignación vigente, módulos, idempotencia, trigger de estados, timeline y auditoría.';
