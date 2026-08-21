begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,auth,pg_catalog;
select no_plan();
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('91000000-0000-4000-8000-000000000001','authenticated','authenticated','driver-a@local','',now(),'{}','{}',now(),now()),
('91000000-0000-4000-8000-000000000002','authenticated','authenticated','driver-b@local','',now(),'{}','{}',now(),now()),
('91000000-0000-4000-8000-000000000003','authenticated','authenticated','driver-c@local','',now(),'{}','{}',now(),now()),
('91000000-0000-4000-8000-000000000004','authenticated','authenticated','admin-i@local','',now(),'{}','{}',now(),now());
insert into profiles(user_id,display_name) values
('91000000-0000-4000-8000-000000000001','Driver A'),('91000000-0000-4000-8000-000000000002','Driver B'),
('91000000-0000-4000-8000-000000000003','Driver C'),('91000000-0000-4000-8000-000000000004','Admin I');
insert into organizations(id,legal_name,trade_name,status,created_by) values
('92000000-0000-4000-8000-000000000001','Org I A','Org I A','active','91000000-0000-4000-8000-000000000004'),
('92000000-0000-4000-8000-000000000002','Org I B','Org I B','active','91000000-0000-4000-8000-000000000004');
insert into organization_memberships(id,organization_id,user_id,role,status,joined_at) values
('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','conductor','active',now()),
('93000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','conductor','active',now()),
('93000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000003','conductor','active',now()),
('93000000-0000-4000-8000-000000000004','92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000004','admin_empresa','active',now());
insert into organization_module_overrides(organization_id,module_id,override_mode,changed_by,reason)
select o,m.id,'enabled','91000000-0000-4000-8000-000000000004','phase i test' from (values('92000000-0000-4000-8000-000000000001'::uuid),('92000000-0000-4000-8000-000000000002'::uuid)) x(o) cross join modules m where m.code in('transport_management','transport_execution','document_management','pod_signature');
insert into clients(id,organization_id,legal_name,trade_name,created_by) values
('94000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Client A','Client A','91000000-0000-4000-8000-000000000004'),
('94000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','Client B','Client B','91000000-0000-4000-8000-000000000004');
insert into drivers(id,organization_id,membership_id,first_name,last_name,display_name,employment_status,created_by) values
('95000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','A','Driver','A Driver','active','91000000-0000-4000-8000-000000000004'),
('95000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002','B','Driver','B Driver','active','91000000-0000-4000-8000-000000000004'),
('95000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000003','C','Driver','C Driver','active','91000000-0000-4000-8000-000000000004');
insert into vehicles(id,organization_id,registration_plate,vehicle_type,status,created_by) values
('96000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','I1000AA','truck','active','91000000-0000-4000-8000-000000000004'),
('96000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','I2000AA','truck','active','91000000-0000-4000-8000-000000000004');
insert into transport_orders(id,organization_id,order_number,customer_id,transport_type,assigned_driver_id,assigned_vehicle_id,created_by) values
('97000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','I-A','94000000-0000-4000-8000-000000000001','general','95000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000004'),
('97000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','I-B','94000000-0000-4000-8000-000000000001','general','95000000-0000-4000-8000-000000000002','96000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000004'),
('97000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000002','I-C','94000000-0000-4000-8000-000000000002','general','95000000-0000-4000-8000-000000000003','96000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000004');
insert into transport_executions(id,organization_id,transport_order_id,status,created_by) values
('98000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000001','driver_notified','91000000-0000-4000-8000-000000000004');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::integer from transport_orders),1,'driver A reads only assigned order');
select ok(exists(select 1 from transport_orders where id='97000000-0000-4000-8000-000000000001'),'assigned order visible');
select ok(not public.driver_has_order_access('97000000-0000-4000-8000-000000000002','transport_management'),'same-tenant driver order denied');
select ok(not public.driver_has_order_access('97000000-0000-4000-8000-000000000003','transport_management'),'cross-tenant order denied');
select throws_ok($$select execute_driver_transport_operation('91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000002','execution','heading_to_pickup','{}','99000000-0000-4000-8000-000000000001','9a000000-0000-4000-8000-000000000001')$$,'42501',null,'IDOR command denied');
select lives_ok($$select execute_driver_transport_operation('91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000001','execution','heading_to_pickup','{}','99000000-0000-4000-8000-000000000002','9a000000-0000-4000-8000-000000000002')$$,'assigned command accepted');
select is((select status::text from transport_executions where transport_order_id='97000000-0000-4000-8000-000000000001'),'heading_to_pickup','state trigger reused');
select is((select count(*)::integer from transport_events where correlation_id='99000000-0000-4000-8000-000000000002'),1,'timeline created once');
select lives_ok($$select execute_driver_transport_operation('91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000001','execution','heading_to_pickup','{}','99000000-0000-4000-8000-000000000002','9a000000-0000-4000-8000-000000000002')$$,'idempotent retry accepted');
select is((select count(*)::integer from transport_events where correlation_id='99000000-0000-4000-8000-000000000002'),1,'retry has no duplicate effect');
reset role;
update organization_memberships set status='blocked' where id='93000000-0000-4000-8000-000000000001';
set local role authenticated; select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::integer from transport_orders),0,'blocked membership loses RLS access'); reset role;
update organization_memberships set status='active' where id='93000000-0000-4000-8000-000000000001'; update profiles set status='blocked' where user_id='91000000-0000-4000-8000-000000000001';
set local role authenticated; select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::integer from transport_orders),0,'blocked profile loses RLS access'); reset role;
update profiles set status='active' where user_id='91000000-0000-4000-8000-000000000001'; update drivers set employment_status='inactive' where id='95000000-0000-4000-8000-000000000001';
set local role authenticated; select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::integer from transport_orders),0,'inactive driver loses RLS access'); reset role;
update drivers set employment_status='active' where id='95000000-0000-4000-8000-000000000001'; update organizations set status='suspended',status_reason='security test' where id='92000000-0000-4000-8000-000000000001';
set local role authenticated; select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::integer from transport_orders),0,'inactive organization loses RLS access'); reset role;
update organizations set status='active',status_reason=null where id='92000000-0000-4000-8000-000000000001'; update organization_module_overrides set override_mode='disabled' where organization_id='92000000-0000-4000-8000-000000000001' and module_id=(select id from modules where code='transport_execution');
set local role authenticated; select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select ok(not public.driver_has_order_access('97000000-0000-4000-8000-000000000001','transport_execution'),'disabled module denies execution'); reset role;
update organization_module_overrides set override_mode='enabled' where organization_id='92000000-0000-4000-8000-000000000001' and module_id=(select id from modules where code='transport_execution'); update transport_orders set assigned_driver_id='95000000-0000-4000-8000-000000000002' where id='97000000-0000-4000-8000-000000000001';
set local role authenticated; select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::integer from transport_orders),0,'reassignment immediately revokes read');
select throws_ok($$select execute_driver_transport_operation('91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000001','execution','arrived_pickup','{}','99000000-0000-4000-8000-000000000003','9a000000-0000-4000-8000-000000000003')$$,'42501',null,'open screen cannot command after reassignment');
select * from finish(); rollback;
