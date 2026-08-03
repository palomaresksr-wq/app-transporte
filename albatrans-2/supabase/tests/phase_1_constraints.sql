begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, auth, pg_catalog;
select no_plan();

create function pg_temp.sqlstate_of(p_command text)
returns text
language plpgsql
as $$
begin
  execute p_command;
  return null;
exception
  when others then
    return sqlstate;
end;
$$;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('a9000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'constraints-owner@test.local', '', now(), '{}', '{}', now(), now()),
  ('a9000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'constraints-other@test.local', '', now(), '{}', '{}', now(), now());

insert into public.profiles (user_id, display_name)
values
  ('a9000000-0000-4000-8000-000000000001', 'Propietario fixtures'),
  ('a9000000-0000-4000-8000-000000000002', 'Otro fixture');

insert into public.organizations (
  id, legal_name, tax_id, country_code, status, created_by
)
values
  ('b9000000-0000-4000-8000-000000000001', 'Empresa constraints A', 'TEST-TAX-ID', 'ES', 'active', 'a9000000-0000-4000-8000-000000000001'),
  ('b9000000-0000-4000-8000-000000000002', 'Empresa constraints B', 'OTHER-TAX-ID', 'ES', 'active', 'a9000000-0000-4000-8000-000000000001');

insert into public.organization_memberships (
  organization_id, user_id, role, status, invited_at, joined_at
)
values (
  'b9000000-0000-4000-8000-000000000001',
  'a9000000-0000-4000-8000-000000000001',
  'admin_empresa',
  'active',
  now(),
  now()
);

select is(
  pg_temp.sqlstate_of($command$
    insert into public.organization_memberships (
      organization_id, user_id, role, status, invited_at, joined_at
    )
    values (
      'b9000000-0000-4000-8000-000000000002',
      'a9000000-0000-4000-8000-000000000001',
      'conductor',
      'active',
      now(),
      now()
    )
  $command$),
  '23505',
  'un usuario no puede pertenecer a dos empresas'
);

select is(
  pg_temp.sqlstate_of($command$
    insert into public.organizations (
      legal_name, tax_id, country_code, status, created_by
    )
    values (
      'Empresa NIF duplicado',
      'TEST-TAX-ID',
      'ES',
      'active',
      'a9000000-0000-4000-8000-000000000001'
    )
  $command$),
  '23505',
  'country_code más tax_id es único'
);

select is(
  pg_temp.sqlstate_of($command$
    update public.organizations
    set status = 'archived'
    where id = 'b9000000-0000-4000-8000-000000000001'
  $command$),
  '23514',
  'archived exige archived_at'
);

select is(
  pg_temp.sqlstate_of($command$
    insert into public.organization_module_overrides (
      organization_id, module_id, override_mode, reason, changed_by
    )
    select
      'b9000000-0000-4000-8000-000000000001',
      id,
      'disabled',
      null,
      'a9000000-0000-4000-8000-000000000001'
    from public.modules
    where code = 'billing'
  $command$),
  '23514',
  'un override de módulo enabled o disabled exige motivo'
);

select is(
  pg_temp.sqlstate_of($command$
    insert into public.organization_limit_overrides (
      organization_id, limit_definition_id, override_mode,
      limit_value, reason, changed_by
    )
    select
      'b9000000-0000-4000-8000-000000000001',
      id,
      'custom',
      10,
      null,
      'a9000000-0000-4000-8000-000000000001'
    from public.limit_definitions
    where code = 'max_drivers'
  $command$),
  '23514',
  'un override custom de límite exige motivo'
);

select is(
  pg_temp.sqlstate_of($command$
    update public.plan_modules
    set configuration = '[]'::jsonb
    where plan_id = (
      select id from public.plans where code = 'starter'
    )
    and module_id = (
      select id from public.modules where code = 'billing'
    )
  $command$),
  '23514',
  'plan_modules rechaza configuraciones JSON que no sean objetos'
);

insert into public.organization_module_overrides (
  organization_id, module_id, override_mode, reason, configuration, changed_by
)
select
  'b9000000-0000-4000-8000-000000000001',
  id,
  'inherit',
  null,
  '{}'::jsonb,
  'a9000000-0000-4000-8000-000000000001'
from public.modules
where code = 'billing';

select is(
  pg_temp.sqlstate_of($command$
    update public.organization_module_overrides
    set configuration = '["invalid"]'::jsonb
    where organization_id = 'b9000000-0000-4000-8000-000000000001'
  $command$),
  '23514',
  'overrides de módulo rechazan configuraciones JSON que no sean objetos'
);

select is(
  pg_temp.sqlstate_of($command$
    update public.plan_limits
    set limit_value = -1
    where plan_id = (
      select id from public.plans where code = 'starter'
    )
    and limit_definition_id = (
      select id from public.limit_definitions where code = 'max_drivers'
    )
  $command$),
  '23514',
  'los límites de plan no aceptan valores negativos'
);

select is(
  pg_temp.sqlstate_of($command$
    insert into public.organization_limit_overrides (
      organization_id, limit_definition_id, override_mode,
      limit_value, reason, changed_by
    )
    select
      'b9000000-0000-4000-8000-000000000001',
      id,
      'custom',
      -1,
      'Valor inválido de prueba',
      'a9000000-0000-4000-8000-000000000001'
    from public.limit_definitions
    where code = 'max_admins'
  $command$),
  '23514',
  'los overrides no aceptan valores negativos'
);

select * from finish();
rollback;
