begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, auth, pg_catalog;
select no_plan();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values ('a8000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'limits@test.local', '', now(), '{}', '{}', now(), now());

insert into public.profiles (user_id, display_name)
values ('a8000000-0000-4000-8000-000000000001', 'Admin límites');

insert into public.organizations (id, legal_name, status, created_by)
values ('b8000000-0000-4000-8000-000000000001', 'Empresa límites', 'active', 'a8000000-0000-4000-8000-000000000001');

insert into public.organization_memberships (
  organization_id, user_id, role, status, invited_at, joined_at
)
values (
  'b8000000-0000-4000-8000-000000000001',
  'a8000000-0000-4000-8000-000000000001',
  'admin_empresa',
  'active',
  now(),
  now()
);

insert into public.organization_subscriptions (
  organization_id, plan_id, status, payment_status, starts_at
)
select
  'b8000000-0000-4000-8000-000000000001',
  id,
  'active',
  'paid',
  now()
from public.plans
where code = 'starter';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a8000000-0000-4000-8000-000000000001', true);
select is(public.current_organization_limit_value('max_admins'), 1::bigint, 'Starter devuelve 1 admin');
select is(public.current_organization_limit_value('max_drivers'), 5::bigint, 'Starter devuelve 5 conductores');
select ok(public.current_organization_has_capacity('max_drivers', 4, 1), 'hay capacidad hasta el límite');
select ok(not public.current_organization_has_capacity('max_drivers', 5, 1), 'no hay capacidad al superar el límite');

reset role;
update public.organization_subscriptions
set plan_id = (select id from public.plans where code = 'professional')
where organization_id = 'b8000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.current_organization_limit_value('max_admins'), 5::bigint, 'Profesional devuelve 5 admins');
select is(public.current_organization_limit_value('max_drivers'), 25::bigint, 'Profesional devuelve 25 conductores');

reset role;
update public.organization_subscriptions
set plan_id = (select id from public.plans where code = 'enterprise')
where organization_id = 'b8000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.current_organization_limit_value('max_admins'), 100::bigint, 'Enterprise devuelve 100 admins');
select is(public.current_organization_limit_value('max_drivers'), 1000::bigint, 'Enterprise devuelve 1000 conductores');
select is(public.current_organization_limit_value('max_ocr_monthly'), 50000::bigint, 'Enterprise devuelve límite OCR numérico');
select is(public.current_organization_limit_value('max_storage_bytes'), 10995116277760::bigint, 'Enterprise devuelve almacenamiento numérico');

reset role;
update public.organization_subscriptions
set plan_id = (select id from public.plans where code = 'custom')
where organization_id = 'b8000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.current_organization_limit_value('max_drivers'), null::bigint, 'Personalizado sin override devuelve NULL');
select ok(not public.current_organization_has_capacity('max_drivers', 0, 1), 'sin límite configurado no hay capacidad');

reset role;
insert into public.organization_limit_overrides (
  organization_id, limit_definition_id, override_mode, limit_value, reason, changed_by
)
select
  'b8000000-0000-4000-8000-000000000001',
  id,
  'custom',
  12,
  'Prueba override',
  'a8000000-0000-4000-8000-000000000001'
from public.limit_definitions
where code = 'max_drivers';
set local role authenticated;
select is(public.current_organization_limit_value('max_drivers'), 12::bigint, 'override custom sustituye al plan');

reset role;
update public.organization_limit_overrides
set limit_value = 0
where organization_id = 'b8000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.current_organization_limit_value('max_drivers'), 0::bigint, 'cero se conserva como capacidad cero');
select ok(not public.current_organization_has_capacity('max_drivers', 0, 1), 'cero rechaza consumo');

select ok(
  not has_table_privilege('authenticated', 'public.organization_limit_overrides', 'UPDATE'),
  'authenticated no cambia límites directamente'
);

select pass(
  'la reserva atómica de consumo concurrente queda fuera de Fase 1 y debe implementarse antes de consumir límites duros'
);

select * from finish();
rollback;
