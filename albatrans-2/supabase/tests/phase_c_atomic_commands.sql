begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,auth,pg_catalog;
select plan(38);
select has_table('transport_command_idempotency');
select has_function('public','execute_transport_operation',array['uuid','audit_actor_scope','uuid','uuid','text','text','uuid','text','jsonb','text','uuid','uuid']);
select is_definer('public','execute_transport_operation',array['uuid','audit_actor_scope','uuid','uuid','text','text','uuid','text','jsonb','text','uuid','uuid'],'comando usa definer controlado');
select function_privs_are('public','execute_transport_operation',array['uuid','audit_actor_scope','uuid','uuid','text','text','uuid','text','jsonb','text','uuid','uuid'],'service_role',array['EXECUTE'],'solo backend ejecuta el comando');
select function_privs_are('public','execute_transport_operation',array['uuid','audit_actor_scope','uuid','uuid','text','text','uuid','text','jsonb','text','uuid','uuid'],'authenticated',array[]::text[],'frontend no ejecuta RPC');
select has_trigger('public','audit_events','audit_events_immutable','auditoría tiene trigger append-only');
select has_function('public','prevent_audit_event_mutation',array[]::text[],'función de inmutabilidad de auditoría presente');

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('ca000000-0000-4000-8000-000000000001','authenticated','authenticated','phase-c-platform@local','',now(),'{}','{}',now(),now()),
('ca000000-0000-4000-8000-000000000002','authenticated','authenticated','phase-c-admin@local','',now(),'{}','{}',now(),now()),
('ca000000-0000-4000-8000-000000000003','authenticated','authenticated','phase-c-denied@local','',now(),'{}','{}',now(),now());
insert into profiles(user_id,display_name) values ('ca000000-0000-4000-8000-000000000001','Platform'),('ca000000-0000-4000-8000-000000000002','Admin'),('ca000000-0000-4000-8000-000000000003','Denied');
insert into platform_admins(user_id,role,status) values('ca000000-0000-4000-8000-000000000001','superadmin','active');
insert into organizations(id,legal_name,trade_name,status,created_by) values
('cb000000-0000-4000-8000-000000000001','Fase C A','Fase C A','active','ca000000-0000-4000-8000-000000000001'),
('cb000000-0000-4000-8000-000000000002','Fase C B','Fase C B','active','ca000000-0000-4000-8000-000000000001');
insert into organization_memberships(organization_id,user_id,role,status,joined_at) values('cb000000-0000-4000-8000-000000000001','ca000000-0000-4000-8000-000000000002','admin_empresa','active',now());
insert into organization_module_overrides(organization_id,module_id,override_mode,changed_by,reason) select 'cb000000-0000-4000-8000-000000000001',id,'enabled','ca000000-0000-4000-8000-000000000001','test' from modules where code='transport_execution';
insert into clients(id,organization_id,legal_name,trade_name,created_by) values('cc000000-0000-4000-8000-000000000001','cb000000-0000-4000-8000-000000000001','Cliente A','Cliente A','ca000000-0000-4000-8000-000000000001'),('cc000000-0000-4000-8000-000000000002','cb000000-0000-4000-8000-000000000002','Cliente B','Cliente B','ca000000-0000-4000-8000-000000000001');
insert into transport_orders(id,organization_id,order_number,customer_id,transport_type,created_by) values
('cd000000-0000-4000-8000-000000000001','cb000000-0000-4000-8000-000000000001','C-1','cc000000-0000-4000-8000-000000000001','General','ca000000-0000-4000-8000-000000000001'),
('cd000000-0000-4000-8000-000000000002','cb000000-0000-4000-8000-000000000001','C-2','cc000000-0000-4000-8000-000000000001','General','ca000000-0000-4000-8000-000000000001'),
('cd000000-0000-4000-8000-000000000003','cb000000-0000-4000-8000-000000000001','C-3','cc000000-0000-4000-8000-000000000001','General','ca000000-0000-4000-8000-000000000001'),
('cd000000-0000-4000-8000-000000000004','cb000000-0000-4000-8000-000000000001','C-4','cc000000-0000-4000-8000-000000000001','General','ca000000-0000-4000-8000-000000000001');

select lives_ok($$select execute_transport_operation('ca000000-0000-4000-8000-000000000001','platform','cb000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000001','execution','start',null,null,'{}',null,'ce000000-0000-4000-8000-000000000001','cf000000-0000-4000-8000-000000000001')$$,'inicia ejecución atómica');
select is((select status::text from transport_executions where transport_order_id='cd000000-0000-4000-8000-000000000001'),'pending','estado inicial correcto');
select is((select count(*)::integer from transport_events where transport_order_id='cd000000-0000-4000-8000-000000000001'),1,'crea timeline');
select is((select count(*)::integer from audit_events where correlation_id='ce000000-0000-4000-8000-000000000001'),1,'crea auditoría');
select throws_ok($$delete from audit_events where correlation_id='ce000000-0000-4000-8000-000000000001'$$,'55000',null,'auditoría no se puede borrar');
select is((select count(*)::integer from internal_notifications where transport_order_id='cd000000-0000-4000-8000-000000000001'),1,'crea notificación');
select throws_ok($$select execute_transport_operation('ca000000-0000-4000-8000-000000000001','platform','cb000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000001','execution','transition',null,'loading','{}',null,'ce000000-0000-4000-8000-000000000002','cf000000-0000-4000-8000-000000000002')$$,'23514',null,'rechaza salto imposible');
select is((select status::text from transport_executions where transport_order_id='cd000000-0000-4000-8000-000000000001'),'pending','salto inválido no muta');
select lives_ok($$select execute_transport_operation('ca000000-0000-4000-8000-000000000001','platform','cb000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000001','execution','transition',null,'cancelled','{}','cancelación','ce000000-0000-4000-8000-000000000003','cf000000-0000-4000-8000-000000000003')$$,'permite cancelación');
select isnt((select cancelled_at::text from transport_executions where transport_order_id='cd000000-0000-4000-8000-000000000001'),null,'timestamp cancelación automático');
select throws_ok($$select execute_transport_operation('ca000000-0000-4000-8000-000000000001','platform','cb000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000001','execution','transition',null,'pending','{}',null,'ce000000-0000-4000-8000-000000000004','cf000000-0000-4000-8000-000000000004')$$,'23514',null,'cancelada es terminal');

select lives_ok($$select execute_transport_operation('ca000000-0000-4000-8000-000000000001','platform','cb000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000002','execution','start',null,null,'{}',null,'ce000000-0000-4000-8000-000000000010','cf000000-0000-4000-8000-000000000010')$$,'prepara segunda ejecución');
select lives_ok($$select execute_transport_operation('ca000000-0000-4000-8000-000000000001','platform','cb000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000002','incident','create',null,null,'{"severity":"high","category":"delay","title":"Retraso","description":"Tráfico"}',null,'ce000000-0000-4000-8000-000000000011','cf000000-0000-4000-8000-000000000011')$$,'crea incidencia');
select lives_ok(format($$select execute_transport_operation('ca000000-0000-4000-8000-000000000001','platform','cb000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000002','incident','update','%s','in_progress','{"description":"Actualizada"}',null,'ce000000-0000-4000-8000-000000000012','cf000000-0000-4000-8000-000000000012')$$,(select id from transport_incidents where transport_order_id='cd000000-0000-4000-8000-000000000002')),'actualiza incidencia');
select lives_ok(format($$select execute_transport_operation('ca000000-0000-4000-8000-000000000001','platform','cb000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000002','incident','transition','%s','resolved','{"resolution_notes":"Resuelta"}',null,'ce000000-0000-4000-8000-000000000013','cf000000-0000-4000-8000-000000000013')$$,(select id from transport_incidents where transport_order_id='cd000000-0000-4000-8000-000000000002')),'resuelve incidencia');
select isnt((select resolved_at::text from transport_incidents where transport_order_id='cd000000-0000-4000-8000-000000000002'),null,'resolución registra timestamp');
select lives_ok($$select execute_transport_operation('ca000000-0000-4000-8000-000000000001','platform','cb000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000002','note','create',null,null,'{"body":"Nota","note_type":"operational","visible_admin":true}',null,'ce000000-0000-4000-8000-000000000014','cf000000-0000-4000-8000-000000000014')$$,'crea nota');
select lives_ok(format($$select execute_transport_operation('ca000000-0000-4000-8000-000000000001','platform','cb000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000002','note','archive','%s',null,'{}',null,'ce000000-0000-4000-8000-000000000015','cf000000-0000-4000-8000-000000000015')$$,(select id from transport_notes where transport_order_id='cd000000-0000-4000-8000-000000000002')),'archiva nota');
select isnt((select archived_at::text from transport_notes where transport_order_id='cd000000-0000-4000-8000-000000000002'),null,'nota queda archivada lógicamente');

select is((select execute_transport_operation('ca000000-0000-4000-8000-000000000001','platform','cb000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000002','note','archive',(select id from transport_notes where transport_order_id='cd000000-0000-4000-8000-000000000002'),null,'{}',null,'ce000000-0000-4000-8000-000000000015','cf000000-0000-4000-8000-000000000015')->>'eventType'),'note.updated','misma key devuelve resultado original');
select is((select count(*)::integer from transport_events where correlation_id='ce000000-0000-4000-8000-000000000015'),1,'repetición no duplica efectos');
select throws_ok(format($$select execute_transport_operation('ca000000-0000-4000-8000-000000000001','platform','cb000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000002','note','update','%s',null,'{"body":"Otro"}',null,'ce000000-0000-4000-8000-000000000016','cf000000-0000-4000-8000-000000000015')$$,(select id from transport_notes where transport_order_id='cd000000-0000-4000-8000-000000000002')),'23505',null,'misma key con payload distinto se rechaza');
select throws_ok($$select execute_transport_operation('ca000000-0000-4000-8000-000000000001','platform','cb000000-0000-4000-8000-000000000002','cd000000-0000-4000-8000-000000000002','execution','start',null,null,'{}',null,'ce000000-0000-4000-8000-000000000020','cf000000-0000-4000-8000-000000000020')$$,'P0002',null,'aísla organización y orden');
select throws_ok($$select execute_transport_operation('ca000000-0000-4000-8000-000000000003','platform','cb000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000003','execution','start',null,null,'{}',null,'ce000000-0000-4000-8000-000000000021','cf000000-0000-4000-8000-000000000021')$$,'42501',null,'rechaza actor no autorizado');
update organization_module_overrides set override_mode='disabled' where organization_id='cb000000-0000-4000-8000-000000000001';
select throws_ok($$select execute_transport_operation('ca000000-0000-4000-8000-000000000002','organization','cb000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000003','execution','start',null,null,'{}',null,'ce000000-0000-4000-8000-000000000022','cf000000-0000-4000-8000-000000000022')$$,'42501',null,'rechaza módulo desactivado');
update organization_module_overrides set override_mode='enabled' where organization_id='cb000000-0000-4000-8000-000000000001';

create function pg_temp.fail_phase_c_insert() returns trigger language plpgsql as $$begin raise exception 'forced failure'; end$$;
create trigger force_timeline before insert on transport_events for each row execute function pg_temp.fail_phase_c_insert();
select throws_ok($$select execute_transport_operation('ca000000-0000-4000-8000-000000000001','platform','cb000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000003','execution','start',null,null,'{}',null,'ce000000-0000-4000-8000-000000000030','cf000000-0000-4000-8000-000000000030')$$,'P0001','forced failure','falla timeline');
drop trigger force_timeline on transport_events;
select is((select count(*)::integer from transport_executions where transport_order_id='cd000000-0000-4000-8000-000000000003'),0,'timeline revierte toda la mutación');
create trigger force_audit before insert on audit_events for each row execute function pg_temp.fail_phase_c_insert();
select throws_ok($$select execute_transport_operation('ca000000-0000-4000-8000-000000000001','platform','cb000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000003','execution','start',null,null,'{}',null,'ce000000-0000-4000-8000-000000000031','cf000000-0000-4000-8000-000000000031')$$,'P0001','forced failure','falla auditoría');
drop trigger force_audit on audit_events;
select is((select count(*)::integer from transport_executions where transport_order_id='cd000000-0000-4000-8000-000000000003'),0,'auditoría revierte mutación y timeline');
create trigger force_notification before insert on internal_notifications for each row execute function pg_temp.fail_phase_c_insert();
select throws_ok($$select execute_transport_operation('ca000000-0000-4000-8000-000000000001','platform','cb000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000003','execution','start',null,null,'{}',null,'ce000000-0000-4000-8000-000000000032','cf000000-0000-4000-8000-000000000032')$$,'P0001','forced failure','falla notificación');
drop trigger force_notification on internal_notifications;
select is((select count(*)::integer from transport_executions where transport_order_id='cd000000-0000-4000-8000-000000000003'),0,'notificación revierte mutación, timeline y auditoría');
select * from finish(); rollback;
