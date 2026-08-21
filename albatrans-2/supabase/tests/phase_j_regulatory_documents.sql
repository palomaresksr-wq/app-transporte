begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,auth,pg_catalog;
select no_plan();
select has_table('transport_regulatory_documents');
select has_table('transport_regulatory_revisions');
select has_table('transport_regulatory_evidence');
select has_table('regulatory_document_outbox');
select has_table('regulatory_command_idempotency');
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid='transport_regulatory_documents'::regclass),true,'RLS forced on regulatory documents');
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid='transport_regulatory_revisions'::regclass),true,'RLS forced on revisions');
select function_privs_are('public','create_regulatory_document',array['uuid','audit_actor_scope','uuid','uuid','regulatory_document_type','uuid','uuid'],'authenticated',array[]::text[],'frontend cannot execute create RPC directly');
select function_privs_are('public','issue_transport_regulatory_document',array['uuid','audit_actor_scope','uuid','uuid','uuid','uuid'],'anon',array[]::text[],'anon cannot issue');

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('d1000000-0000-4000-8000-000000000001','authenticated','authenticated','reg-admin-a@local','',now(),'{}','{}',now(),now()),
('d1000000-0000-4000-8000-000000000002','authenticated','authenticated','reg-driver-a@local','',now(),'{}','{}',now(),now()),
('d1000000-0000-4000-8000-000000000003','authenticated','authenticated','reg-admin-b@local','',now(),'{}','{}',now(),now());
insert into profiles(user_id,display_name) values ('d1000000-0000-4000-8000-000000000001','Reg Admin A'),('d1000000-0000-4000-8000-000000000002','Reg Driver A'),('d1000000-0000-4000-8000-000000000003','Reg Admin B');
insert into organizations(id,legal_name,trade_name,tax_id,status,created_by) values
('d2000000-0000-4000-8000-000000000001','Transportes Demo SL','Demo Regulatory','A00000001','active','d1000000-0000-4000-8000-000000000001'),
('d2000000-0000-4000-8000-000000000002','Otro Tenant SL','Otro Tenant','B00000002','active','d1000000-0000-4000-8000-000000000003');
insert into organization_memberships(id,organization_id,user_id,role,status,joined_at) values
('d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','admin_empresa','active',now()),
('d3000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002','conductor','active',now()),
('d3000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000003','admin_empresa','active',now());
insert into organization_module_overrides(organization_id,module_id,override_mode,changed_by,reason)
select o,m.id,'enabled',u,'phase j test' from (values('d2000000-0000-4000-8000-000000000001'::uuid,'d1000000-0000-4000-8000-000000000001'::uuid),('d2000000-0000-4000-8000-000000000002'::uuid,'d1000000-0000-4000-8000-000000000003'::uuid)) x(o,u) cross join modules m where m.code in('electronic_delivery_notes','transport_management','document_management');
insert into clients(id,organization_id,legal_name,trade_name,tax_id,created_by) values
('d4000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','Cliente Destino SL','Cliente Destino','C00000003','d1000000-0000-4000-8000-000000000001'),
('d4000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000002','Cliente B','Cliente B','D00000004','d1000000-0000-4000-8000-000000000003');
insert into drivers(id,organization_id,membership_id,first_name,last_name,display_name,employment_status,created_by) values ('d5000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000002','Driver','Local','Driver Local','active','d1000000-0000-4000-8000-000000000001');
insert into vehicles(id,organization_id,registration_plate,vehicle_type,status,created_by) values ('d6000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','REG0001','truck','active','d1000000-0000-4000-8000-000000000001');
insert into locations(id,organization_id,name,address_line_1,postal_code,city,country_code,created_by) values
('da000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','Origen','Calle Madrid 1','28001','Madrid','ES','d1000000-0000-4000-8000-000000000001'),
('da000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','Destino','Calle Barcelona 1','08001','Barcelona','ES','d1000000-0000-4000-8000-000000000001');
insert into transport_orders(id,organization_id,order_number,customer_id,transport_type,assigned_driver_id,assigned_vehicle_id,created_by) values
('d7000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','TR-REG-001','d4000000-0000-4000-8000-000000000001','general','d5000000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001'),
('d7000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000002','TR-REG-B','d4000000-0000-4000-8000-000000000002','general',null,null,'d1000000-0000-4000-8000-000000000003');
insert into transport_stops(id,organization_id,transport_order_id,position,stop_type,location_id,created_by) values
('db000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','d7000000-0000-4000-8000-000000000001',1,'pickup','da000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001'),
('db000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','d7000000-0000-4000-8000-000000000001',2,'delivery','da000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001');
insert into transport_items(id,organization_id,transport_order_id,stop_id,description,pallets,packages,weight_kg,created_by) values ('dc000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','d7000000-0000-4000-8000-000000000001','db000000-0000-4000-8000-000000000001','Mercancía demo',10,10,2500,'d1000000-0000-4000-8000-000000000001');

set local role service_role; select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"service_role"}',true);
select lives_ok($$select create_regulatory_document('d1000000-0000-4000-8000-000000000001','organization','d2000000-0000-4000-8000-000000000001','d7000000-0000-4000-8000-000000000001','control_document','dd000000-0000-4000-8000-000000000001','de000000-0000-4000-8000-000000000001')$$,'creates draft atomically');
select is((select count(*)::integer from transport_regulatory_documents where organization_id='d2000000-0000-4000-8000-000000000001'),1,'one draft created');
select lives_ok($$select create_regulatory_document('d1000000-0000-4000-8000-000000000001','organization','d2000000-0000-4000-8000-000000000001','d7000000-0000-4000-8000-000000000001','control_document','dd000000-0000-4000-8000-000000000001','de000000-0000-4000-8000-000000000001')$$,'same create key is idempotent');
select is((select count(*)::integer from transport_regulatory_documents where organization_id='d2000000-0000-4000-8000-000000000001'),1,'idempotent retry has no effect');
select ok((select (validate_regulatory_snapshot(current_snapshot_json)->>'complete')::boolean from transport_regulatory_documents limit 1),'snapshot complete');
select lives_ok($$select issue_transport_regulatory_document('d1000000-0000-4000-8000-000000000001','organization','d2000000-0000-4000-8000-000000000001',(select id from transport_regulatory_documents limit 1),'dd000000-0000-4000-8000-000000000002','de000000-0000-4000-8000-000000000002')$$,'issues validated document');
select matches((select document_number from transport_regulatory_documents limit 1),'^DC-[0-9]{4}-[0-9]{6}$','transactional DC number');
select matches((select content_hash from transport_regulatory_documents limit 1),'^[0-9a-f]{64}$','content hash stored');
select is((select count(*)::integer from transport_events where event_type='regulatory_document.issued'),1,'timeline issued once');
select is((select count(*)::integer from audit_events where action='regulatory_document.issued'),1,'audit issued once');
select throws_ok($$update transport_regulatory_revisions set snapshot_json='{}' where revision_number=1$$,'55000',null,'revision immutable');
select lives_ok($$select create_regulatory_revision('d1000000-0000-4000-8000-000000000001','organization','d2000000-0000-4000-8000-000000000001',(select id from transport_regulatory_documents limit 1),'Cambio de matrícula','dd000000-0000-4000-8000-000000000003','de000000-0000-4000-8000-000000000003')$$,'creates amendment revision');
select is((select revision_number from transport_regulatory_documents limit 1),2,'revision increments under lock');
select is((select count(*)::integer from transport_regulatory_revisions),2,'prior revision retained');
reset role;
set local role authenticated; select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::integer from transport_regulatory_documents),1,'admin sees own tenant only'); reset role;
set local role authenticated; select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from transport_regulatory_documents),1,'assigned driver sees current order document'); reset role;
update transport_orders set assigned_driver_id=null,assigned_vehicle_id=null where id='d7000000-0000-4000-8000-000000000001';
set local role authenticated; select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from transport_regulatory_documents),0,'unassigned driver immediately loses historical access');
select * from finish(); rollback;
