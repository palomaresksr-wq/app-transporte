begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, auth, pg_catalog;
select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('a5000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'modules@test.local', '', now(), '{}', '{}', now(), now());

insert into public.profiles (user_id, display_name)
values ('a5000000-0000-4000-8000-000000000001', 'Admin módulos');

insert into public.organizations (id, legal_name, status, created_by)
values ('b5000000-0000-4000-8000-000000000001', 'Empresa módulos', 'active', 'a5000000-0000-4000-8000-000000000001');

insert into public.organization_memberships (
  organization_id, user_id, role, status, invited_at, joined_at
)
values (
  'b5000000-0000-4000-8000-000000000001',
  'a5000000-0000-4000-8000-000000000001',
  'admin_empresa',
  'active',
  now(),
  now()
);

insert into public.organization_subscriptions (
  organization_id, plan_id, status, payment_status, starts_at
)
select
  'b5000000-0000-4000-8000-000000000001',
  id,
  'active',
  'paid',
  now()
from public.plans
where code = 'starter';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a5000000-0000-4000-8000-000000000001', true);

select ok(
  public.current_organization_module_enabled('transport_management'),
  'Starter hereda transport_management activo'
);
select ok(
  not public.current_organization_module_enabled('ocr'),
  'Starter hereda OCR inactivo'
);
select ok(
  not public.current_organization_module_enabled('does_not_exist'),
  'un módulo inexistente devuelve false'
);

reset role;
insert into public.organization_module_overrides (
  organization_id, module_id, override_mode, reason, changed_by
)
select
  'b5000000-0000-4000-8000-000000000001',
  id,
  'enabled',
  'Prueba de activación',
  'a5000000-0000-4000-8000-000000000001'
from public.modules
where code = 'ocr';

set local role authenticated;
select ok(
  public.current_organization_module_enabled('ocr'),
  'override enabled activa un módulo no incluido'
);

reset role;
insert into public.organization_module_overrides (
  organization_id, module_id, override_mode, reason, changed_by
)
select
  'b5000000-0000-4000-8000-000000000001',
  id,
  'disabled',
  'Prueba de desactivación',
  'a5000000-0000-4000-8000-000000000001'
from public.modules
where code = 'transport_management';

set local role authenticated;
select ok(
  not public.current_organization_module_enabled('transport_management'),
  'override disabled desactiva un módulo incluido'
);

reset role;
update public.organization_module_overrides
set override_mode = 'inherit', reason = null
where organization_id = 'b5000000-0000-4000-8000-000000000001'
  and module_id = (
    select id from public.modules where code = 'transport_management'
  );

set local role authenticated;
select ok(
  public.current_organization_module_enabled('transport_management'),
  'inherit recupera el valor del plan'
);
select ok(
  not public.is_platform_superadmin(),
  'support_access no concede capacidades de superadmin'
);

reset role;
update public.organization_module_overrides
set override_mode = 'enabled', reason = 'Prueba audit_access'
where organization_id = 'b5000000-0000-4000-8000-000000000001'
  and module_id = (select id from public.modules where code = 'ocr');

insert into public.organization_module_overrides (
  organization_id, module_id, override_mode, reason, changed_by
)
select
  'b5000000-0000-4000-8000-000000000001',
  id,
  'enabled',
  'Prueba audit_access',
  'a5000000-0000-4000-8000-000000000001'
from public.modules
where code = 'audit_access';

set local role authenticated;
select ok(
  public.current_organization_module_enabled('audit_access'),
  'audit_access puede activarse por override'
);

reset role;
insert into public.organization_module_overrides (
  organization_id, module_id, override_mode, reason, changed_by
)
select
  'b5000000-0000-4000-8000-000000000001',
  id,
  'enabled',
  'Prueba support_access',
  'a5000000-0000-4000-8000-000000000001'
from public.modules
where code = 'support_access';

insert into public.audit_events (
  organization_id, actor_user_id, actor_scope, action, entity_type,
  entity_id, reason, correlation_id
)
values (
  'b5000000-0000-4000-8000-000000000001',
  'a5000000-0000-4000-8000-000000000001',
  'organization',
  'module.tested',
  'module',
  'audit_access',
  'Prueba de aislamiento',
  gen_random_uuid()
);

set local role authenticated;
select ok(
  public.current_organization_module_enabled('support_access'),
  'support_access puede estar comercialmente activo'
);
select ok(
  not public.is_platform_superadmin(),
  'support_access activo no convierte al usuario en superadmin'
);
select is(
  (select count(*)::integer from public.audit_events),
  0,
  'audit_access activo no concede acceso global a una auditoría existente'
);

select * from finish();
rollback;
