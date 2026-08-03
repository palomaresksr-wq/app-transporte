begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, auth, pg_catalog;
select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('a2000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'org-admin@test.local', '', now(), '{}', '{}', now(), now());

insert into public.profiles (user_id, display_name)
values ('a2000000-0000-4000-8000-000000000001', 'Admin organización');

insert into public.organizations (
  id, legal_name, country_code, currency_code, status, created_by
)
values
  ('b2000000-0000-4000-8000-000000000001', 'Empresa propia', 'ES', 'EUR', 'active', 'a2000000-0000-4000-8000-000000000001'),
  ('b2000000-0000-4000-8000-000000000002', 'Empresa ajena', 'ES', 'EUR', 'active', 'a2000000-0000-4000-8000-000000000001');

insert into public.organization_memberships (
  organization_id, user_id, role, status, invited_at, joined_at
)
values (
  'b2000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'admin_empresa',
  'active',
  now(),
  now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);

select is((select count(*)::integer from public.organizations), 1, 'solo se ve la empresa propia');
select is(
  (select legal_name from public.organizations),
  'Empresa propia',
  'no se filtra accidentalmente hacia otra empresa'
);
select ok(public.current_organization_is_active(), 'active permite operación normal');

reset role;
update public.organizations
set status = 'pending'
where id = 'b2000000-0000-4000-8000-000000000001';
set local role authenticated;
select ok(not public.current_organization_is_active(), 'pending no permite operar');

reset role;
update public.organizations
set status = 'maintenance'
where id = 'b2000000-0000-4000-8000-000000000001';
set local role authenticated;
select ok(not public.current_organization_is_active(), 'maintenance no permite operar');

reset role;
update public.organizations
set status = 'blocked', status_reason = 'Prueba'
where id = 'b2000000-0000-4000-8000-000000000001';
set local role authenticated;
select ok(not public.current_organization_is_active(), 'blocked no permite operar');

reset role;
update public.organizations
set status = 'suspended', status_reason = 'Prueba'
where id = 'b2000000-0000-4000-8000-000000000001';
set local role authenticated;
select ok(not public.current_organization_is_active(), 'suspended no permite operar');

reset role;
update public.organizations
set status = 'archived', status_reason = null, archived_at = now()
where id = 'b2000000-0000-4000-8000-000000000001';
set local role authenticated;
select ok(not public.current_organization_is_active(), 'archived no permite operar');

select ok(
  not has_table_privilege('authenticated', 'public.organizations', 'UPDATE'),
  'authenticated no puede cambiar el estado directamente'
);

select * from finish();
rollback;
