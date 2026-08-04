-- Fase B: núcleo operativo de transporte. Migración aditiva y forward-only.
create extension if not exists btree_gist with schema extensions;

create type public.transport_order_status as enum ('draft','planned','assigned','loading','in_transit','unloading','completed','cancelled','archived');
create type public.transport_priority as enum ('low','normal','high','urgent');
create type public.transport_stop_type as enum ('pickup','delivery','waypoint','cross_dock','return');
create type public.transport_stop_status as enum ('pending','arrived','completed','skipped');

create table public.transport_order_counters (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  last_value bigint not null default 0 check (last_value >= 0)
);

create table public.transport_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  order_number text not null,
  customer_id uuid not null references public.clients(id) on delete restrict,
  status public.transport_order_status not null default 'draft',
  priority public.transport_priority not null default 'normal',
  transport_type text not null,
  planned_pickup_at timestamptz null,
  planned_delivery_at timestamptz null,
  requested_pickup_at timestamptz null,
  requested_delivery_at timestamptz null,
  assigned_driver_id uuid null references public.drivers(id) on delete restrict,
  assigned_vehicle_id uuid null references public.vehicles(id) on delete restrict,
  notes text null,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  constraint transport_orders_number_not_blank check (btrim(order_number) <> ''),
  constraint transport_orders_type_valid check (btrim(transport_type) <> '' and length(btrim(transport_type)) <= 100),
  constraint transport_orders_planned_period check (planned_delivery_at is null or planned_pickup_at is null or planned_delivery_at > planned_pickup_at),
  constraint transport_orders_requested_period check (requested_delivery_at is null or requested_pickup_at is null or requested_delivery_at > requested_pickup_at),
  constraint transport_orders_assignment_pair check ((assigned_driver_id is null) = (assigned_vehicle_id is null)),
  constraint transport_orders_archived_consistent check ((status = 'archived') = (archived_at is not null)),
  unique (organization_id, order_number)
);
create index transport_orders_org_status_time_idx on public.transport_orders(organization_id,status,planned_pickup_at desc);
create index transport_orders_org_customer_idx on public.transport_orders(organization_id,customer_id,created_at desc);

create table public.transport_stops (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  transport_order_id uuid not null references public.transport_orders(id) on delete restrict,
  position integer not null check (position > 0),
  stop_type public.transport_stop_type not null,
  location_id uuid not null references public.locations(id) on delete restrict,
  customer_id uuid null references public.clients(id) on delete restrict,
  window_starts_at timestamptz null,
  window_ends_at timestamptz null,
  status public.transport_stop_status not null default 'pending',
  notes text null,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transport_stops_window check (window_ends_at is null or window_starts_at is null or window_ends_at > window_starts_at),
  unique(transport_order_id,position)
);
create index transport_stops_order_position_idx on public.transport_stops(transport_order_id,position);

create table public.transport_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  transport_order_id uuid not null references public.transport_orders(id) on delete restrict,
  stop_id uuid not null references public.transport_stops(id) on delete restrict,
  description text not null,
  reference text null,
  pallets integer not null default 0 check (pallets >= 0),
  packages integer not null default 0 check (packages >= 0),
  weight_kg numeric(12,2) null check (weight_kg is null or weight_kg >= 0),
  volume_m3 numeric(12,3) null check (volume_m3 is null or volume_m3 >= 0),
  is_adr boolean not null default false,
  temperature_min_c numeric(6,2) null,
  temperature_max_c numeric(6,2) null,
  notes text null,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transport_items_description check (btrim(description) <> ''),
  constraint transport_items_temperature check (temperature_max_c is null or temperature_min_c is null or temperature_max_c >= temperature_min_c)
);
create index transport_items_stop_idx on public.transport_items(stop_id,created_at);
create index transport_items_order_idx on public.transport_items(transport_order_id,created_at);

create table public.transport_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  transport_order_id uuid not null references public.transport_orders(id) on delete restrict,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  unassigned_at timestamptz null,
  assigned_by uuid not null references public.profiles(user_id) on delete restrict,
  notes text null,
  created_at timestamptz not null default now(),
  constraint transport_assignments_period check (ends_at > starts_at),
  exclude using gist (organization_id with =,driver_id with =,tstzrange(starts_at,ends_at,'[)') with &&) where (unassigned_at is null),
  exclude using gist (organization_id with =,vehicle_id with =,tstzrange(starts_at,ends_at,'[)') with &&) where (unassigned_at is null)
);
create index transport_assignments_order_time_idx on public.transport_assignments(transport_order_id,created_at desc);

create table public.transport_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  transport_order_id uuid not null references public.transport_orders(id) on delete restrict,
  event_type text not null,
  actor_user_id uuid not null references public.profiles(user_id) on delete restrict,
  entity_type text not null,
  entity_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  correlation_id uuid not null default gen_random_uuid(),
  constraint transport_events_type_format check (event_type ~ '^[a-z][a-z0-9_.]*$'),
  constraint transport_events_entity_format check (entity_type ~ '^[a-z][a-z0-9_]*$'),
  constraint transport_events_payload_object check (jsonb_typeof(payload)='object')
);
create index transport_events_order_time_idx on public.transport_events(transport_order_id,occurred_at,id);
create index transport_events_org_time_idx on public.transport_events(organization_id,occurred_at desc);

create function public.next_transport_order_number(p_organization_id uuid) returns text
language plpgsql security definer set search_path=pg_catalog,public as $$
declare n bigint;
begin
  insert into public.transport_order_counters(organization_id,last_value) values(p_organization_id,1)
  on conflict(organization_id) do update set last_value=transport_order_counters.last_value+1
  returning last_value into n;
  return 'TR-' || lpad(n::text,8,'0');
end $$;

create function public.prepare_transport_order() returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare linked_org uuid;
begin
  if new.order_number is null or btrim(new.order_number)='' then new.order_number:=public.next_transport_order_number(new.organization_id); end if;
  select organization_id into linked_org from public.clients where id=new.customer_id;
  if linked_org is distinct from new.organization_id then raise exception using errcode='23514',message='customer must belong to order organization'; end if;
  if new.assigned_driver_id is not null then
    if not exists(select 1 from public.drivers where id=new.assigned_driver_id and organization_id=new.organization_id and employment_status='active') then raise exception using errcode='23514',message='assigned driver must be active in order organization'; end if;
    if not exists(select 1 from public.vehicles where id=new.assigned_vehicle_id and organization_id=new.organization_id and status='active') then raise exception using errcode='23514',message='assigned vehicle must be active in order organization'; end if;
  end if;
  return new;
end $$;

create function public.validate_transport_order_transition() returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if old.status=new.status then
    if old.status in ('completed','cancelled','archived') then raise exception using errcode='23514',message='terminal transport order is immutable'; end if;
    return new;
  end if;
  if not (
    (old.status='draft' and new.status in ('planned','cancelled')) or
    (old.status='planned' and new.status in ('assigned','cancelled')) or
    (old.status='assigned' and new.status in ('loading','cancelled')) or
    (old.status='loading' and new.status in ('in_transit','cancelled')) or
    (old.status='in_transit' and new.status in ('unloading','cancelled')) or
    (old.status='unloading' and new.status in ('completed','cancelled')) or
    (old.status in ('completed','cancelled') and new.status='archived')
  ) then raise exception using errcode='23514',message='invalid transport order transition'; end if;
  if new.status='planned' and (new.planned_pickup_at is null or new.planned_delivery_at is null) then raise exception using errcode='23514',message='planned order requires a complete planned window'; end if;
  if new.status='assigned' and new.assigned_driver_id is null then raise exception using errcode='23514',message='assigned order requires driver and vehicle'; end if;
  if new.status='archived' then new.archived_at:=statement_timestamp(); end if;
  return new;
end $$;

create function public.validate_transport_child_tenant() returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare order_org uuid; linked_org uuid; linked_state text;
begin
  select organization_id into order_org from public.transport_orders where id=new.transport_order_id;
  if order_org is distinct from new.organization_id then raise exception using errcode='23514',message='transport order must belong to same organization'; end if;
  if tg_table_name='transport_stops' then
    select organization_id into linked_org from public.locations where id=new.location_id;
    if linked_org is distinct from new.organization_id then raise exception using errcode='23514',message='location must belong to same organization'; end if;
    if new.customer_id is not null then select organization_id into linked_org from public.clients where id=new.customer_id; if linked_org is distinct from new.organization_id then raise exception using errcode='23514',message='stop customer must belong to same organization'; end if; end if;
  elsif tg_table_name='transport_items' then
    select organization_id into linked_org from public.transport_stops where id=new.stop_id and transport_order_id=new.transport_order_id;
    if linked_org is distinct from new.organization_id then raise exception using errcode='23514',message='item stop must belong to same order'; end if;
  elsif tg_table_name='transport_assignments' then
    select organization_id,employment_status::text into linked_org,linked_state from public.drivers where id=new.driver_id;
    if linked_org is distinct from new.organization_id or linked_state<>'active' then raise exception using errcode='23514',message='driver must be active in same organization'; end if;
    select organization_id,status::text into linked_org,linked_state from public.vehicles where id=new.vehicle_id;
    if linked_org is distinct from new.organization_id or linked_state<>'active' then raise exception using errcode='23514',message='vehicle must be active in same organization'; end if;
  end if;
  return new;
end $$;

create function public.prevent_transport_event_mutation() returns trigger language plpgsql set search_path=pg_catalog,public as $$ begin raise exception using errcode='55000',message='transport events are append-only'; end $$;

create trigger transport_orders_prepare before insert or update of customer_id,assigned_driver_id,assigned_vehicle_id on public.transport_orders for each row execute function public.prepare_transport_order();
create trigger transport_orders_transition before update on public.transport_orders for each row execute function public.validate_transport_order_transition();
create trigger transport_orders_updated before update on public.transport_orders for each row execute function public.set_updated_at();
create trigger transport_stops_tenant before insert or update on public.transport_stops for each row execute function public.validate_transport_child_tenant();
create trigger transport_stops_updated before update on public.transport_stops for each row execute function public.set_updated_at();
create trigger transport_items_tenant before insert or update on public.transport_items for each row execute function public.validate_transport_child_tenant();
create trigger transport_items_updated before update on public.transport_items for each row execute function public.set_updated_at();
create trigger transport_assignments_tenant before insert or update on public.transport_assignments for each row execute function public.validate_transport_child_tenant();
create trigger transport_events_immutable before update or delete on public.transport_events for each row execute function public.prevent_transport_event_mutation();

alter table public.transport_order_counters enable row level security; alter table public.transport_order_counters force row level security;
alter table public.transport_orders enable row level security; alter table public.transport_orders force row level security;
alter table public.transport_stops enable row level security; alter table public.transport_stops force row level security;
alter table public.transport_items enable row level security; alter table public.transport_items force row level security;
alter table public.transport_assignments enable row level security; alter table public.transport_assignments force row level security;
alter table public.transport_events enable row level security; alter table public.transport_events force row level security;

create policy transport_orders_read on public.transport_orders for select to authenticated using(public.can_access_master_data(organization_id,'transport_management'));
create policy transport_stops_read on public.transport_stops for select to authenticated using(public.can_access_master_data(organization_id,'transport_management'));
create policy transport_items_read on public.transport_items for select to authenticated using(public.can_access_master_data(organization_id,'transport_management'));
create policy transport_assignments_read on public.transport_assignments for select to authenticated using(public.can_access_master_data(organization_id,'transport_management'));
create policy transport_events_read on public.transport_events for select to authenticated using(public.can_access_master_data(organization_id,'transport_management'));

revoke all on table public.transport_order_counters,public.transport_orders,public.transport_stops,public.transport_items,public.transport_assignments,public.transport_events from anon,authenticated;
grant select on table public.transport_orders,public.transport_stops,public.transport_items,public.transport_assignments,public.transport_events to authenticated;
grant all on table public.transport_order_counters,public.transport_orders,public.transport_stops,public.transport_items,public.transport_assignments,public.transport_events to service_role;
revoke all on function public.next_transport_order_number(uuid),public.prepare_transport_order(),public.validate_transport_order_transition(),public.validate_transport_child_tenant(),public.prevent_transport_event_mutation() from public;
grant execute on function public.next_transport_order_number(uuid) to service_role;

comment on table public.transport_orders is 'Servicio completo de transporte; entidad raíz del núcleo operativo.';
comment on table public.transport_stops is 'Paradas ordenadas y reutilizables de una orden de transporte.';
comment on table public.transport_items is 'Mercancías asociadas a una parada, sin documentos ni OCR.';
comment on table public.transport_assignments is 'Historial temporal de asignaciones conductor-vehículo a órdenes.';
comment on table public.transport_events is 'Timeline append-only de hechos operativos de transporte.';
