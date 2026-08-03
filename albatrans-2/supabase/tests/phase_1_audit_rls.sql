begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, auth, pg_catalog;
select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('a6000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'audit-super@test.local', '', now(), '{}', '{}', now(), now()),
  ('a6000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'audit-admin@test.local', '', now(), '{}', '{}', now(), now());

insert into public.profiles (user_id, display_name)
values
  ('a6000000-0000-4000-8000-000000000001', 'Superadmin auditoría'),
  ('a6000000-0000-4000-8000-000000000002', 'Admin auditoría');

insert into public.platform_admins (user_id)
values ('a6000000-0000-4000-8000-000000000001');

insert into public.organizations (id, legal_name, status, created_by)
values ('b6000000-0000-4000-8000-000000000001', 'Empresa auditoría', 'active', 'a6000000-0000-4000-8000-000000000001');

insert into public.organization_memberships (
  organization_id, user_id, role, status, invited_at, joined_at
)
values (
  'b6000000-0000-4000-8000-000000000001',
  'a6000000-0000-4000-8000-000000000002',
  'admin_empresa',
  'active',
  now(),
  now()
);

insert into public.organization_subscriptions (
  organization_id, plan_id, status, payment_status, starts_at
)
select
  'b6000000-0000-4000-8000-000000000001',
  id,
  'active',
  'paid',
  now()
from public.plans
where code = 'professional';

insert into public.audit_events (
  organization_id, actor_user_id, actor_scope, action, entity_type,
  entity_id, reason, correlation_id
)
values (
  'b6000000-0000-4000-8000-000000000001',
  'a6000000-0000-4000-8000-000000000001',
  'platform',
  'organization.updated',
  'organization',
  'b6000000-0000-4000-8000-000000000001',
  'Prueba',
  gen_random_uuid()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a6000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.audit_events), 1, 'superadmin lee auditoría');

select set_config('request.jwt.claim.sub', 'a6000000-0000-4000-8000-000000000002', true);
select ok(
  public.current_organization_module_enabled('audit_access'),
  'Profesional tiene audit_access activo'
);
select is(
  (select count(*)::integer from public.audit_events),
  0,
  'admin_empresa aún no lee auditoría aunque tenga audit_access'
);
select ok(
  not has_table_privilege('authenticated', 'public.audit_events', 'INSERT'),
  'authenticated no inserta auditoría'
);
select ok(
  not has_table_privilege('authenticated', 'public.audit_events', 'UPDATE'),
  'authenticated no actualiza auditoría'
);
select ok(
  not has_table_privilege('authenticated', 'public.audit_events', 'DELETE'),
  'authenticated no borra auditoría'
);

select * from finish();
rollback;
