begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, auth, pg_catalog;

select no_plan();

select is(
  (
    select count(*)::integer
    from unnest(array[
      'profiles',
      'organizations',
      'platform_admins',
      'organization_memberships',
      'plans',
      'organization_subscriptions',
      'modules',
      'plan_modules',
      'organization_module_overrides',
      'limit_definitions',
      'plan_limits',
      'organization_limit_overrides',
      'organization_usage_counters',
      'legacy_identity_links',
      'audit_events'
    ]) expected(table_name)
    where to_regclass('public.' || expected.table_name) is null
  ),
  0,
  'existen las quince tablas aprobadas de Fase 1'
);

select is(
  (
    select count(*)::integer
    from unnest(array[
      'profile_status',
      'platform_role',
      'platform_admin_status',
      'organization_role',
      'membership_status',
      'organization_status',
      'plan_code',
      'plan_status',
      'billing_interval',
      'subscription_status',
      'payment_status',
      'module_status',
      'module_override_mode',
      'limit_unit',
      'limit_period',
      'limit_enforcement',
      'limit_status',
      'limit_override_mode',
      'audit_actor_scope',
      'legacy_entity_type',
      'legacy_migration_status'
    ]) expected(type_name)
    where to_regtype('public.' || expected.type_name) is null
  ),
  0,
  'existen los veintiún tipos aprobados'
);

select is((select count(*)::integer from public.plans), 4, 'existen cuatro planes');
select results_eq(
  $$ select code::text from public.plans order by code::text $$,
  $$ values ('custom'), ('enterprise'), ('professional'), ('starter') $$,
  'los códigos de plan coinciden con el contrato'
);

select is((select count(*)::integer from public.modules), 15, 'existen quince módulos');
select results_eq(
  $$ select code from public.modules order by code $$,
  $$ values
    ('api_access'),
    ('audit_access'),
    ('billing'),
    ('client_management'),
    ('electronic_delivery_notes'),
    ('exports'),
    ('leave_management'),
    ('ocr'),
    ('pod_signature'),
    ('reports'),
    ('support_access'),
    ('time_tracking'),
    ('transport_execution'),
    ('transport_management'),
    ('vehicle_management')
  $$,
  'el catálogo contiene exactamente los quince módulos aprobados'
);

select is(
  (select count(*)::integer from public.plan_modules),
  60,
  'cada plan declara los quince módulos'
);
select is(
  (
    select count(*)::integer
    from public.plan_modules pm
    join public.plans p on p.id = pm.plan_id
    where p.code = 'starter' and pm.enabled
  ),
  6,
  'Starter activa seis módulos'
);
select is(
  (
    select count(*)::integer
    from public.plan_modules pm
    join public.plans p on p.id = pm.plan_id
    where p.code = 'professional' and pm.enabled
  ),
  14,
  'Profesional activa todos los módulos salvo API'
);
select is(
  (
    select count(*)::integer
    from public.plan_modules pm
    join public.plans p on p.id = pm.plan_id
    where p.code = 'enterprise' and pm.enabled
  ),
  15,
  'Enterprise activa todos los módulos'
);
select is(
  (
    select count(*)::integer
    from public.plan_modules pm
    join public.plans p on p.id = pm.plan_id
    where p.code = 'custom' and pm.enabled
  ),
  0,
  'Personalizado no activa módulos sin override'
);
select results_eq(
  $$
    select p.code::text, pm.enabled
    from public.plan_modules pm
    join public.plans p on p.id = pm.plan_id
    join public.modules m on m.id = pm.module_id
    where m.code = 'audit_access'
    order by p.code::text
  $$,
  $$ values
    ('custom', false),
    ('enterprise', true),
    ('professional', true),
    ('starter', false)
  $$,
  'audit_access coincide con la matriz aprobada'
);

select is(
  (select count(*)::integer from public.limit_definitions),
  7,
  'existen siete definiciones de límites'
);
select results_eq(
  $$ select code from public.limit_definitions order by code $$,
  $$ values
    ('max_admins'),
    ('max_documents_monthly'),
    ('max_documents_total'),
    ('max_drivers'),
    ('max_exports_monthly'),
    ('max_ocr_monthly'),
    ('max_storage_bytes')
  $$,
  'las definiciones de límites coinciden con el contrato'
);

select is((select count(*)::integer from public.organizations), 0, 'no se crean empresas');
select is((select count(*)::integer from public.profiles), 0, 'no se crean perfiles');
select is(
  (select count(*)::integer from public.organization_memberships),
  0,
  'no se crean membresías'
);
select is(
  (select count(*)::integer from public.platform_admins),
  0,
  'no se crea automáticamente un superadmin'
);
select is(
  (select count(*)::integer from public.organization_subscriptions),
  0,
  'no se crean suscripciones empresariales'
);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any(array[
        'profiles',
        'organizations',
        'platform_admins',
        'organization_memberships',
        'plans',
        'organization_subscriptions',
        'modules',
        'plan_modules',
        'organization_module_overrides',
        'limit_definitions',
        'plan_limits',
        'organization_limit_overrides',
        'organization_usage_counters',
        'legacy_identity_links',
        'audit_events'
      ])
      and c.relrowsecurity
      and c.relforcerowsecurity
  ),
  15,
  'RLS y FORCE RLS están activos en todas las tablas'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where grantee = 'anon'
      and table_schema = 'public'
      and table_name = any(array[
        'profiles',
        'organizations',
        'platform_admins',
        'organization_memberships',
        'plans',
        'organization_subscriptions',
        'modules',
        'plan_modules',
        'organization_module_overrides',
        'limit_definitions',
        'plan_limits',
        'organization_limit_overrides',
        'organization_usage_counters',
        'legacy_identity_links',
        'audit_events'
      ])
      and privilege_type = 'SELECT'
  ),
  'anon no tiene SELECT sobre ninguna tabla de Fase 1'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where grantee in ('anon', 'authenticated')
      and table_schema = 'public'
      and table_name = any(array[
        'profiles',
        'organizations',
        'platform_admins',
        'organization_memberships',
        'plans',
        'organization_subscriptions',
        'modules',
        'plan_modules',
        'organization_module_overrides',
        'limit_definitions',
        'plan_limits',
        'organization_limit_overrides',
        'organization_usage_counters',
        'legacy_identity_links',
        'audit_events'
      ])
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  ),
  'anon y authenticated no tienen privilegios de escritura'
);

select * from finish();
rollback;
