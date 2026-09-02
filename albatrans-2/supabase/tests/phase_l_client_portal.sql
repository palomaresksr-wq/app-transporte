begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions,auth,pg_catalog;
select plan(35);
select has_table('client_portal_memberships');
select has_table('client_portal_visibility_policies');
select has_table('client_portal_branding');
select has_table('client_portal_commands');
select is((select relrowsecurity and relforcerowsecurity from pg_class where oid='client_portal_memberships'::regclass),true,'membership has forced RLS');
select function_privs_are('public','prepare_client_portal_user',array['uuid','uuid','uuid','uuid','text'],'authenticated',array[]::text[],'provisioning is backend only');
select ok(exists(select 1 from modules where code='client_portal'),'client portal module registered');
select col_type_is('transport_incidents','client_visibility','client_incident_visibility','incident visibility is explicit');

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('a1000000-0000-4000-8000-000000000001','authenticated','authenticated','admin-l@local','',now(),'{}','{}',now(),now()),
('a1000000-0000-4000-8000-000000000002','authenticated','authenticated','client-a-l@local','',now(),'{}','{}',now(),now()),
('a1000000-0000-4000-8000-000000000003','authenticated','authenticated','client-b-l@local','',now(),'{}','{}',now(),now());
insert into profiles(user_id,display_name) values
('a1000000-0000-4000-8000-000000000001','Admin L'),('a1000000-0000-4000-8000-000000000002','Client A'),('a1000000-0000-4000-8000-000000000003','Client B');
insert into organizations(id,legal_name,trade_name,status,created_by) values('a2000000-0000-4000-8000-000000000001','Org L','Org L','active','a1000000-0000-4000-8000-000000000001');
insert into organization_memberships(organization_id,user_id,role,status,joined_at) values('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','admin_empresa','active',now());
insert into organization_subscriptions(organization_id,plan_id,status,payment_status,starts_at) select 'a2000000-0000-4000-8000-000000000001',id,'active','paid',now() from plans where code='enterprise';
insert into clients(id,organization_id,legal_name,trade_name,created_by) values
('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','Client A','Client A','a1000000-0000-4000-8000-000000000001'),
('a3000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','Client B','Client B','a1000000-0000-4000-8000-000000000001');
insert into client_portal_memberships(organization_id,customer_id,user_id,role,status,created_by) values
('a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','client_viewer','active','a1000000-0000-4000-8000-000000000001'),
('a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003','client_admin','active','a1000000-0000-4000-8000-000000000001');
insert into client_portal_visibility_policies(organization_id,customer_id,incidents,updated_by) values
('a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001',true,'a1000000-0000-4000-8000-000000000001'),
('a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000002',true,'a1000000-0000-4000-8000-000000000001');
insert into transport_orders(id,organization_id,order_number,customer_id,transport_type,status,created_by) values
('a4000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','L-A','a3000000-0000-4000-8000-000000000001','general','planned','a1000000-0000-4000-8000-000000000001'),
('a4000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','L-B','a3000000-0000-4000-8000-000000000002','general','planned','a1000000-0000-4000-8000-000000000001');

set local role authenticated; select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from client_portal_memberships),1,'client reads own membership');
select is((select count(*)::integer from clients),0,'client cannot query raw customer rows');
select is((select count(*)::integer from transport_orders),0,'client cannot query raw transport rows');
select is((select count(*)::integer from organizations),0,'client cannot query raw organization rows');
select is((select count(*)::integer from locations),0,'client cannot query raw location rows');
select is((select count(*)::integer from vehicles),0,'client cannot query raw vehicle rows');
select is((select count(*)::integer from transport_stops),0,'client cannot query raw stop rows');
select is((select count(*)::integer from transport_items),0,'client cannot query raw goods rows');
select is((select count(*)::integer from transport_incidents),0,'client cannot query raw incident rows');
select is((select count(*)::integer from transport_events),0,'client cannot query raw timeline rows');
select is((select count(*)::integer from documents),0,'client cannot query raw document rows');
select is((select count(*)::integer from document_versions),0,'client cannot query raw document version rows');
select is((select count(*)::integer from proofs_of_delivery),0,'client cannot query raw POD rows');
select is((select count(*)::integer from document_signatures),0,'client cannot query raw signature rows');
select is((select count(*)::integer from invoices),0,'client cannot query raw invoice rows');
select is((select count(*)::integer from invoice_lines),0,'client cannot query raw invoice line rows');
select is((select count(*)::integer from invoice_payments),0,'client cannot query raw payment rows');
select is((select count(*)::integer from transport_regulatory_documents),0,'client cannot query raw regulatory document rows');
select is((select count(*)::integer from transport_regulatory_revisions),0,'client cannot query raw regulatory revision rows');
select is((select count(*)::integer from transport_regulatory_evidence),0,'client cannot query raw regulatory evidence rows');
select ok(client_portal_order_access('a4000000-0000-4000-8000-000000000001'),'backend helper recognizes own transport');
select is((select count(*)::integer from client_portal_visibility_policies),1,'client reads only own visibility policy');
select ok(not client_portal_order_access('a4000000-0000-4000-8000-000000000002'),'IDOR helper denies other customer');
reset role;
update client_portal_memberships set status='blocked' where user_id='a1000000-0000-4000-8000-000000000002';
set local role authenticated;select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from transport_orders),0,'blocked portal membership loses access');reset role;
update client_portal_memberships set status='active' where user_id='a1000000-0000-4000-8000-000000000002';
update clients set status='inactive' where id='a3000000-0000-4000-8000-000000000001';
set local role authenticated;select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from transport_orders),0,'inactive customer loses access');reset role;
update clients set status='active' where id='a3000000-0000-4000-8000-000000000001';
insert into organization_module_overrides(organization_id,module_id,override_mode,reason,changed_by) select 'a2000000-0000-4000-8000-000000000001',id,'disabled','phase l test','a1000000-0000-4000-8000-000000000001' from modules where code='client_portal';
set local role authenticated;select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from transport_orders),0,'disabled module blocks portal without deleting data');
select is((select count(*)::integer from client_portal_memberships),1,'disabled module retains own membership for diagnostics');reset role;
select * from finish();rollback;
