begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,auth,pg_catalog;
select plan(23);

select has_table('billing_rates');
select has_table('transport_order_valuations');
select has_table('billing_preinvoices');
select has_table('billing_preinvoice_lines');
select enum_has_labels('public','transport_economic_status',array['unpriced','calculated','needs_recalculation','validated','prefactured','invoiced','cancelled']);
select is((select count(*)::integer from pg_class where relnamespace='public'::regnamespace and relname in ('billing_command_idempotency','billing_rates','billing_supplement_definitions','transport_order_billing_supplements','transport_order_pricing_adjustments','transport_order_valuations','billing_preinvoice_counters','billing_preinvoices','billing_preinvoice_lines') and relrowsecurity and relforcerowsecurity),9,'RLS forzada en todas las tablas privadas de billing');
select function_privs_are('public','persist_transport_order_valuation',array['uuid','audit_actor_scope','uuid','uuid','uuid','jsonb','jsonb','jsonb','numeric','numeric','numeric','numeric','text','uuid','uuid'],'authenticated',array[]::text[],'frontend no ejecuta persistencia económica');

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('a1000000-0000-4000-8000-000000000001','authenticated','authenticated','phase-g-platform@local','',now(),'{}','{}',now(),now()),
('a1000000-0000-4000-8000-000000000002','authenticated','authenticated','phase-g-admin@local','',now(),'{}','{}',now(),now());
insert into profiles(user_id,display_name) values ('a1000000-0000-4000-8000-000000000001','Platform G'),('a1000000-0000-4000-8000-000000000002','Admin G');
insert into platform_admins(user_id,role,status) values('a1000000-0000-4000-8000-000000000001','superadmin','active');
insert into organizations(id,legal_name,trade_name,status,created_by) values
('a2000000-0000-4000-8000-000000000001','Fase G A','Fase G A','active','a1000000-0000-4000-8000-000000000001'),
('a2000000-0000-4000-8000-000000000002','Fase G B','Fase G B','active','a1000000-0000-4000-8000-000000000001');
insert into organization_memberships(organization_id,user_id,role,status,joined_at) values('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','admin_empresa','active',now());
insert into organization_module_overrides(organization_id,module_id,override_mode,changed_by,reason) select 'a2000000-0000-4000-8000-000000000001',id,'enabled','a1000000-0000-4000-8000-000000000001','Fase G' from modules where code='billing';
select ok(billing_actor_authorized('a1000000-0000-4000-8000-000000000002','organization','a2000000-0000-4000-8000-000000000001',true),'admin_empresa autorizado desde conexión backend');
insert into clients(id,organization_id,legal_name,trade_name,created_by) values
('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','Cliente G A','Cliente G A','a1000000-0000-4000-8000-000000000001'),
('a3000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000002','Cliente G B','Cliente G B','a1000000-0000-4000-8000-000000000001');
insert into transport_orders(id,organization_id,order_number,customer_id,transport_type,billable_km,planned_pickup_at,created_by) values
('a4000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','G-1','a3000000-0000-4000-8000-000000000001','General',100,'2026-08-01 08:00Z','a1000000-0000-4000-8000-000000000001');
insert into billing_rates(id,organization_id,client_id,name,valid_from,currency_code,version_group_id,components_json,created_by) values
('a5000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','Tarifa congelada','2026-01-01','EUR','a5000000-0000-4000-8000-000000000010','[{"componentKind":"base","amount":"100.00"}]','a1000000-0000-4000-8000-000000000001');
select throws_ok($$insert into billing_rates(organization_id,client_id,name,valid_from,version_group_id,components_json,created_by) values('a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000002','Cruzada','2026-01-01','a5000000-0000-4000-8000-000000000099','[]','a1000000-0000-4000-8000-000000000001')$$,'23514',null,'rechaza tarifa de otro tenant');

select lives_ok($$select persist_transport_order_valuation('a1000000-0000-4000-8000-000000000001','platform','a2000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001','{"name":"Tarifa congelada","versionNumber":1}','{"serviceDate":"2026-08-01","billableKm":100}','{"lines":[]}',100,0,0,100,'EUR','a6000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001')$$,'persiste valoración atómica');
select is((select economic_status::text from transport_orders where id='a4000000-0000-4000-8000-000000000001'),'calculated','orden queda calculada');
select is((select total_amount from transport_order_valuations where transport_order_id='a4000000-0000-4000-8000-000000000001'),100.00::numeric,'total monetario exacto');
select is((select input_snapshot_json->>'serviceDate' from transport_order_valuations where transport_order_id='a4000000-0000-4000-8000-000000000001'),'2026-08-01','snapshot conserva fecha económica');
select is((select count(*)::integer from audit_events where correlation_id='a6000000-0000-4000-8000-000000000001'),1,'valoración auditada');
select is((select count(*)::integer from transport_events where correlation_id='a6000000-0000-4000-8000-000000000001'),1,'valoración trazada en timeline');
select lives_ok($$select persist_transport_order_valuation('a1000000-0000-4000-8000-000000000001','platform','a2000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001','{"name":"Tarifa congelada","versionNumber":1}','{"serviceDate":"2026-08-01","billableKm":100}','{"lines":[]}',100,0,0,100,'EUR','a6000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001')$$,'reintento idempotente');
select is((select count(*)::integer from transport_order_valuations where transport_order_id='a4000000-0000-4000-8000-000000000001'),1,'reintento no duplica valoración');
select lives_ok($$select validate_transport_order_valuation('a1000000-0000-4000-8000-000000000001','platform','a2000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','validada','a6000000-0000-4000-8000-000000000002','a7000000-0000-4000-8000-000000000002')$$,'valida valoración');
update transport_orders set billable_km=101 where id='a4000000-0000-4000-8000-000000000001';
select is((select economic_status::text from transport_orders where id='a4000000-0000-4000-8000-000000000001'),'needs_recalculation','cambio económico invalida valoración validada');
select is((select total_amount from transport_order_valuations where transport_order_id='a4000000-0000-4000-8000-000000000001'),100.00::numeric,'snapshot histórico no se altera');
update transport_orders set economic_status='prefactured' where id='a4000000-0000-4000-8000-000000000001';
select throws_ok($$update transport_orders set billable_km=102 where id='a4000000-0000-4000-8000-000000000001'$$,'55000','economic inputs are locked after preinvoicing','bloquea cambios tras prefacturar');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from billing_rates),1,'RLS permite billing del tenant habilitado');
select throws_ok($$insert into billing_rates(organization_id,client_id,name,valid_from,version_group_id,components_json,created_by) values('a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','Directa','2026-01-01','a5000000-0000-4000-8000-000000000088','[]','a1000000-0000-4000-8000-000000000002')$$,'42501',null,'frontend no escribe tarifas directamente');
reset role;

select * from finish();
rollback;
