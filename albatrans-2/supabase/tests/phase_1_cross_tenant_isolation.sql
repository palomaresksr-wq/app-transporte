begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, auth, pg_catalog;
select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select user_id, 'authenticated', 'authenticated', email, '', now(), '{}', '{}', now(), now()
from (
  values
    ('a7000000-0000-4000-8000-000000000001'::uuid, 'isolation-admin-a@test.local'),
    ('a7000000-0000-4000-8000-000000000002'::uuid, 'isolation-driver-a@test.local'),
    ('a7000000-0000-4000-8000-000000000003'::uuid, 'isolation-admin-b@test.local'),
    ('a7000000-0000-4000-8000-000000000004'::uuid, 'isolation-no-member@test.local')
) users(user_id, email);

insert into public.profiles (user_id, display_name)
values
  ('a7000000-0000-4000-8000-000000000001', 'Admin A'),
  ('a7000000-0000-4000-8000-000000000002', 'Conductor A'),
  ('a7000000-0000-4000-8000-000000000003', 'Admin B'),
  ('a7000000-0000-4000-8000-000000000004', 'Sin empresa');

insert into public.organizations (id, legal_name, status, created_by)
values
  ('b7000000-0000-4000-8000-000000000001', 'Empresa A', 'active', 'a7000000-0000-4000-8000-000000000001'),
  ('b7000000-0000-4000-8000-000000000002', 'Empresa B', 'active', 'a7000000-0000-4000-8000-000000000003');

insert into public.organization_memberships (
  organization_id, user_id, role, status, invited_at, joined_at
)
values
  ('b7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001', 'admin_empresa', 'active', now(), now()),
  ('b7000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000002', 'conductor', 'active', now(), now()),
  ('b7000000-0000-4000-8000-000000000002', 'a7000000-0000-4000-8000-000000000003', 'admin_empresa', 'active', now(), now());

insert into public.organization_subscriptions (
  organization_id, plan_id, status, payment_status, starts_at
)
select
  organization_id,
  (select id from public.plans where code = 'professional'),
  'active',
  'paid',
  now()
from (
  values
    ('b7000000-0000-4000-8000-000000000001'::uuid),
    ('b7000000-0000-4000-8000-000000000002'::uuid)
) organizations(organization_id);

insert into public.organization_module_overrides (
  organization_id, module_id, override_mode, reason, changed_by
)
select
  organization_id,
  (select id from public.modules where code = 'ocr'),
  'disabled',
  'Prueba aislamiento',
  changed_by
from (
  values
    ('b7000000-0000-4000-8000-000000000001'::uuid, 'a7000000-0000-4000-8000-000000000001'::uuid),
    ('b7000000-0000-4000-8000-000000000002'::uuid, 'a7000000-0000-4000-8000-000000000003'::uuid)
) overrides(organization_id, changed_by);

insert into public.organization_limit_overrides (
  organization_id, limit_definition_id, override_mode, limit_value, reason, changed_by
)
select
  organization_id,
  (select id from public.limit_definitions where code = 'max_drivers'),
  'custom',
  limit_value,
  'Prueba aislamiento',
  changed_by
from (
  values
    ('b7000000-0000-4000-8000-000000000001'::uuid, 10::bigint, 'a7000000-0000-4000-8000-000000000001'::uuid),
    ('b7000000-0000-4000-8000-000000000002'::uuid, 20::bigint, 'a7000000-0000-4000-8000-000000000003'::uuid)
) overrides(organization_id, limit_value, changed_by);

insert into public.organization_usage_counters (
  organization_id, metric_code, period_start, usage_value
)
values
  ('b7000000-0000-4000-8000-000000000001', 'ocr_requests', date_trunc('month', now()), 1),
  ('b7000000-0000-4000-8000-000000000002', 'ocr_requests', date_trunc('month', now()), 2);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a7000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.organizations), 1, 'admin A no ve empresa B');
select is((select count(*)::integer from public.organization_memberships), 2, 'admin A no ve miembros de B');
select is((select count(*)::integer from public.organization_subscriptions), 1, 'admin A no ve suscripción B');
select is((select count(*)::integer from public.organization_module_overrides), 1, 'admin A no ve módulos B');
select is((select count(*)::integer from public.organization_limit_overrides), 1, 'admin A no ve límites B');
select is((select count(*)::integer from public.organization_usage_counters), 1, 'admin A no ve consumo B');

select set_config('request.jwt.claim.sub', 'a7000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.organization_subscriptions), 0, 'conductor no ve suscripciones');
select is((select count(*)::integer from public.organization_limit_overrides), 0, 'conductor no ve límites económicos');
select is((select count(*)::integer from public.organization_usage_counters), 0, 'conductor no ve consumo');

select set_config('request.jwt.claim.sub', 'a7000000-0000-4000-8000-000000000004', true);
select is((select count(*)::integer from public.organizations), 0, 'usuario sin membresía no ve empresas');
select is((select count(*)::integer from public.organization_subscriptions), 0, 'usuario sin membresía no ve suscripciones');
select is((select count(*)::integer from public.organization_module_overrides), 0, 'usuario sin membresía no ve módulos de empresa');

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'current_organization_module_enabled',
        'current_organization_limit_value',
        'current_organization_has_capacity'
      )
      and pg_get_function_identity_arguments(p.oid) ~* 'organization'
  ),
  'las funciones públicas no aceptan organization_id arbitrario'
);

select * from finish();
rollback;
