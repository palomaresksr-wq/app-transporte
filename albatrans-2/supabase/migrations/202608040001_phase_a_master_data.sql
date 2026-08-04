begin;

create extension if not exists btree_gist with schema extensions;

create type public.driver_employment_status as enum ('pending','active','inactive','on_leave','terminated','archived');
create type public.master_data_status as enum ('active','inactive','archived');
create type public.fleet_asset_status as enum ('active','inactive','maintenance','archived');

create table public.drivers (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  membership_id uuid null references public.organization_memberships(id) on delete restrict,
  employee_number text null, internal_reference text null, first_name text not null, last_name text not null,
  display_name text not null, email text null, phone text null, license_number text null, license_expires_at date null,
  employment_status public.driver_employment_status not null default 'pending', active_from date null, active_until date null,
  notes text null, created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz null,
  constraint drivers_names_not_blank check (btrim(first_name) <> '' and btrim(last_name) <> '' and btrim(display_name) <> ''),
  constraint drivers_optional_codes_not_blank check ((employee_number is null or btrim(employee_number) <> '') and (internal_reference is null or btrim(internal_reference) <> '')),
  constraint drivers_active_dates check (active_until is null or active_from is null or active_until >= active_from),
  constraint drivers_archived_consistent check ((employment_status = 'archived') = (archived_at is not null))
);
create unique index drivers_membership_unique on public.drivers(membership_id) where membership_id is not null;
create unique index drivers_employee_number_unique on public.drivers(organization_id, lower(employee_number)) where employee_number is not null;
create unique index drivers_internal_reference_unique on public.drivers(organization_id, lower(internal_reference)) where internal_reference is not null;
create index drivers_org_status_idx on public.drivers(organization_id, employment_status, display_name);

create table public.clients (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  legal_name text not null, trade_name text not null, tax_id text null, email text null, phone text null, billing_email text null,
  payment_terms_days integer not null default 0, status public.master_data_status not null default 'active', external_reference text null,
  notes text null, created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz null,
  constraint clients_names_not_blank check (btrim(legal_name) <> '' and btrim(trade_name) <> ''),
  constraint clients_payment_terms_non_negative check (payment_terms_days >= 0),
  constraint clients_archived_consistent check ((status = 'archived') = (archived_at is not null))
);
create unique index clients_tax_id_unique on public.clients(organization_id, lower(tax_id)) where tax_id is not null;
create unique index clients_external_reference_unique on public.clients(organization_id, lower(external_reference)) where external_reference is not null;
create index clients_org_status_idx on public.clients(organization_id, status, trade_name);

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict, name text not null, role text null, email text null,
  phone text null, is_primary boolean not null default false, notes text null,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint client_contacts_name_not_blank check (btrim(name) <> '')
);
create unique index client_contacts_one_primary on public.client_contacts(client_id) where is_primary;
create index client_contacts_org_client_idx on public.client_contacts(organization_id, client_id, name);

create table public.locations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  client_id uuid null references public.clients(id) on delete restrict, name text not null, address_line_1 text not null,
  address_line_2 text null, postal_code text not null, city text not null, region text null, country_code text not null,
  latitude numeric(9,6) null, longitude numeric(9,6) null, instructions text null,
  status public.master_data_status not null default 'active', created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz null,
  constraint locations_required_not_blank check (btrim(name) <> '' and btrim(address_line_1) <> '' and btrim(postal_code) <> '' and btrim(city) <> ''),
  constraint locations_country_code check (country_code ~ '^[A-Z]{2}$'),
  constraint locations_coordinates check ((latitude is null) = (longitude is null) and latitude between -90 and 90 and longitude between -180 and 180 or latitude is null),
  constraint locations_archived_consistent check ((status = 'archived') = (archived_at is not null))
);
create index locations_org_client_status_idx on public.locations(organization_id, client_id, status, name);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  registration_plate text not null, internal_code text null, vehicle_type text not null, brand text null, model text null,
  capacity_kg numeric(12,2) null, capacity_m3 numeric(12,3) null, status public.fleet_asset_status not null default 'active',
  inspection_expires_at date null, insurance_expires_at date null, notes text null,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz null,
  constraint vehicles_required_not_blank check (btrim(registration_plate) <> '' and btrim(vehicle_type) <> '' and length(btrim(vehicle_type)) <= 100),
  constraint vehicles_capacity_non_negative check ((capacity_kg is null or capacity_kg >= 0) and (capacity_m3 is null or capacity_m3 >= 0)),
  constraint vehicles_archived_consistent check ((status = 'archived') = (archived_at is not null))
);
create unique index vehicles_plate_unique on public.vehicles(organization_id, upper(registration_plate));
create unique index vehicles_internal_code_unique on public.vehicles(organization_id, lower(internal_code)) where internal_code is not null;
create index vehicles_org_status_idx on public.vehicles(organization_id, status, registration_plate);

create table public.trailers (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  registration_plate text not null, internal_code text null, trailer_type text not null, brand text null, model text null,
  capacity_kg numeric(12,2) null, capacity_m3 numeric(12,3) null, status public.fleet_asset_status not null default 'active',
  inspection_expires_at date null, insurance_expires_at date null, notes text null,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz null,
  constraint trailers_required_not_blank check (btrim(registration_plate) <> '' and btrim(trailer_type) <> '' and length(btrim(trailer_type)) <= 100),
  constraint trailers_capacity_non_negative check ((capacity_kg is null or capacity_kg >= 0) and (capacity_m3 is null or capacity_m3 >= 0)),
  constraint trailers_archived_consistent check ((status = 'archived') = (archived_at is not null))
);
create unique index trailers_plate_unique on public.trailers(organization_id, upper(registration_plate));
create unique index trailers_internal_code_unique on public.trailers(organization_id, lower(internal_code)) where internal_code is not null;
create index trailers_org_status_idx on public.trailers(organization_id, status, registration_plate);

create table public.driver_vehicle_assignments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  driver_id uuid not null references public.drivers(id) on delete restrict, vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  starts_at timestamptz not null, ends_at timestamptz null, assigned_by uuid not null references public.profiles(user_id) on delete restrict,
  notes text null, created_at timestamptz not null default now(), constraint assignments_valid_period check (ends_at is null or ends_at > starts_at),
  exclude using gist (organization_id with =, driver_id with =, tstzrange(starts_at, coalesce(ends_at, 'infinity'::timestamptz), '[)') with &&),
  exclude using gist (organization_id with =, vehicle_id with =, tstzrange(starts_at, coalesce(ends_at, 'infinity'::timestamptz), '[)') with &&)
);
create index assignments_org_time_idx on public.driver_vehicle_assignments(organization_id, starts_at desc);

create function public.validate_master_data_tenant() returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare linked_org uuid; linked_role public.organization_role; driver_state public.driver_employment_status; vehicle_state public.fleet_asset_status;
begin
  if tg_table_name = 'drivers' and new.membership_id is not null then
    select organization_id, role into linked_org, linked_role from public.organization_memberships where id=new.membership_id;
    if linked_org is distinct from new.organization_id or linked_role is distinct from 'conductor' then raise exception using errcode='23514', message='driver membership must be a conductor in the same organization'; end if;
  elsif tg_table_name in ('client_contacts','locations') and new.client_id is not null then
    select organization_id into linked_org from public.clients where id=new.client_id;
    if linked_org is distinct from new.organization_id then raise exception using errcode='23514', message='client must belong to the same organization'; end if;
  elsif tg_table_name = 'driver_vehicle_assignments' then
    select organization_id, employment_status into linked_org, driver_state from public.drivers where id=new.driver_id;
    if linked_org is distinct from new.organization_id or driver_state is distinct from 'active' then raise exception using errcode='23514', message='driver must be active in the same organization'; end if;
    select organization_id, status into linked_org, vehicle_state from public.vehicles where id=new.vehicle_id;
    if linked_org is distinct from new.organization_id or vehicle_state is distinct from 'active' then raise exception using errcode='23514', message='vehicle must be active in the same organization'; end if;
  end if; return new;
end $$;
create trigger drivers_validate_tenant before insert or update on public.drivers for each row execute function public.validate_master_data_tenant();
create trigger contacts_validate_tenant before insert or update on public.client_contacts for each row execute function public.validate_master_data_tenant();
create trigger locations_validate_tenant before insert or update on public.locations for each row execute function public.validate_master_data_tenant();
create trigger assignments_validate_tenant before insert or update on public.driver_vehicle_assignments for each row execute function public.validate_master_data_tenant();

create function public.can_access_master_data(p_organization_id uuid, p_module_code text, p_write boolean default false) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select public.is_platform_superadmin() or (
   public.current_organization_is_active() and public.current_organization_id()=p_organization_id
   and (not p_write or public.current_organization_role()='admin_empresa')
   and public.current_organization_module_enabled(p_module_code)
 )
$$;
revoke all on function public.validate_master_data_tenant() from public;
revoke all on function public.can_access_master_data(uuid,text,boolean) from public;
grant execute on function public.can_access_master_data(uuid,text,boolean) to authenticated;

do $$ declare t text; begin foreach t in array array['drivers','clients','client_contacts','locations','vehicles','trailers','driver_vehicle_assignments'] loop
 if t <> 'driver_vehicle_assignments' then execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',t,t); end if;
 execute format('alter table public.%I enable row level security',t); execute format('alter table public.%I force row level security',t);
 execute format('revoke all on table public.%I from anon, authenticated',t); execute format('grant select on table public.%I to authenticated',t); execute format('grant all on table public.%I to service_role',t);
 end loop; end $$;

create policy drivers_read on public.drivers for select to authenticated using (public.can_access_master_data(organization_id,'transport_management'));
create policy clients_read on public.clients for select to authenticated using (public.can_access_master_data(organization_id,'client_management'));
create policy contacts_read on public.client_contacts for select to authenticated using (public.can_access_master_data(organization_id,'client_management'));
create policy locations_read on public.locations for select to authenticated using (public.can_access_master_data(organization_id,'client_management'));
create policy vehicles_read on public.vehicles for select to authenticated using (public.can_access_master_data(organization_id,'vehicle_management'));
create policy trailers_read on public.trailers for select to authenticated using (public.can_access_master_data(organization_id,'vehicle_management'));
create policy assignments_read on public.driver_vehicle_assignments for select to authenticated using (public.can_access_master_data(organization_id,'vehicle_management'));

comment on table public.drivers is 'Entidad operativa de conductor, independiente y opcionalmente vinculada a Auth mediante membership.';
comment on table public.driver_vehicle_assignments is 'Historial inmutable de asignaciones básicas; solo ends_at puede cerrarse mediante comando autorizado.';
commit;
