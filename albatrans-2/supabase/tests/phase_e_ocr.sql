begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,auth,storage,pg_catalog;
select plan(31);

select has_table('ocr_jobs');
select has_table('ocr_results');
select has_table('ocr_field_results');
select has_table('ocr_reviews');
select has_table('ocr_field_corrections');
select has_table('ocr_quota_reservations');
select has_table('ocr_outbox');

select function_privs_are('public','request_document_ocr',array['uuid','audit_actor_scope','uuid','uuid','uuid','text','jsonb','uuid','uuid'],'authenticated',array[]::text[],'frontend no ejecuta request OCR');
select function_privs_are('public','request_document_ocr',array['uuid','audit_actor_scope','uuid','uuid','uuid','text','jsonb','uuid','uuid'],'service_role',array['EXECUTE'],'backend ejecuta request OCR');

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('ea000000-0000-4000-8000-000000000001','authenticated','authenticated','phase-e-platform@local','',now(),'{}','{}',now(),now()),
('ea000000-0000-4000-8000-000000000002','authenticated','authenticated','phase-e-admin@local','',now(),'{}','{}',now(),now()),
('ea000000-0000-4000-8000-000000000003','authenticated','authenticated','phase-e-admin-2@local','',now(),'{}','{}',now(),now());
insert into profiles(user_id,display_name) values
('ea000000-0000-4000-8000-000000000001','Platform E'),
('ea000000-0000-4000-8000-000000000002','Admin E'),
('ea000000-0000-4000-8000-000000000003','Admin E 2');
insert into platform_admins(user_id,role,status) values ('ea000000-0000-4000-8000-000000000001','superadmin','active');

insert into organizations(id,legal_name,trade_name,status,created_by) values
('eb000000-0000-4000-8000-000000000001','Fase E OCR','Fase E OCR','active','ea000000-0000-4000-8000-000000000001'),
('eb000000-0000-4000-8000-000000000002','Fase E OCR OFF','Fase E OCR OFF','active','ea000000-0000-4000-8000-000000000001');

insert into organization_subscriptions(organization_id,plan_id,status,payment_status,starts_at)
select 'eb000000-0000-4000-8000-000000000001', id, 'active', 'paid', now()
from plans
where code = 'enterprise';

insert into organization_subscriptions(organization_id,plan_id,status,payment_status,starts_at)
select 'eb000000-0000-4000-8000-000000000002', id, 'active', 'paid', now()
from plans
where code = 'starter';

insert into organization_memberships(organization_id,user_id,role,status,joined_at) values
('eb000000-0000-4000-8000-000000000001','ea000000-0000-4000-8000-000000000002','admin_empresa','active',now()),
('eb000000-0000-4000-8000-000000000002','ea000000-0000-4000-8000-000000000003','admin_empresa','active',now());

insert into organization_module_overrides(organization_id,module_id,override_mode,changed_by,reason)
select 'eb000000-0000-4000-8000-000000000001',id,'enabled','ea000000-0000-4000-8000-000000000001','test phase e'
from modules
where code in ('ocr','document_management','transport_management');

insert into clients(id,organization_id,legal_name,trade_name,created_by) values
('ec000000-0000-4000-8000-000000000001','eb000000-0000-4000-8000-000000000001','Cliente E','Cliente E','ea000000-0000-4000-8000-000000000001');
insert into transport_orders(id,organization_id,order_number,customer_id,transport_type,created_by)
values('ed000000-0000-4000-8000-000000000001','eb000000-0000-4000-8000-000000000001','E-1','ec000000-0000-4000-8000-000000000001','General','ea000000-0000-4000-8000-000000000001');

insert into documents(id,organization_id,transport_order_id,document_type,title,status,source,created_by)
values('ee000000-0000-4000-8000-000000000001','eb000000-0000-4000-8000-000000000001','ed000000-0000-4000-8000-000000000001','delivery_note','OCR Base','available','upload','ea000000-0000-4000-8000-000000000001');

insert into document_versions(id,organization_id,document_id,version_number,storage_bucket,storage_path,original_filename,mime_type,size_bytes,sha256,uploaded_by,uploaded_at,status)
values('ef000000-0000-4000-8000-000000000001','eb000000-0000-4000-8000-000000000001','ee000000-0000-4000-8000-000000000001',1,'albatrans-documents','eb000000-0000-4000-8000-000000000001/documents/ee000000-0000-4000-8000-000000000001/ef000000-0000-4000-8000-000000000001/object','ocr.pdf','application/pdf',120,repeat('a',64),'ea000000-0000-4000-8000-000000000001',now(),'available');
update documents set current_version_id='ef000000-0000-4000-8000-000000000001' where id='ee000000-0000-4000-8000-000000000001';

select lives_ok($$
  select request_document_ocr(
    'ea000000-0000-4000-8000-000000000001','platform','eb000000-0000-4000-8000-000000000001',
    'ee000000-0000-4000-8000-000000000001','ef000000-0000-4000-8000-000000000001','mock_local',
    '{"schemaVersion":"1.0.0","reviewThreshold":0.8,"importantFields":["document_number"]}'::jsonb,
    'e1000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001'
  )
$$,'crea request OCR');

select is((select count(*)::integer from ocr_jobs where organization_id='eb000000-0000-4000-8000-000000000001'),1,'crea un job OCR');
select is((select status::text from ocr_jobs where organization_id='eb000000-0000-4000-8000-000000000001'),'queued','job en cola');
select is((select status::text from ocr_quota_reservations where organization_id='eb000000-0000-4000-8000-000000000001'),'reserved','cuota reservada');

select lives_ok($$
  select request_document_ocr(
    'ea000000-0000-4000-8000-000000000001','platform','eb000000-0000-4000-8000-000000000001',
    'ee000000-0000-4000-8000-000000000001','ef000000-0000-4000-8000-000000000001','mock_local',
    '{"schemaVersion":"1.0.0","reviewThreshold":0.8,"importantFields":["document_number"]}'::jsonb,
    'e1000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001'
  )
$$,'idempotencia misma key');
select is((select count(*)::integer from ocr_jobs where organization_id='eb000000-0000-4000-8000-000000000001'),1,'idempotencia no duplica job');

select throws_ok($$
  select request_document_ocr(
    'ea000000-0000-4000-8000-000000000001','platform','eb000000-0000-4000-8000-000000000001',
    'ee000000-0000-4000-8000-000000000001','ef000000-0000-4000-8000-000000000001','mock_local',
    '{"schemaVersion":"2.0.0","reviewThreshold":0.9,"importantFields":["issue_date"]}'::jsonb,
    'e1000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000001'
  )
$$,'23505',null,'rechaza idempotency key con payload distinto');

select lives_ok(format($$
  select mark_ocr_processing_started(
    'ea000000-0000-4000-8000-000000000001','platform','eb000000-0000-4000-8000-000000000001',
    '%s','provider-request-1','e1000000-0000-4000-8000-000000000003','e2000000-0000-4000-8000-000000000003'
  )
$$,(select id from ocr_jobs where organization_id='eb000000-0000-4000-8000-000000000001' limit 1)),'marca processing');

select is((select status::text from ocr_jobs where organization_id='eb000000-0000-4000-8000-000000000001'),'processing','job en processing');
select is((select status::text from ocr_quota_reservations where organization_id='eb000000-0000-4000-8000-000000000001'),'committed','cuota comprometida');

select lives_ok(format($$
  select complete_ocr_job_result(
    'ea000000-0000-4000-8000-000000000001','platform','eb000000-0000-4000-8000-000000000001','%s',
    '{"providerCode":"mock_local","schemaVersion":"1.0.0","detectedDocumentType":"transport_document","detectedLanguage":"es","overallConfidence":0.51,"rawResponse":{"mock":true},"normalizedData":{"document_number":"ALB-1"},"warnings":["low_confidence"]}'::jsonb,
    '[{"fieldCode":"document_number","normalizedValue":"ALB-1","confidence":0.51,"validationStatus":"uncertain"}]'::jsonb,
    'e1000000-0000-4000-8000-000000000004','e2000000-0000-4000-8000-000000000004'
  )
$$,(select id from ocr_jobs where organization_id='eb000000-0000-4000-8000-000000000001' limit 1)),'completa OCR');

select is((select status::text from ocr_jobs where organization_id='eb000000-0000-4000-8000-000000000001'),'needs_review','baja confianza exige revision');
select is((select count(*)::integer from ocr_results where organization_id='eb000000-0000-4000-8000-000000000001'),1,'crea resultado OCR');
select is((select count(*)::integer from ocr_field_results where organization_id='eb000000-0000-4000-8000-000000000001'),1,'crea campos OCR');

select lives_ok(format($$
  select start_ocr_review(
    'ea000000-0000-4000-8000-000000000001','platform','eb000000-0000-4000-8000-000000000001','%s','%s',
    'revision manual','e1000000-0000-4000-8000-000000000005','e2000000-0000-4000-8000-000000000005'
  )
$$,
(select id from ocr_jobs where organization_id='eb000000-0000-4000-8000-000000000001' limit 1),
(select id from ocr_results where organization_id='eb000000-0000-4000-8000-000000000001' limit 1)
),'inicia revision');

select lives_ok(format($$
  select correct_ocr_field(
    'ea000000-0000-4000-8000-000000000001','platform','eb000000-0000-4000-8000-000000000001','%s','%s',
    'document_number','"ALB-1-OK"'::jsonb,'correccion test',
    'e1000000-0000-4000-8000-000000000006','e2000000-0000-4000-8000-000000000006'
  )
$$,
(select id from ocr_reviews where organization_id='eb000000-0000-4000-8000-000000000001' limit 1),
(select id from ocr_field_results where organization_id='eb000000-0000-4000-8000-000000000001' limit 1)
),'corrige campo append-only');

select is((select count(*)::integer from ocr_field_corrections where organization_id='eb000000-0000-4000-8000-000000000001'),1,'guarda correccion');

select lives_ok(format($$
  select approve_ocr_review(
    'ea000000-0000-4000-8000-000000000001','platform','eb000000-0000-4000-8000-000000000001','%s',
    'ok',
    'e1000000-0000-4000-8000-000000000007','e2000000-0000-4000-8000-000000000007'
  )
$$,(select id from ocr_reviews where organization_id='eb000000-0000-4000-8000-000000000001' limit 1)),'aprueba revision');

select is((select status::text from ocr_reviews where organization_id='eb000000-0000-4000-8000-000000000001'),'approved','review aprobada');
select is((select status::text from ocr_jobs where organization_id='eb000000-0000-4000-8000-000000000001'),'reviewed','job reviewed');

select throws_ok($$
  select request_document_ocr(
    'ea000000-0000-4000-8000-000000000003','organization','eb000000-0000-4000-8000-000000000002',
    'ee000000-0000-4000-8000-000000000001','ef000000-0000-4000-8000-000000000001','mock_local',
    '{}'::jsonb,
    'e1000000-0000-4000-8000-000000000008','e2000000-0000-4000-8000-000000000008'
  )
$$,'42501',null,'modulo OCR desactivado bloquea solicitud');

set local role authenticated;
select set_config('request.jwt.claim.sub','ea000000-0000-4000-8000-000000000002',true);
select is((select count(*)::integer from ocr_jobs),1,'RLS permite leer OCR del tenant activo');
reset role;

select * from finish();
rollback;
