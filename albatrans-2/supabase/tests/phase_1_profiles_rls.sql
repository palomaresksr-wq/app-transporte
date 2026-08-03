begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, auth, pg_catalog;
select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'profile-a@test.local', '', now(), '{}', '{}', now(), now()),
  ('a1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'profile-b@test.local', '', now(), '{}', '{}', now(), now()),
  ('a1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'profile-blocked@test.local', '', now(), '{}', '{}', now(), now());

insert into public.profiles (
  user_id, display_name, phone, locale, timezone, status
)
values
  ('a1000000-0000-4000-8000-000000000001', 'Usuario A', null, 'es', 'Europe/Madrid', 'active'),
  ('a1000000-0000-4000-8000-000000000002', 'Usuario B', null, 'es', 'Europe/Madrid', 'active'),
  ('a1000000-0000-4000-8000-000000000003', 'Bloqueado', null, 'es', 'Europe/Madrid', 'blocked');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);

select is((select count(*)::integer from public.profiles), 1, 'el usuario solo lee su perfil');
select is(
  (select display_name from public.profiles),
  'Usuario A',
  'el perfil visible es el propio'
);
select ok(public.current_profile_is_active(), 'el perfil activo se reconoce');
select ok(
  not has_table_privilege('authenticated', 'public.profiles', 'INSERT'),
  'authenticated no puede insertar perfiles'
);
select ok(
  not has_table_privilege('authenticated', 'public.profiles', 'UPDATE'),
  'authenticated no puede actualizar perfiles'
);
select ok(
  not has_table_privilege('authenticated', 'public.profiles', 'DELETE'),
  'authenticated no puede borrar perfiles'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', true);
select ok(not public.current_profile_is_active(), 'un perfil bloqueado no está activo');
select is(
  public.current_organization_id(),
  null::uuid,
  'un perfil bloqueado no resuelve organización'
);

reset role;
select ok(
  not has_table_privilege('anon', 'public.profiles', 'SELECT'),
  'anon no tiene SELECT sobre profiles'
);

select * from finish();
rollback;
