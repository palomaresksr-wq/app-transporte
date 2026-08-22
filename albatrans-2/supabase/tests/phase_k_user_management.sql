begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,auth,pg_catalog;
select plan(21);
select has_table('company_user_lifecycle');
select has_table('user_management_commands');
select has_table('organization_onboarding');
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid='company_user_lifecycle'::regclass),true,'lifecycle has forced RLS');
select function_privs_are('public','prepare_company_user_command',array['uuid','uuid','organization_role','uuid','text'],'authenticated',array[]::text[],'create command is backend only');

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('f1000000-0000-4000-8000-000000000001','authenticated','authenticated','phase-k-admin@local','',now(),'{}','{}',now(),now()),
('f1000000-0000-4000-8000-000000000002','authenticated','authenticated','phase-k-driver@local','',now(),'{}','{}',now(),now()),
('f1000000-0000-4000-8000-000000000003','authenticated','authenticated','phase-k-driver2@local','',now(),'{}','{}',now(),now());
insert into profiles(user_id,display_name) values('f1000000-0000-4000-8000-000000000001','Admin K');
insert into organizations(id,legal_name,trade_name,tax_id,status,created_by) values('f2000000-0000-4000-8000-000000000001','Demo K SL','Demo K','K00000001','active','f1000000-0000-4000-8000-000000000001');
insert into organization_memberships(organization_id,user_id,role,status,joined_at) values('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','admin_empresa','active',now());
insert into organization_subscriptions(organization_id,plan_id,status,payment_status,starts_at) select 'f2000000-0000-4000-8000-000000000001',id,'active','paid',now() from plans where code='starter';
insert into organization_limit_overrides(organization_id,limit_definition_id,override_mode,limit_value,reason,changed_by) select 'f2000000-0000-4000-8000-000000000001',id,'custom',1,'phase k test','f1000000-0000-4000-8000-000000000001' from limit_definitions where code='max_drivers';

set local role service_role; select set_config('request.jwt.claims','{"role":"service_role"}',true);
select lives_ok($$select prepare_company_user_command('f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','conductor','f3000000-0000-4000-8000-000000000001',repeat('a',64))$$,'reserves last driver slot');
select is((select count(*)::integer from user_management_commands where status='prepared'),1,'one slot reserved');
select lives_ok($$select prepare_company_user_command('f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','conductor','f3000000-0000-4000-8000-000000000001',repeat('a',64))$$,'same key is idempotent');
select is((select count(*)::integer from user_management_commands),1,'retry creates no command');
select throws_ok($$select prepare_company_user_command('f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','conductor','f3000000-0000-4000-8000-000000000002',repeat('b',64))$$,'23514',null,'pending reservation enforces plan limit');
select throws_ok($$select prepare_company_user_command('f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','conductor','f3000000-0000-4000-8000-000000000001',repeat('c',64))$$,'23505',null,'same key different payload conflicts');
select lives_ok($$select complete_company_user_command('f1000000-0000-4000-8000-000000000001',(select id from user_management_commands limit 1),'f1000000-0000-4000-8000-000000000002','Driver','Demo','phase-k-driver@local','600000000',true)$$,'completes database side atomically');
select is((select status::text from company_user_lifecycle where user_id='f1000000-0000-4000-8000-000000000002'),'active','lifecycle active');
select ok((select must_change_password from company_user_lifecycle where user_id='f1000000-0000-4000-8000-000000000002'),'initial password change required');
select is((select count(*)::integer from drivers where membership_id=(select id from organization_memberships where user_id='f1000000-0000-4000-8000-000000000002')),1,'driver record created');
select is((select count(*)::integer from audit_events where action='user.created'),1,'creation audited once');
select is((select after_data ? 'password' from audit_events where action='user.created'),false,'password absent from audit');
reset role;

set local role authenticated; select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::integer from company_user_lifecycle),1,'same tenant admin can list users'); reset role;
set local role authenticated; select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from company_user_lifecycle),1,'user can read own lifecycle');
select throws_ok($$select prepare_company_user_command('f1000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000001','conductor',gen_random_uuid(),repeat('d',64))$$,'42501',null,'driver cannot call backend RPC'); reset role;
update profiles set status='blocked' where user_id='f1000000-0000-4000-8000-000000000001';
set local role authenticated; select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is(current_organization_id(),null,'blocked admin loses tenant context');
select * from finish(); rollback;
