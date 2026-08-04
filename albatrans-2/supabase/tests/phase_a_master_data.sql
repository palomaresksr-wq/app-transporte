begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,auth,pg_catalog;
select plan(22);
select has_table('drivers'); select has_table('clients'); select has_table('client_contacts');
select has_table('locations'); select has_table('vehicles'); select has_table('trailers'); select has_table('driver_vehicle_assignments');
select enum_has_labels('public','driver_employment_status',array['pending','active','inactive','on_leave','terminated','archived']);
select enum_has_labels('public','master_data_status',array['active','inactive','archived']);
select enum_has_labels('public','fleet_asset_status',array['active','inactive','maintenance','archived']);
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('aa000000-0000-4000-8000-000000000001','authenticated','authenticated','a@phase.local','',now(),'{}','{}',now(),now()),
('aa000000-0000-4000-8000-000000000002','authenticated','authenticated','b@phase.local','',now(),'{}','{}',now(),now());
insert into profiles(user_id,display_name) values('aa000000-0000-4000-8000-000000000001','A'),('aa000000-0000-4000-8000-000000000002','B');
insert into organizations(id,legal_name,status,created_by) values
('ab000000-0000-4000-8000-000000000001','Empresa A','active','aa000000-0000-4000-8000-000000000001'),
('ab000000-0000-4000-8000-000000000002','Empresa B','active','aa000000-0000-4000-8000-000000000002');
insert into organization_memberships(id,organization_id,user_id,role,status,joined_at) values
('ac000000-0000-4000-8000-000000000001','ab000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000001','conductor','active',now()),
('ac000000-0000-4000-8000-000000000002','ab000000-0000-4000-8000-000000000002','aa000000-0000-4000-8000-000000000002','conductor','active',now());
insert into drivers(id,organization_id,membership_id,first_name,last_name,display_name,employment_status,created_by) values
('ad000000-0000-4000-8000-000000000001','ab000000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000001','Ana','A','Ana A','active','aa000000-0000-4000-8000-000000000001'),
('ad000000-0000-4000-8000-000000000002','ab000000-0000-4000-8000-000000000002','ac000000-0000-4000-8000-000000000002','Bea','B','Bea B','active','aa000000-0000-4000-8000-000000000002');
select throws_ok($$insert into drivers(organization_id,membership_id,first_name,last_name,display_name,created_by) values('ab000000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000002','X','X','X','aa000000-0000-4000-8000-000000000001')$$,'23514',null,'membership cruzada rechazada');
insert into clients(id,organization_id,legal_name,trade_name,created_by) values('ae000000-0000-4000-8000-000000000001','ab000000-0000-4000-8000-000000000001','Cliente A','Cliente A','aa000000-0000-4000-8000-000000000001');
select throws_ok($$insert into client_contacts(organization_id,client_id,name,created_by) values('ab000000-0000-4000-8000-000000000002','ae000000-0000-4000-8000-000000000001','Cruzado','aa000000-0000-4000-8000-000000000002')$$,'23514',null,'contacto cruzado rechazado');
select throws_ok($$insert into locations(organization_id,name,address_line_1,postal_code,city,country_code,latitude,longitude,created_by) values('ab000000-0000-4000-8000-000000000001','Mala','Calle','1','Madrid','ES',91,0,'aa000000-0000-4000-8000-000000000001')$$,'23514',null,'coordenadas inválidas rechazadas');
insert into vehicles(id,organization_id,registration_plate,vehicle_type,status,created_by) values
('af000000-0000-4000-8000-000000000001','ab000000-0000-4000-8000-000000000001','AAA1','Camión','active','aa000000-0000-4000-8000-000000000001'),
('af000000-0000-4000-8000-000000000002','ab000000-0000-4000-8000-000000000001','AAA2','Camión','active','aa000000-0000-4000-8000-000000000001');
insert into driver_vehicle_assignments(organization_id,driver_id,vehicle_id,starts_at,assigned_by) values('ab000000-0000-4000-8000-000000000001','ad000000-0000-4000-8000-000000000001','af000000-0000-4000-8000-000000000001','2026-01-01','aa000000-0000-4000-8000-000000000001');
select throws_ok($$insert into driver_vehicle_assignments(organization_id,driver_id,vehicle_id,starts_at,assigned_by) values('ab000000-0000-4000-8000-000000000001','ad000000-0000-4000-8000-000000000001','af000000-0000-4000-8000-000000000002','2026-02-01','aa000000-0000-4000-8000-000000000001')$$,'23P01',null,'solapamiento de conductor rechazado');
update drivers set employment_status='inactive' where id='ad000000-0000-4000-8000-000000000001';
select lives_ok($$update driver_vehicle_assignments set ends_at='2026-03-01' where driver_id='ad000000-0000-4000-8000-000000000001'$$,'una asignación puede finalizarse tras inactivar el conductor');
select throws_ok($$insert into driver_vehicle_assignments(organization_id,driver_id,vehicle_id,starts_at,ends_at,assigned_by) values('ab000000-0000-4000-8000-000000000001','ad000000-0000-4000-8000-000000000001','af000000-0000-4000-8000-000000000002','2025-01-01','2025-02-01','aa000000-0000-4000-8000-000000000001')$$,'23514',null,'conductor inactivo rechazado');
select throws_ok($$insert into vehicles(organization_id,registration_plate,vehicle_type,capacity_kg,created_by) values('ab000000-0000-4000-8000-000000000001','NEG','Camión',-1,'aa000000-0000-4000-8000-000000000001')$$,'23514',null,'capacidad negativa rechazada');
select is((select count(*)::integer from information_schema.role_table_grants where grantee='anon' and table_schema='public' and table_name in ('drivers','clients','client_contacts','locations','vehicles','trailers','driver_vehicle_assignments')),0,'anon no tiene grants');
select is((select count(*)::integer from pg_class where relnamespace='public'::regnamespace and relname in ('drivers','clients','client_contacts','locations','vehicles','trailers','driver_vehicle_assignments') and relrowsecurity and relforcerowsecurity),7,'RLS forzada en todas las tablas');
update organization_memberships set role='admin_empresa' where id='ac000000-0000-4000-8000-000000000001';
insert into organization_module_overrides(organization_id,module_id,override_mode,changed_by,reason)
select 'ab000000-0000-4000-8000-000000000001',id,case when code='client_management' then 'enabled'::module_override_mode else 'disabled'::module_override_mode end,'aa000000-0000-4000-8000-000000000001','Prueba RLS'
from modules where code in ('client_management','vehicle_management');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aa000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::integer from clients),1,'admin solo ve clientes de su organizaciÃ³n con mÃ³dulo activo');
select is((select count(*)::integer from vehicles),0,'mÃ³dulo desactivado bloquea lectura directa por RLS');
select throws_ok($$insert into clients(organization_id,legal_name,trade_name,created_by) values('ab000000-0000-4000-8000-000000000001','Cliente RLS','Cliente RLS','aa000000-0000-4000-8000-000000000001')$$,'42501',null,'el frontend no puede escribir directamente; debe usar la Edge Function');
reset role;
select * from finish(); rollback;
