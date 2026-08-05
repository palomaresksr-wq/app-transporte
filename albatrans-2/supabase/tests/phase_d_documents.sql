begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,auth,storage,pg_catalog;
select plan(34);
select has_table('documents');
select has_table('document_versions');
select has_table('proofs_of_delivery');
select has_table('document_signatures');
select has_table('document_outbox');
select is((select public::text from storage.buckets where id='albatrans-documents'),'false','bucket privado');
select is((select file_size_limit::bigint from storage.buckets where id='albatrans-documents'),10485760::bigint,'límite de bucket');
select function_privs_are('public','begin_document_upload',array['uuid','audit_actor_scope','uuid','text','text','text','document_source','text','text','bigint','jsonb','uuid','uuid'],'authenticated',array[]::text[],'frontend no ejecuta inicio');
select function_privs_are('public','begin_document_upload',array['uuid','audit_actor_scope','uuid','text','text','text','document_source','text','text','bigint','jsonb','uuid','uuid'],'service_role',array['EXECUTE'],'solo service role inicia');

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('da000000-0000-4000-8000-000000000001','authenticated','authenticated','phase-d-platform@local','',now(),'{}','{}',now(),now()),
('da000000-0000-4000-8000-000000000002','authenticated','authenticated','phase-d-admin@local','',now(),'{}','{}',now(),now());
insert into profiles(user_id,display_name) values ('da000000-0000-4000-8000-000000000001','Platform D'),('da000000-0000-4000-8000-000000000002','Admin D');
insert into platform_admins(user_id,role,status) values('da000000-0000-4000-8000-000000000001','superadmin','active');
insert into organizations(id,legal_name,trade_name,status,created_by) values
('db000000-0000-4000-8000-000000000001','Fase D A','Fase D A','active','da000000-0000-4000-8000-000000000001'),
('db000000-0000-4000-8000-000000000002','Fase D B','Fase D B','active','da000000-0000-4000-8000-000000000001');
insert into organization_memberships(organization_id,user_id,role,status,joined_at) values('db000000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000002','admin_empresa','active',now());
insert into organization_module_overrides(organization_id,module_id,override_mode,changed_by,reason) select 'db000000-0000-4000-8000-000000000001',id,'enabled','da000000-0000-4000-8000-000000000001','test' from modules where code in('document_management','pod_signature');
insert into clients(id,organization_id,legal_name,trade_name,created_by) values('dc000000-0000-4000-8000-000000000001','db000000-0000-4000-8000-000000000001','Cliente D','Cliente D','da000000-0000-4000-8000-000000000001');
insert into transport_orders(id,organization_id,order_number,customer_id,transport_type,created_by) values('dd000000-0000-4000-8000-000000000001','db000000-0000-4000-8000-000000000001','D-1','dc000000-0000-4000-8000-000000000001','General','da000000-0000-4000-8000-000000000001');

select lives_ok($$select begin_document_upload('da000000-0000-4000-8000-000000000001','platform','db000000-0000-4000-8000-000000000001','delivery_note','Albarán',null,'upload','a.pdf','application/pdf',4,'{"transportOrderId":"dd000000-0000-4000-8000-000000000001"}','de000000-0000-4000-8000-000000000001','df000000-0000-4000-8000-000000000001')$$,'inicia subida');
select is((select count(*)::integer from documents where organization_id='db000000-0000-4000-8000-000000000001'),1,'crea documento una vez');
select is((select status::text from document_versions where organization_id='db000000-0000-4000-8000-000000000001'),'pending_upload','versión pendiente');
select lives_ok($$select begin_document_upload('da000000-0000-4000-8000-000000000001','platform','db000000-0000-4000-8000-000000000001','delivery_note','Albarán',null,'upload','a.pdf','application/pdf',4,'{"transportOrderId":"dd000000-0000-4000-8000-000000000001"}','de000000-0000-4000-8000-000000000001','df000000-0000-4000-8000-000000000001')$$,'repetición idempotente');
select is((select count(*)::integer from documents where organization_id='db000000-0000-4000-8000-000000000001'),1,'idempotencia no duplica');
select throws_ok($$select begin_document_upload('da000000-0000-4000-8000-000000000001','platform','db000000-0000-4000-8000-000000000001','photo','Otro',null,'upload','a.pdf','application/pdf',4,'{"transportOrderId":"dd000000-0000-4000-8000-000000000001"}','de000000-0000-4000-8000-000000000002','df000000-0000-4000-8000-000000000001')$$,'23505',null,'conflicto de idempotencia');
select throws_ok($$select begin_document_upload('da000000-0000-4000-8000-000000000001','platform','db000000-0000-4000-8000-000000000002','photo','Cruce',null,'upload','a.pdf','application/pdf',4,'{"transportOrderId":"dd000000-0000-4000-8000-000000000001"}','de000000-0000-4000-8000-000000000003','df000000-0000-4000-8000-000000000003')$$,'23514',null,'rechaza relación cruzada');
select throws_ok($$select begin_document_upload('da000000-0000-4000-8000-000000000001','platform','db000000-0000-4000-8000-000000000001','photo','MIME',null,'upload','a.exe','application/octet-stream',4,'{"transportOrderId":"dd000000-0000-4000-8000-000000000001"}','de000000-0000-4000-8000-000000000004','df000000-0000-4000-8000-000000000004')$$,'22023',null,'rechaza MIME');
select throws_ok($$select begin_document_upload('da000000-0000-4000-8000-000000000001','platform','db000000-0000-4000-8000-000000000001','photo','Grande',null,'upload','a.pdf','application/pdf',10485761,'{"transportOrderId":"dd000000-0000-4000-8000-000000000001"}','de000000-0000-4000-8000-000000000005','df000000-0000-4000-8000-000000000005')$$,'22023',null,'rechaza tamaño');
select lives_ok(format($$select confirm_document_upload('da000000-0000-4000-8000-000000000001','platform','db000000-0000-4000-8000-000000000001','%s','%s','application/pdf',4,repeat('a',64),'{}','de000000-0000-4000-8000-000000000006','df000000-0000-4000-8000-000000000006')$$,(select id from documents limit 1),(select id from document_versions limit 1)),'confirma versión');
select is((select status::text from documents where organization_id='db000000-0000-4000-8000-000000000001'),'available','documento disponible');
select ok((select current_version_id is not null from documents where organization_id='db000000-0000-4000-8000-000000000001'),'current version enlazada');
select is((select count(*)::integer from audit_events where organization_id='db000000-0000-4000-8000-000000000001' and action like 'document.%'),3,'auditoría documental');
select is((select count(*)::integer from transport_events where transport_order_id='dd000000-0000-4000-8000-000000000001' and event_type like 'document.%'),2,'timeline documental');
select lives_ok(format($$select begin_document_version_upload('da000000-0000-4000-8000-000000000001','platform','db000000-0000-4000-8000-000000000001','%s','b.pdf','application/pdf',5,'de000000-0000-4000-8000-000000000007','df000000-0000-4000-8000-000000000007')$$,(select id from documents limit 1)),'crea segunda versión');
select is((select max(version_number) from document_versions),2,'versión incremental');
select lives_ok(format($$select command_proof_of_delivery('da000000-0000-4000-8000-000000000001','platform','db000000-0000-4000-8000-000000000001','create',null,'%s','dd000000-0000-4000-8000-000000000001',null,'{"deliveredAt":"2026-08-05T10:00:00Z","recipientName":"Receptor"}','de000000-0000-4000-8000-000000000008','df000000-0000-4000-8000-000000000008')$$,(select id from documents limit 1)),'crea POD capturado');
select is((select status::text from proofs_of_delivery),'captured','POD queda capturado');
select lives_ok(format($$select command_proof_of_delivery('da000000-0000-4000-8000-000000000001','platform','db000000-0000-4000-8000-000000000001','confirm','%s',null,null,null,'{}','de000000-0000-4000-8000-000000000009','df000000-0000-4000-8000-000000000009')$$,(select id from proofs_of_delivery)),'confirma POD');
select lives_ok(format($$select command_proof_of_delivery('da000000-0000-4000-8000-000000000001','platform','db000000-0000-4000-8000-000000000001','reject','%s',null,null,null,'{}','de000000-0000-4000-8000-000000000010','df000000-0000-4000-8000-000000000010')$$,(select id from proofs_of_delivery)),'rechaza POD conservando historial');
select lives_ok(format($$select command_document_signature('da000000-0000-4000-8000-000000000001','platform','db000000-0000-4000-8000-000000000001','create',null,'%s','%s','{"signatureType":"typed","signerName":"Receptor","signedAt":"2026-08-05T10:01:00Z","signatureHash":"%s"}','de000000-0000-4000-8000-000000000011','df000000-0000-4000-8000-000000000011')$$,(select id from documents limit 1),(select current_version_id from documents limit 1),repeat('b',64)),'crea firma tipada');
select lives_ok(format($$select command_document_signature('da000000-0000-4000-8000-000000000001','platform','db000000-0000-4000-8000-000000000001','revoke','%s',null,null,'{"reason":"Revocación de prueba"}','de000000-0000-4000-8000-000000000012','df000000-0000-4000-8000-000000000012')$$,(select id from document_signatures)),'revoca firma sin borrarla');
select lives_ok(format($$select archive_document('da000000-0000-4000-8000-000000000001','platform','db000000-0000-4000-8000-000000000001','%s','Fin de prueba','de000000-0000-4000-8000-000000000013','df000000-0000-4000-8000-000000000013')$$,(select id from documents limit 1)),'archiva documento lógicamente');
select is((select status::text from documents limit 1),'archived','archivado no borra metadata');

set local role authenticated;
select set_config('request.jwt.claim.sub','da000000-0000-4000-8000-000000000002',true);
select is((select count(*)::integer from documents),1,'admin ve solo su tenant con módulo');
reset role;
select * from finish(); rollback;
