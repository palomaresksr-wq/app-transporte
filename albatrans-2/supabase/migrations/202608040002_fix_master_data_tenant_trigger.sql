begin;
create or replace function public.validate_master_data_tenant() returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare linked_org uuid; linked_role public.organization_role; driver_state public.driver_employment_status; vehicle_state public.fleet_asset_status;
begin
  if tg_table_name = 'drivers' then
    if new.membership_id is not null then
      select organization_id, role into linked_org, linked_role from public.organization_memberships where id=new.membership_id;
      if linked_org is distinct from new.organization_id or linked_role is distinct from 'conductor' then raise exception using errcode='23514', message='driver membership must be a conductor in the same organization'; end if;
    end if;
  elsif tg_table_name = 'client_contacts' then
    select organization_id into linked_org from public.clients where id=new.client_id;
    if linked_org is distinct from new.organization_id then raise exception using errcode='23514', message='client must belong to the same organization'; end if;
  elsif tg_table_name = 'locations' then
    if new.client_id is not null then
      select organization_id into linked_org from public.clients where id=new.client_id;
      if linked_org is distinct from new.organization_id then raise exception using errcode='23514', message='client must belong to the same organization'; end if;
    end if;
  elsif tg_table_name = 'driver_vehicle_assignments' then
    select organization_id, employment_status into linked_org, driver_state from public.drivers where id=new.driver_id;
    if linked_org is distinct from new.organization_id or driver_state is distinct from 'active' then raise exception using errcode='23514', message='driver must be active in the same organization'; end if;
    select organization_id, status into linked_org, vehicle_state from public.vehicles where id=new.vehicle_id;
    if linked_org is distinct from new.organization_id or vehicle_state is distinct from 'active' then raise exception using errcode='23514', message='vehicle must be active in the same organization'; end if;
  end if;
  return new;
end $$;
commit;
