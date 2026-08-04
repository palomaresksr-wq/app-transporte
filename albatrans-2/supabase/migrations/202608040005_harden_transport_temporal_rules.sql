-- Endurecimiento aditivo detectado al validar la integración temporal de Fase B.
create or replace function public.validate_transport_child_tenant() returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare order_org uuid; order_state public.transport_order_status; order_start timestamptz; order_end timestamptz; linked_org uuid; linked_state text;
begin
  select organization_id,status,planned_pickup_at,planned_delivery_at into order_org,order_state,order_start,order_end from public.transport_orders where id=new.transport_order_id;
  if order_org is distinct from new.organization_id then raise exception using errcode='23514',message='transport order must belong to same organization'; end if;
  if tg_table_name in ('transport_stops','transport_items') and order_state in ('completed','cancelled','archived') then raise exception using errcode='23514',message='terminal transport order children are immutable'; end if;
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
    if order_start is null or order_end is null or new.starts_at>order_start or new.ends_at<order_end then raise exception using errcode='23514',message='assignment must cover the complete planned order window'; end if;
  end if;
  return new;
end $$;

create or replace function public.validate_transport_order_transition() returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if old.status=new.status then
    if old.status in ('completed','cancelled','archived') then raise exception using errcode='23514',message='terminal transport order is immutable'; end if;
    return new;
  end if;
  if not ((old.status='draft' and new.status in ('planned','cancelled')) or (old.status='planned' and new.status in ('assigned','cancelled')) or (old.status='assigned' and new.status in ('loading','cancelled')) or (old.status='loading' and new.status in ('in_transit','cancelled')) or (old.status='in_transit' and new.status in ('unloading','cancelled')) or (old.status='unloading' and new.status in ('completed','cancelled')) or (old.status in ('completed','cancelled') and new.status='archived')) then raise exception using errcode='23514',message='invalid transport order transition'; end if;
  if new.status='planned' and (new.planned_pickup_at is null or new.planned_delivery_at is null) then raise exception using errcode='23514',message='planned order requires a complete planned window'; end if;
  if new.status='assigned' and (new.assigned_driver_id is null or not exists(select 1 from public.transport_assignments a where a.transport_order_id=new.id and a.driver_id=new.assigned_driver_id and a.vehicle_id=new.assigned_vehicle_id and a.unassigned_at is null)) then raise exception using errcode='23514',message='assigned order requires an active assignment'; end if;
  if new.status='archived' then new.archived_at:=statement_timestamp(); end if;
  return new;
end $$;
