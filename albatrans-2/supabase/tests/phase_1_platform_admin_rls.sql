begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, auth, pg_catalog;
select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('a4000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'super@test.local', '', now(), '{}', '{}', now(), now()),
  ('a4000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'normal@test.local', '', now(), '{}', '{}', now(), now()),
  ('a4000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'second-super@test.local', '', now(), '{}', '{}', now(), now());

insert into public.profiles (user_id, display_name)
values
  ('a4000000-0000-4000-8000-000000000001', 'Superadmin'),
  ('a4000000-0000-4000-8000-000000000002', 'Normal'),
  ('a4000000-0000-4000-8000-000000000003', 'Segundo');

insert into public.platform_admins (user_id)
values ('a4000000-0000-4000-8000-000000000001');

insert into public.organizations (id, legal_name, status, created_by)
values
  ('b4000000-0000-4000-8000-000000000001', 'Empresa A', 'active', 'a4000000-0000-4000-8000-000000000001'),
  ('b4000000-0000-4000-8000-000000000002', 'Empresa B', 'active', 'a4000000-0000-4000-8000-000000000001');

insert into public.organization_memberships (
  organization_id, user_id, role, status, invited_at, joined_at
)
values (
  'b4000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000002',
  'admin_empresa',
  'active',
  now(),
  now()
);

insert into public.organization_subscriptions (
  organization_id, plan_id, status, payment_status, starts_at
)
select
  organization_id,
  (select id from public.plans where code = 'starter'),
  'active',
  'paid',
  now()
from (
  values
    ('b4000000-0000-4000-8000-000000000001'::uuid),
    ('b4000000-0000-4000-8000-000000000002'::uuid)
) organizations(organization_id);

insert into public.audit_events (
  organization_id, actor_user_id, actor_scope, action, entity_type,
  entity_id, reason, correlation_id
)
values
  ('b4000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 'platform', 'organization.created', 'organization', 'A', 'Prueba', gen_random_uuid()),
  ('b4000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000001', 'platform', 'organization.created', 'organization', 'B', 'Prueba', gen_random_uuid());

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a4000000-0000-4000-8000-000000000001', true);

select ok(public.is_platform_superadmin(), 'la cuenta de plataforma se reconoce');
select is((select count(*)::integer from public.organizations), 2, 'superadmin ve todas las empresas');
select is((select count(*)::integer from public.organization_subscriptions), 2, 'superadmin ve todas las suscripciones');
select is((select count(*)::integer from public.modules), 17, 'superadmin ve el catálogo evolucionado, incluido portal cliente');
select is((select count(*)::integer from public.limit_definitions), 7, 'superadmin ve todos los límites');
select is((select count(*)::integer from public.organization_memberships), 1, 'superadmin ve todos los miembros');
select is((select count(*)::integer from public.plan_limits), 11, 'superadmin ve todos los límites de planes');
select is((select count(*)::integer from public.audit_events), 2, 'superadmin ve toda la auditoría');

select ok(
  public.is_platform_superadmin(),
  'support_access y audit_access no condicionan is_platform_superadmin'
);

select set_config('request.jwt.claim.sub', 'a4000000-0000-4000-8000-000000000002', true);
select ok(not public.is_platform_superadmin(), 'un usuario normal no es superadmin');
select ok(
  not has_table_privilege('authenticated', 'public.platform_admins', 'INSERT'),
  'un usuario normal no puede insertarse como superadmin'
);
select ok(
  not has_table_privilege('authenticated', 'public.platform_admins', 'UPDATE'),
  'un usuario normal no puede elevar su rol'
);

reset role;
select throws_ok(
  $$
    insert into public.platform_admins (user_id)
    values ('a4000000-0000-4000-8000-000000000003')
  $$,
  '23505',
  null,
  'la restricción singleton rechaza un segundo superadmin'
);

select * from finish();
rollback;
