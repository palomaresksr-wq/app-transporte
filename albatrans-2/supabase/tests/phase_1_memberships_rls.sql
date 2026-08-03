begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, auth, pg_catalog;
select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  user_id,
  'authenticated',
  'authenticated',
  email,
  '',
  now(),
  '{}',
  '{}',
  now(),
  now()
from (
  values
    ('a3000000-0000-4000-8000-000000000001'::uuid, 'admin-a@test.local'),
    ('a3000000-0000-4000-8000-000000000002'::uuid, 'driver-a@test.local'),
    ('a3000000-0000-4000-8000-000000000003'::uuid, 'admin-b@test.local'),
    ('a3000000-0000-4000-8000-000000000004'::uuid, 'no-membership@test.local')
) users(user_id, email);

insert into public.profiles (user_id, display_name)
values
  ('a3000000-0000-4000-8000-000000000001', 'Admin A'),
  ('a3000000-0000-4000-8000-000000000002', 'Conductor A'),
  ('a3000000-0000-4000-8000-000000000003', 'Admin B'),
  ('a3000000-0000-4000-8000-000000000004', 'Sin membresía');

insert into public.organizations (
  id, legal_name, status, created_by
)
values
  ('b3000000-0000-4000-8000-000000000001', 'Empresa A', 'active', 'a3000000-0000-4000-8000-000000000001'),
  ('b3000000-0000-4000-8000-000000000002', 'Empresa B', 'active', 'a3000000-0000-4000-8000-000000000003');

insert into public.organization_memberships (
  id, organization_id, user_id, role, status, invited_at, joined_at
)
values
  ('c3000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'admin_empresa', 'active', now(), now()),
  ('c3000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000002', 'conductor', 'active', now(), now()),
  ('c3000000-0000-4000-8000-000000000003', 'b3000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000003', 'admin_empresa', 'active', now(), now());

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000001', true);
select is(
  (select count(*)::integer from public.organization_memberships),
  2,
  'admin A ve únicamente miembros de A'
);
select is(
  public.current_organization_id(),
  'b3000000-0000-4000-8000-000000000001'::uuid,
  'admin A resuelve su organización'
);
select is(
  public.current_organization_role()::text,
  'admin_empresa',
  'admin A resuelve su rol'
);

select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000002', true);
select is(
  (select count(*)::integer from public.organization_memberships),
  1,
  'un conductor solo ve su propia membresía'
);

select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000004', true);
select is(
  public.current_organization_id(),
  null::uuid,
  'usuario sin membresía no resuelve organización'
);
select is(
  (select count(*)::integer from public.organizations),
  0,
  'usuario sin membresía no ve empresas'
);

reset role;
update public.organization_memberships
set status = 'blocked'
where id = 'c3000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000002', true);
select is(public.current_organization_id(), null::uuid, 'membresía bloqueada no accede');

reset role;
update public.organization_memberships
set status = 'suspended', suspended_at = now()
where id = 'c3000000-0000-4000-8000-000000000002';
set local role authenticated;
select is(public.current_organization_id(), null::uuid, 'membresía suspendida no accede');

reset role;
update public.organization_memberships
set status = 'revoked', suspended_at = null
where id = 'c3000000-0000-4000-8000-000000000002';
set local role authenticated;
select is(public.current_organization_id(), null::uuid, 'membresía revocada no accede');

select ok(
  not has_table_privilege('authenticated', 'public.organization_memberships', 'INSERT'),
  'authenticated no crea membresías directamente'
);

select * from finish();
rollback;
