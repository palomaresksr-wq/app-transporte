-- Fase I: portal móvil del conductor. Aditiva y forward-only.
create table public.driver_completion_policies (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  require_pod boolean not null default false,
  require_signature boolean not null default false,
  require_document boolean not null default false,
  updated_by uuid not null references public.profiles(user_id) on delete restrict,
  updated_at timestamptz not null default now()
);
alter table public.driver_completion_policies enable row level security;
alter table public.driver_completion_policies force row level security;
revoke all on public.driver_completion_policies from public,anon,authenticated;
grant select on public.driver_completion_policies to authenticated;
grant all on public.driver_completion_policies to service_role;

create function public.driver_has_order_access(p_order_id uuid, p_module text default 'transport_management')
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(
    select 1 from public.transport_orders o
    join public.drivers d on d.id=o.assigned_driver_id and d.organization_id=o.organization_id
    join public.organization_memberships om on om.id=d.membership_id
    join public.profiles p on p.user_id=om.user_id
    join public.organizations org on org.id=o.organization_id
    where o.id=p_order_id and om.user_id=auth.uid() and om.organization_id=o.organization_id
      and om.role='conductor' and om.status='active' and p.status='active'
      and org.status='active' and d.employment_status='active' and d.archived_at is null
      and public.current_organization_module_enabled(p_module)
  )
$$;
revoke all on function public.driver_has_order_access(uuid,text) from public,anon;
grant execute on function public.driver_has_order_access(uuid,text) to authenticated,service_role;

create policy driver_completion_policy_read on public.driver_completion_policies for select to authenticated
using(public.can_access_master_data(organization_id,'transport_execution') or
      (public.current_organization_id()=organization_id and public.current_organization_role()='conductor' and public.current_organization_module_enabled('transport_execution')));

-- Las políticas anteriores eran demasiado amplias para el rol conductor. Se conserva el acceso de oficina
-- y se añade exclusivamente la orden actualmente asignada.
drop policy transport_orders_read on public.transport_orders;
create policy transport_orders_read on public.transport_orders for select to authenticated
using(public.is_platform_superadmin() or
      (public.current_organization_role()='admin_empresa' and public.can_access_master_data(organization_id,'transport_management')) or
      public.driver_has_order_access(id,'transport_management'));
drop policy transport_stops_read on public.transport_stops;
create policy transport_stops_read on public.transport_stops for select to authenticated
using(public.is_platform_superadmin() or
      (public.current_organization_role()='admin_empresa' and public.can_access_master_data(organization_id,'transport_management')) or
      public.driver_has_order_access(transport_order_id,'transport_management'));
drop policy transport_items_read on public.transport_items;
create policy transport_items_read on public.transport_items for select to authenticated
using(public.is_platform_superadmin() or
      (public.current_organization_role()='admin_empresa' and public.can_access_master_data(organization_id,'transport_management')) or
      public.driver_has_order_access(transport_order_id,'transport_management'));
drop policy transport_assignments_read on public.transport_assignments;
create policy transport_assignments_read on public.transport_assignments for select to authenticated
using(public.is_platform_superadmin() or
      (public.current_organization_role()='admin_empresa' and public.can_access_master_data(organization_id,'transport_management')) or
      public.driver_has_order_access(transport_order_id,'transport_management'));
drop policy transport_events_read on public.transport_events;
create policy transport_events_read on public.transport_events for select to authenticated
using(public.is_platform_superadmin() or
      (public.current_organization_role()='admin_empresa' and public.can_access_master_data(organization_id,'transport_management')) or
      public.driver_has_order_access(transport_order_id,'transport_management'));
drop policy executions_read on public.transport_executions;
create policy executions_read on public.transport_executions for select to authenticated
using(public.is_platform_superadmin() or
      (public.current_organization_role()='admin_empresa' and public.phase_c_module_enabled(organization_id)) or
      public.driver_has_order_access(transport_order_id,'transport_execution'));
drop policy incidents_read on public.transport_incidents;
create policy incidents_read on public.transport_incidents for select to authenticated
using(public.is_platform_superadmin() or
      (public.current_organization_role()='admin_empresa' and public.phase_c_module_enabled(organization_id)) or
      public.driver_has_order_access(transport_order_id,'transport_execution'));
drop policy notes_read on public.transport_notes;
create policy notes_read on public.transport_notes for select to authenticated
using(public.is_platform_superadmin() or
      (public.current_organization_role()='admin_empresa' and public.phase_c_module_enabled(organization_id)) or
      (public.driver_has_order_access(transport_order_id,'transport_execution') and (visible_driver or author_user_id=auth.uid())));

drop policy drivers_read on public.drivers;
create policy drivers_read on public.drivers for select to authenticated using(
 public.is_platform_superadmin() or (public.current_organization_role()='admin_empresa' and public.can_access_master_data(organization_id,'transport_management')) or
 (membership_id=(select id from public.organization_memberships where user_id=auth.uid() and organization_id=drivers.organization_id and role='conductor' and status='active')));
drop policy clients_read on public.clients;
create policy clients_read on public.clients for select to authenticated using(
 public.is_platform_superadmin() or (public.current_organization_role()='admin_empresa' and public.can_access_master_data(organization_id,'client_management')) or
 exists(select 1 from public.transport_orders o where o.customer_id=clients.id and public.driver_has_order_access(o.id,'transport_management')));
drop policy contacts_read on public.client_contacts;
create policy contacts_read on public.client_contacts for select to authenticated using(
 public.is_platform_superadmin() or (public.current_organization_role()='admin_empresa' and public.can_access_master_data(organization_id,'client_management')));
drop policy locations_read on public.locations;
create policy locations_read on public.locations for select to authenticated using(
 public.is_platform_superadmin() or (public.current_organization_role()='admin_empresa' and public.can_access_master_data(organization_id,'client_management')) or
 exists(select 1 from public.transport_stops s where s.location_id=locations.id and public.driver_has_order_access(s.transport_order_id,'transport_management')));
drop policy vehicles_read on public.vehicles;
create policy vehicles_read on public.vehicles for select to authenticated using(
 public.is_platform_superadmin() or (public.current_organization_role()='admin_empresa' and public.can_access_master_data(organization_id,'vehicle_management')) or
 exists(select 1 from public.transport_orders o where o.assigned_vehicle_id=vehicles.id and public.driver_has_order_access(o.id,'transport_management')));
drop policy documents_read on public.documents;
create policy documents_read on public.documents for select to authenticated using(
 public.is_platform_superadmin() or (public.current_organization_role()='admin_empresa' and public.can_access_master_data(organization_id,'document_management')) or
 (transport_order_id is not null and public.driver_has_order_access(transport_order_id,'document_management')));
drop policy versions_read on public.document_versions;
create policy versions_read on public.document_versions for select to authenticated using(
 public.is_platform_superadmin() or (public.current_organization_role()='admin_empresa' and public.can_access_master_data(organization_id,'document_management')) or
 exists(select 1 from public.documents d where d.id=document_versions.document_id and d.transport_order_id is not null and public.driver_has_order_access(d.transport_order_id,'document_management')));
drop policy pods_read on public.proofs_of_delivery;
create policy pods_read on public.proofs_of_delivery for select to authenticated using(
 public.is_platform_superadmin() or (public.current_organization_role()='admin_empresa' and public.can_access_master_data(organization_id,'pod_signature')) or
 public.driver_has_order_access(transport_order_id,'pod_signature'));
drop policy signatures_read on public.document_signatures;
create policy signatures_read on public.document_signatures for select to authenticated using(
 public.is_platform_superadmin() or (public.current_organization_role()='admin_empresa' and public.can_access_master_data(organization_id,'pod_signature')) or
 exists(select 1 from public.documents d where d.id=document_signatures.document_id and d.transport_order_id is not null and public.driver_has_order_access(d.transport_order_id,'pod_signature')));

create function public.execute_driver_transport_operation(
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
     if coalesce(v_policy.require_signature,false) and not exists(select 1 from public.document_signatures s join public.documents d on d.id=s.document_id where d.transport_order_id=p_order and s.status='active') then v_missing:=array_append(v_missing,'signature'); end if;
     if coalesce(v_policy.require_document,false) and not exists(select 1 from public.documents where transport_order_id=p_order and status='available') then v_missing:=array_append(v_missing,'document'); end if;
     if cardinality(v_missing)>0 then raise exception using errcode='23514',message='completion requirements missing: '||array_to_string(v_missing,','); end if;
   end if;
   v_before:=to_jsonb(v_exec); update public.transport_executions set status=p_target::public.transport_execution_status where id=v_exec.id returning * into v_exec;
   v_entity:=v_exec.id; v_after:=to_jsonb(v_exec); v_event:=case when p_target='completed' then 'execution.completed' else 'execution.updated' end;
 elsif p_resource='incident' then
   if p_values - array['severity','category','title','description'] <> '{}'::jsonb then raise exception using errcode='22023',message='unsupported incident fields'; end if;
   insert into public.transport_incidents(organization_id,transport_order_id,severity,category,title,description,reported_by)
   values(p_org,p_order,coalesce((p_values->>'severity')::public.transport_incident_severity,'normal'),(p_values->>'category')::public.transport_incident_category,btrim(p_values->>'title'),btrim(p_values->>'description'),p_actor) returning id,to_jsonb(transport_incidents.*) into v_entity,v_after;
   v_before:=null; v_event:='incident.created';
 elsif p_resource='note' then
   if p_values - array['body'] <> '{}'::jsonb then raise exception using errcode='22023',message='unsupported note fields'; end if;
   insert into public.transport_notes(organization_id,transport_order_id,author_user_id,note_type,body,visible_driver,visible_admin)
   values(p_org,p_order,p_actor,'driver',btrim(p_values->>'body'),true,true) returning id,to_jsonb(transport_notes.*) into v_entity,v_after;
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

-- Los comandos documentales son backend-only. La Edge Function valida además que la relación
-- documental pertenece a la orden asignada antes de invocarlos.
create or replace function public.document_actor_authorized(p_actor uuid,p_scope public.audit_actor_scope,p_org uuid,p_module text) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.profiles where user_id=p_actor and status='active') and (
  (p_scope='platform' and exists(select 1 from public.platform_admins where user_id=p_actor and role='superadmin' and status='active')) or
  (p_scope='organization' and exists(select 1 from public.organizations where id=p_org and status='active') and exists(select 1 from public.organization_memberships where organization_id=p_org and user_id=p_actor and role in ('admin_empresa','conductor') and status='active') and coalesce(
   (select case omo.override_mode when 'enabled' then true when 'disabled' then false else null end from public.organization_module_overrides omo join public.modules m on m.id=omo.module_id where omo.organization_id=p_org and m.code=p_module),
   (select pm.enabled from public.organization_subscriptions os join public.plan_modules pm on pm.plan_id=os.plan_id join public.modules m on m.id=pm.module_id where os.organization_id=p_org and m.code=p_module),false)))
$$;
