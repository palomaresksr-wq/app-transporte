-- Fase C: ejecución operativa. Migración aditiva, forward-only.
create type public.transport_execution_status as enum ('pending','driver_notified','heading_to_pickup','arrived_pickup','waiting_pickup','loading','loaded','departed_pickup','in_transit','arrived_delivery','waiting_delivery','unloading','delivered','completed','cancelled');
create type public.transport_incident_category as enum ('delay','breakdown','traffic','customer_absent','wrong_address','missing_goods','damaged_goods','documentation','other');
create type public.transport_incident_severity as enum ('low','normal','high','critical');
create type public.transport_incident_status as enum ('open','in_progress','resolved','closed','archived');
create type public.transport_note_type as enum ('operational','driver','customer','internal');
create type public.internal_notification_status as enum ('unread','read','archived');

insert into public.modules(code,name,description,category,status)
values ('transport_execution','Ejecución de transporte','Seguimiento operativo real, incidencias y notas.','operations','active');
insert into public.plan_modules(plan_id,module_id,enabled)
select p.id,m.id,true from public.plans p cross join public.modules m where m.code='transport_execution';

create table public.transport_executions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 transport_order_id uuid not null unique references public.transport_orders(id) on delete restrict,
 status public.transport_execution_status not null default 'pending',
 driver_notified_at timestamptz, arrived_pickup_at timestamptz, loading_started_at timestamptz,
 loading_completed_at timestamptz, departed_pickup_at timestamptz, arrived_delivery_at timestamptz,
 unloading_started_at timestamptz, unloading_completed_at timestamptz, completed_at timestamptz, cancelled_at timestamptz,
 created_by uuid not null references public.profiles(user_id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index transport_executions_org_status_idx on public.transport_executions(organization_id,status,updated_at desc);

create table public.transport_incidents (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 transport_order_id uuid not null references public.transport_orders(id) on delete restrict,
 severity public.transport_incident_severity not null default 'normal', category public.transport_incident_category not null,
 status public.transport_incident_status not null default 'open', title text not null check(btrim(title)<>'' and length(btrim(title))<=200),
 description text not null check(btrim(description)<>'' and length(btrim(description))<=4000),
 reported_by uuid not null references public.profiles(user_id) on delete restrict, reported_at timestamptz not null default now(),
 resolved_by uuid references public.profiles(user_id) on delete restrict, resolved_at timestamptz, resolution_notes text,
 updated_at timestamptz not null default now(), archived_at timestamptz,
 constraint incident_resolution_consistent check ((resolved_at is null)=(resolved_by is null)),
 constraint incident_archive_consistent check ((status='archived')=(archived_at is not null))
);
create index transport_incidents_order_status_idx on public.transport_incidents(transport_order_id,status,reported_at desc);
create index transport_incidents_org_severity_idx on public.transport_incidents(organization_id,severity,reported_at desc);

create table public.transport_notes (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 transport_order_id uuid not null references public.transport_orders(id) on delete restrict,
 author_user_id uuid not null references public.profiles(user_id) on delete restrict,
 note_type public.transport_note_type not null default 'operational', body text not null check(btrim(body)<>'' and length(btrim(body))<=4000),
 visible_driver boolean not null default false, visible_customer boolean not null default false, visible_admin boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz
);
create index transport_notes_order_time_idx on public.transport_notes(transport_order_id,created_at desc);

create table public.internal_notifications (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 transport_order_id uuid references public.transport_orders(id) on delete restrict, recipient_user_id uuid references public.profiles(user_id) on delete restrict,
 event_type text not null check(event_type~'^[a-z][a-z0-9_.]*$'), title text not null check(btrim(title)<>''), payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object'),
 status public.internal_notification_status not null default 'unread', created_at timestamptz not null default now(), read_at timestamptz, archived_at timestamptz
);
create index internal_notifications_recipient_idx on public.internal_notifications(organization_id,recipient_user_id,status,created_at desc);

create view public.transport_waiting_times with (security_invoker=true) as
select e.id execution_id,e.organization_id,e.transport_order_id,
 case when e.loading_started_at is not null and e.arrived_pickup_at is not null then extract(epoch from e.loading_started_at-e.arrived_pickup_at)::bigint end waiting_pickup_seconds,
 case when e.unloading_started_at is not null and e.arrived_delivery_at is not null then extract(epoch from e.unloading_started_at-e.arrived_delivery_at)::bigint end waiting_delivery_seconds,
 case when e.loading_completed_at is not null and e.loading_started_at is not null then extract(epoch from e.loading_completed_at-e.loading_started_at)::bigint end loading_seconds,
 case when e.unloading_completed_at is not null and e.unloading_started_at is not null then extract(epoch from e.unloading_completed_at-e.unloading_started_at)::bigint end unloading_seconds,
 case when e.arrived_delivery_at is not null and e.departed_pickup_at is not null then extract(epoch from e.arrived_delivery_at-e.departed_pickup_at)::bigint end transit_seconds,
 case when coalesce(e.completed_at,e.cancelled_at) is not null then extract(epoch from coalesce(e.completed_at,e.cancelled_at)-e.created_at)::bigint end total_seconds
from public.transport_executions e;

create function public.phase_c_module_enabled(p_organization_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select public.can_access_master_data(p_organization_id,'transport_execution')
$$;

create function public.validate_phase_c_tenant() returns trigger language plpgsql set search_path=pg_catalog,public as $$ declare v_org uuid; v_order_status public.transport_order_status; begin
 select organization_id,status into v_org,v_order_status from public.transport_orders where id=new.transport_order_id;
 if v_org is distinct from new.organization_id then raise exception using errcode='23514',message='transport order must belong to same organization'; end if;
 if tg_table_name='transport_incidents' and v_order_status='archived' then raise exception using errcode='23514',message='incidents cannot be registered on archived orders'; end if;
 return new; end $$;

create function public.validate_execution_transition() returns trigger language plpgsql set search_path=pg_catalog,public as $$ begin
 if old.status=new.status then return new; end if;
 if not ((old.status='pending' and new.status in ('driver_notified','heading_to_pickup','cancelled')) or (old.status='driver_notified' and new.status in ('heading_to_pickup','cancelled')) or (old.status='heading_to_pickup' and new.status in ('arrived_pickup','cancelled')) or (old.status='arrived_pickup' and new.status in ('waiting_pickup','loading','cancelled')) or (old.status='waiting_pickup' and new.status in ('loading','cancelled')) or (old.status='loading' and new.status in ('loaded','cancelled')) or (old.status='loaded' and new.status in ('departed_pickup','cancelled')) or (old.status='departed_pickup' and new.status in ('in_transit','arrived_delivery','cancelled')) or (old.status='in_transit' and new.status in ('arrived_delivery','cancelled')) or (old.status='arrived_delivery' and new.status in ('waiting_delivery','unloading','cancelled')) or (old.status='waiting_delivery' and new.status in ('unloading','cancelled')) or (old.status='unloading' and new.status in ('delivered','cancelled')) or (old.status='delivered' and new.status in ('completed','cancelled'))) then raise exception using errcode='23514',message='invalid execution transition'; end if;
 case new.status when 'driver_notified' then if new.driver_notified_at is null then new.driver_notified_at:=statement_timestamp(); end if; when 'arrived_pickup' then if new.arrived_pickup_at is null then new.arrived_pickup_at:=statement_timestamp(); end if; when 'loading' then if new.loading_started_at is null then new.loading_started_at:=statement_timestamp(); end if; when 'loaded' then if new.loading_completed_at is null then new.loading_completed_at:=statement_timestamp(); end if; when 'departed_pickup' then if new.departed_pickup_at is null then new.departed_pickup_at:=statement_timestamp(); end if; when 'arrived_delivery' then if new.arrived_delivery_at is null then new.arrived_delivery_at:=statement_timestamp(); end if; when 'unloading' then if new.unloading_started_at is null then new.unloading_started_at:=statement_timestamp(); end if; when 'delivered' then if new.unloading_completed_at is null then new.unloading_completed_at:=statement_timestamp(); end if; when 'completed' then if new.completed_at is null then new.completed_at:=statement_timestamp(); end if; when 'cancelled' then if new.cancelled_at is null then new.cancelled_at:=statement_timestamp(); end if; else null; end case;
 new.updated_at:=statement_timestamp(); return new; end $$;

create function public.prevent_execution_timestamp_overwrite() returns trigger language plpgsql set search_path=pg_catalog,public as $$ begin
 if (old.driver_notified_at is not null and new.driver_notified_at is distinct from old.driver_notified_at) or (old.arrived_pickup_at is not null and new.arrived_pickup_at is distinct from old.arrived_pickup_at) or (old.loading_started_at is not null and new.loading_started_at is distinct from old.loading_started_at) or (old.loading_completed_at is not null and new.loading_completed_at is distinct from old.loading_completed_at) or (old.departed_pickup_at is not null and new.departed_pickup_at is distinct from old.departed_pickup_at) or (old.arrived_delivery_at is not null and new.arrived_delivery_at is distinct from old.arrived_delivery_at) or (old.unloading_started_at is not null and new.unloading_started_at is distinct from old.unloading_started_at) or (old.unloading_completed_at is not null and new.unloading_completed_at is distinct from old.unloading_completed_at) or (old.completed_at is not null and new.completed_at is distinct from old.completed_at) or (old.cancelled_at is not null and new.cancelled_at is distinct from old.cancelled_at) then raise exception using errcode='23514',message='execution timestamps cannot be overwritten'; end if; return new; end $$;

create trigger executions_tenant before insert or update on public.transport_executions for each row execute function public.validate_phase_c_tenant();
create trigger executions_timestamp_guard before update on public.transport_executions for each row execute function public.prevent_execution_timestamp_overwrite();
create trigger executions_transition before update on public.transport_executions for each row execute function public.validate_execution_transition();
create trigger incidents_tenant before insert or update on public.transport_incidents for each row execute function public.validate_phase_c_tenant();
create trigger incidents_updated before update on public.transport_incidents for each row execute function public.set_updated_at();
create trigger notes_tenant before insert or update on public.transport_notes for each row execute function public.validate_phase_c_tenant();
create trigger notes_updated before update on public.transport_notes for each row execute function public.set_updated_at();

alter table public.transport_executions enable row level security; alter table public.transport_executions force row level security;
alter table public.transport_incidents enable row level security; alter table public.transport_incidents force row level security;
alter table public.transport_notes enable row level security; alter table public.transport_notes force row level security;
alter table public.internal_notifications enable row level security; alter table public.internal_notifications force row level security;
create policy executions_read on public.transport_executions for select to authenticated using(public.phase_c_module_enabled(organization_id));
create policy incidents_read on public.transport_incidents for select to authenticated using(public.phase_c_module_enabled(organization_id));
create policy notes_read on public.transport_notes for select to authenticated using(public.phase_c_module_enabled(organization_id));
create policy notifications_read on public.internal_notifications for select to authenticated using(public.phase_c_module_enabled(organization_id) and (recipient_user_id is null or recipient_user_id=auth.uid() or public.is_platform_superadmin()));
revoke all on public.transport_executions,public.transport_incidents,public.transport_notes,public.internal_notifications from anon,authenticated;
grant select on public.transport_executions,public.transport_incidents,public.transport_notes,public.internal_notifications,public.transport_waiting_times to authenticated;
grant all on public.transport_executions,public.transport_incidents,public.transport_notes,public.internal_notifications to service_role;
revoke all on function public.phase_c_module_enabled(uuid),public.validate_phase_c_tenant(),public.validate_execution_transition(),public.prevent_execution_timestamp_overwrite() from public;
grant execute on function public.phase_c_module_enabled(uuid) to authenticated,service_role;
comment on table public.transport_executions is 'Realidad operativa 1:1 de una orden; separada de la planificación.';
comment on view public.transport_waiting_times is 'Duraciones derivadas en segundos; no duplica timestamps de ejecución.';
comment on table public.transport_incidents is 'Incidencias operativas auditables y archivables lógicamente.';
comment on table public.transport_notes is 'Notas operativas con visibilidad explícita; nunca se borran por interfaz.';
comment on table public.internal_notifications is 'Bandeja interna preparada para entrega futura; sin email ni push.';
