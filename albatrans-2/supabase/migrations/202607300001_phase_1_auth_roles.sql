-- Albatrans 2.0 · Fase 1
-- Fundación SaaS, identidad, organizaciones, planes, módulos y RLS.
--
-- PROPUESTA LOCAL. ESTA MIGRACIÓN NO HA SIDO EJECUTADA.
--
-- Decisiones de seguridad:
--   * Supabase Auth es el único gestor de contraseñas.
--   * profiles no contiene role ni organization_id.
--   * superadmin es un rol de plataforma sin organization_membership.
--   * cada usuario empresarial pertenece como máximo a una organización.
--   * ninguna tabla legacy se altera, consulta o referencia mediante FK.
--   * los clientes authenticated solo reciben permisos de lectura.
--   * las escrituras sensibles se reservan para Edge Functions autorizadas.
--   * support_access es una prestación comercial. No concede ni limita las
--     facultades técnicas del superadmin.
--   * esta fase no crea acceso de soporte a datos operativos porque tampoco
--     crea tablas operativas. Las futuras policies de datos tenant deberán
--     exigir un contexto de soporte con motivo y auditoría, sin depender de
--     support_access.

begin;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
-- Se crean de forma estricta. Si un objeto estructural ya existe, la migración
-- debe fallar para que la incompatibilidad se investigue expresamente.

create type public.profile_status as enum (
  'active',
  'blocked'
);

create type public.platform_role as enum (
  'superadmin'
);

create type public.platform_admin_status as enum (
  'active',
  'blocked'
);

create type public.organization_role as enum (
  'admin_empresa',
  'conductor'
);

create type public.membership_status as enum (
  'invited',
  'active',
  'blocked',
  'suspended',
  'revoked'
);

create type public.organization_status as enum (
  'pending',
  'active',
  'maintenance',
  'blocked',
  'suspended',
  'archived'
);

create type public.plan_code as enum (
  'starter',
  'professional',
  'enterprise',
  'custom'
);

create type public.plan_status as enum (
  'active',
  'inactive',
  'archived'
);

create type public.billing_interval as enum (
  'monthly',
  'yearly',
  'custom'
);

create type public.subscription_status as enum (
  'trial',
  'active',
  'past_due',
  'suspended',
  'cancelled',
  'expired'
);

create type public.payment_status as enum (
  'not_required',
  'pending',
  'paid',
  'overdue',
  'failed'
);

create type public.module_status as enum (
  'active',
  'deprecated'
);

create type public.module_override_mode as enum (
  'inherit',
  'enabled',
  'disabled'
);

create type public.limit_unit as enum (
  'count',
  'bytes',
  'requests'
);

create type public.limit_period as enum (
  'total',
  'monthly',
  'daily'
);

create type public.limit_enforcement as enum (
  'hard',
  'soft',
  'informational'
);

create type public.limit_status as enum (
  'active',
  'deprecated'
);

create type public.limit_override_mode as enum (
  'inherit',
  'custom'
);

create type public.audit_actor_scope as enum (
  'platform',
  'organization',
  'system'
);

create type public.legacy_entity_type as enum (
  'admin_empresa',
  'conductor'
);

create type public.legacy_migration_status as enum (
  'pending',
  'matched',
  'invited',
  'activated',
  'conflict',
  'retired'
);

-- ---------------------------------------------------------------------------
-- Identidad y organizaciones
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key
    references auth.users(id) on delete cascade,
  display_name text not null,
  phone text null,
  locale text not null default 'es',
  timezone text not null default 'Europe/Madrid',
  status public.profile_status not null default 'active',
  last_login_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_display_name_not_blank
    check (length(btrim(display_name)) > 0),
  constraint profiles_locale_not_blank
    check (length(btrim(locale)) > 0),
  constraint profiles_timezone_not_blank
    check (length(btrim(timezone)) > 0)
);

comment on table public.profiles is
  'Perfil personal vinculado a Supabase Auth. No contiene empresa ni rol.';

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text null,
  tax_id text null,
  email text null,
  phone text null,
  country_code text not null default 'ES',
  timezone text not null default 'Europe/Madrid',
  currency_code text not null default 'EUR',
  status public.organization_status not null default 'pending',
  status_reason text null,
  status_changed_at timestamptz not null default now(),
  status_changed_by uuid null
    references auth.users(id) on delete restrict,
  internal_notes text null,
  created_by uuid not null
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,

  constraint organizations_legal_name_not_blank
    check (length(btrim(legal_name)) > 0),
  constraint organizations_country_code_format
    check (country_code ~ '^[A-Z]{2}$'),
  constraint organizations_currency_code_format
    check (currency_code ~ '^[A-Z]{3}$'),
  constraint organizations_timezone_not_blank
    check (length(btrim(timezone)) > 0),
  constraint organizations_status_reason_consistency
    check (
      status not in ('blocked', 'suspended')
      or length(btrim(coalesce(status_reason, ''))) > 0
    ),
  constraint organizations_archive_consistency
    check (
      (status = 'archived' and archived_at is not null)
      or
      (status <> 'archived' and archived_at is null)
    ),
  constraint organizations_country_tax_unique
    unique (country_code, tax_id)
);

comment on table public.organizations is
  'Tenant SaaS. Bloquear, suspender, mantener o archivar nunca borra datos.';
comment on column public.organizations.internal_notes is
  'Notas internas visibles únicamente para superadministración.';
comment on column public.organizations.status is
  'Solo active permite acceso empresarial ordinario.';

create table public.platform_admins (
  user_id uuid primary key
    references auth.users(id) on delete restrict,
  role public.platform_role not null default 'superadmin',
  status public.platform_admin_status not null default 'active',
  singleton_key boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint platform_admins_singleton_key_true
    check (singleton_key),
  constraint platform_admins_only_one
    unique (singleton_key)
);

comment on table public.platform_admins is
  'Rol de plataforma independiente. La restricción singleton garantiza un solo superadmin.';
comment on column public.platform_admins.singleton_key is
  'Valor técnico fijo que impide registrar más de una cuenta superadmin.';

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  user_id uuid not null
    references auth.users(id) on delete restrict,
  role public.organization_role not null,
  status public.membership_status not null default 'invited',
  invited_by uuid null
    references auth.users(id) on delete restrict,
  invited_at timestamptz null,
  joined_at timestamptz null,
  suspended_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint organization_memberships_one_organization_per_user
    unique (user_id),
  constraint organization_memberships_invitation_consistency
    check (
      status <> 'invited'
      or invited_at is not null
    ),
  constraint organization_memberships_joined_consistency
    check (
      status not in ('active', 'blocked', 'suspended', 'revoked')
      or joined_at is not null
    ),
  constraint organization_memberships_suspended_consistency
    check (
      status <> 'suspended'
      or suspended_at is not null
    )
);

comment on table public.organization_memberships is
  'Rol empresarial. user_id único limita cada usuario a una empresa en v1.';

-- ---------------------------------------------------------------------------
-- Planes, suscripciones, módulos y límites
-- ---------------------------------------------------------------------------

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code public.plan_code not null unique,
  name text not null,
  description text null,
  status public.plan_status not null default 'active',
  billing_interval public.billing_interval not null,
  base_price numeric(12, 2) null,
  currency_code text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint plans_name_not_blank
    check (length(btrim(name)) > 0),
  constraint plans_base_price_non_negative
    check (base_price is null or base_price >= 0),
  constraint plans_currency_code_format
    check (currency_code ~ '^[A-Z]{3}$')
);

create table public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique
    references public.organizations(id) on delete restrict,
  plan_id uuid not null
    references public.plans(id) on delete restrict,
  status public.subscription_status not null,
  payment_status public.payment_status not null default 'pending',
  starts_at timestamptz not null,
  current_period_starts_at timestamptz null,
  current_period_ends_at timestamptz null,
  paid_through timestamptz null,
  grace_period_ends_at timestamptz null,
  cancel_at_period_end boolean not null default false,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint organization_subscriptions_period_order
    check (
      current_period_starts_at is null
      or current_period_ends_at is null
      or current_period_ends_at >= current_period_starts_at
    ),
  constraint organization_subscriptions_grace_order
    check (
      grace_period_ends_at is null
      or current_period_ends_at is null
      or grace_period_ends_at >= current_period_ends_at
    )
);

comment on table public.organization_subscriptions is
  'Plan, pago y vencimiento. Un impago no elimina ni modifica datos tenant.';

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text null,
  status public.module_status not null default 'active',
  category text not null,
  route_prefix text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint modules_code_format
    check (code ~ '^[a-z][a-z0-9_]*$'),
  constraint modules_name_not_blank
    check (length(btrim(name)) > 0),
  constraint modules_category_not_blank
    check (length(btrim(category)) > 0),
  constraint modules_sort_order_non_negative
    check (sort_order >= 0)
);

comment on table public.modules is
  'Catálogo extensible. support_access es una prestación comercial y no controla al superadmin.';

create table public.plan_modules (
  plan_id uuid not null
    references public.plans(id) on delete cascade,
  module_id uuid not null
    references public.modules(id) on delete cascade,
  enabled boolean not null,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (plan_id, module_id),
  constraint plan_modules_configuration_object
    check (jsonb_typeof(configuration) = 'object')
);

create table public.organization_module_overrides (
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  module_id uuid not null
    references public.modules(id) on delete restrict,
  override_mode public.module_override_mode not null default 'inherit',
  reason text null,
  configuration jsonb not null default '{}'::jsonb,
  changed_by uuid not null
    references auth.users(id) on delete restrict,
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (organization_id, module_id),
  constraint organization_module_overrides_configuration_object
    check (jsonb_typeof(configuration) = 'object'),
  constraint organization_module_overrides_reason_for_change
    check (
      override_mode = 'inherit'
      or length(btrim(coalesce(reason, ''))) > 0
    )
);

comment on table public.organization_module_overrides is
  'Un override cambia disponibilidad, nunca elimina datos del módulo.';

create table public.limit_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text null,
  module_id uuid null
    references public.modules(id) on delete restrict,
  unit public.limit_unit not null,
  period public.limit_period not null,
  enforcement public.limit_enforcement not null,
  status public.limit_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint limit_definitions_code_format
    check (code ~ '^[a-z][a-z0-9_]*$'),
  constraint limit_definitions_name_not_blank
    check (length(btrim(name)) > 0)
);

create table public.plan_limits (
  plan_id uuid not null
    references public.plans(id) on delete cascade,
  limit_definition_id uuid not null
    references public.limit_definitions(id) on delete cascade,
  limit_value bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (plan_id, limit_definition_id),
  constraint plan_limits_value_non_negative
    check (limit_value >= 0)
);

comment on table public.plan_limits is
  'Todos los límites son numéricos. No existe un caso especial ilimitado.';

create table public.organization_limit_overrides (
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  limit_definition_id uuid not null
    references public.limit_definitions(id) on delete restrict,
  override_mode public.limit_override_mode not null default 'inherit',
  limit_value bigint null,
  reason text null,
  changed_by uuid not null
    references auth.users(id) on delete restrict,
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (organization_id, limit_definition_id),
  constraint organization_limit_overrides_value_consistency
    check (
      (override_mode = 'inherit' and limit_value is null)
      or
      (override_mode = 'custom' and limit_value is not null and limit_value >= 0)
    ),
  constraint organization_limit_overrides_reason_for_change
    check (
      override_mode = 'inherit'
      or length(btrim(coalesce(reason, ''))) > 0
    )
);

create table public.organization_usage_counters (
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  metric_code text not null,
  period_start timestamptz not null,
  period_end timestamptz null,
  usage_value bigint not null default 0,
  updated_at timestamptz not null default now(),

  primary key (organization_id, metric_code, period_start),
  constraint organization_usage_counters_metric_code_format
    check (metric_code ~ '^[a-z][a-z0-9_]*$'),
  constraint organization_usage_counters_usage_non_negative
    check (usage_value >= 0),
  constraint organization_usage_counters_period_order
    check (period_end is null or period_end >= period_start)
);

-- ---------------------------------------------------------------------------
-- Vinculación legacy y auditoría
-- ---------------------------------------------------------------------------

create table public.legacy_identity_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  membership_id uuid not null unique
    references public.organization_memberships(id) on delete restrict,
  legacy_entity_type public.legacy_entity_type not null,
  legacy_table text not null,
  legacy_id_text text not null,
  legacy_username text null,
  migration_status public.legacy_migration_status not null default 'pending',
  verified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint legacy_identity_links_table_allowed
    check (legacy_table in ('admins_empresa', 'conductores')),
  constraint legacy_identity_links_entity_table_consistency
    check (
      (legacy_entity_type = 'admin_empresa' and legacy_table = 'admins_empresa')
      or
      (legacy_entity_type = 'conductor' and legacy_table = 'conductores')
    ),
  constraint legacy_identity_links_id_not_blank
    check (length(btrim(legacy_id_text)) > 0),
  constraint legacy_identity_links_source_unique
    unique (legacy_table, legacy_id_text)
);

comment on table public.legacy_identity_links is
  'Correspondencia preparada sin FK ni escritura sobre tablas legacy.';

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null
    references public.organizations(id) on delete restrict,
  actor_user_id uuid null
    references auth.users(id) on delete set null,
  actor_scope public.audit_actor_scope not null,
  action text not null,
  entity_type text not null,
  entity_id text null,
  before_data jsonb null,
  after_data jsonb null,
  reason text null,
  correlation_id uuid not null,
  occurred_at timestamptz not null default now(),
  ip_address inet null,
  user_agent text null,

  constraint audit_events_action_format
    check (action ~ '^[a-z][a-z0-9_.]*$'),
  constraint audit_events_entity_type_format
    check (entity_type ~ '^[a-z][a-z0-9_]*$'),
  constraint audit_events_before_data_object
    check (before_data is null or jsonb_typeof(before_data) = 'object'),
  constraint audit_events_after_data_object
    check (after_data is null or jsonb_typeof(after_data) = 'object'),
  constraint audit_events_actor_consistency
    check (
      actor_scope = 'system'
      or actor_user_id is not null
    ),
  constraint audit_events_organization_scope_consistency
    check (
      actor_scope <> 'organization'
      or organization_id is not null
    )
);

comment on table public.audit_events is
  'Registro append-only. No debe contener contraseñas, tokens ni secretos.';
comment on column public.audit_events.reason is
  'Obligatorio a nivel de API para soporte, suspensiones y cambios sensibles.';

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

create index organizations_status_idx
  on public.organizations (status);

create index organizations_active_created_idx
  on public.organizations (created_at desc)
  where status <> 'archived';

create index organization_memberships_organization_role_status_idx
  on public.organization_memberships (organization_id, role, status);

create index organization_memberships_active_organization_idx
  on public.organization_memberships (organization_id, user_id)
  where status = 'active';

create index organization_subscriptions_plan_status_idx
  on public.organization_subscriptions (plan_id, status);

create index organization_subscriptions_expiry_idx
  on public.organization_subscriptions (current_period_ends_at)
  where status in ('trial', 'active', 'past_due');

create index modules_status_sort_idx
  on public.modules (status, sort_order);

create index organization_module_overrides_module_idx
  on public.organization_module_overrides (module_id, override_mode);

create index limit_definitions_module_idx
  on public.limit_definitions (module_id)
  where module_id is not null;

create index organization_limit_overrides_limit_idx
  on public.organization_limit_overrides (limit_definition_id, override_mode);

create index organization_usage_counters_metric_period_idx
  on public.organization_usage_counters (metric_code, period_start desc);

create index legacy_identity_links_organization_status_idx
  on public.legacy_identity_links (organization_id, migration_status);

create index legacy_identity_links_username_idx
  on public.legacy_identity_links (lower(legacy_username))
  where legacy_username is not null;

create index audit_events_organization_time_idx
  on public.audit_events (organization_id, occurred_at desc);

create index audit_events_actor_time_idx
  on public.audit_events (actor_user_id, occurred_at desc)
  where actor_user_id is not null;

create index audit_events_entity_idx
  on public.audit_events (entity_type, entity_id, occurred_at desc);

create index audit_events_correlation_idx
  on public.audit_events (correlation_id);

-- ---------------------------------------------------------------------------
-- Mantenimiento de updated_at
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger invoker sin privilegios elevados para mantener updated_at.';

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger platform_admins_set_updated_at
before update on public.platform_admins
for each row execute function public.set_updated_at();

create trigger organization_memberships_set_updated_at
before update on public.organization_memberships
for each row execute function public.set_updated_at();

create trigger plans_set_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

create trigger organization_subscriptions_set_updated_at
before update on public.organization_subscriptions
for each row execute function public.set_updated_at();

create trigger modules_set_updated_at
before update on public.modules
for each row execute function public.set_updated_at();

create trigger plan_modules_set_updated_at
before update on public.plan_modules
for each row execute function public.set_updated_at();

create trigger organization_module_overrides_set_updated_at
before update on public.organization_module_overrides
for each row execute function public.set_updated_at();

create trigger limit_definitions_set_updated_at
before update on public.limit_definitions
for each row execute function public.set_updated_at();

create trigger plan_limits_set_updated_at
before update on public.plan_limits
for each row execute function public.set_updated_at();

create trigger organization_limit_overrides_set_updated_at
before update on public.organization_limit_overrides
for each row execute function public.set_updated_at();

create trigger legacy_identity_links_set_updated_at
before update on public.legacy_identity_links
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Funciones auxiliares de autorización
-- ---------------------------------------------------------------------------
-- Son SECURITY DEFINER únicamente para evitar recursión RLS al consultar las
-- tablas que determinan identidad y acceso. No usan SQL dinámico y fijan un
-- search_path explícito. Solo se concede EXECUTE a authenticated.

create function public.current_profile_is_active()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.status = 'active'
  )
$$;

create function public.is_platform_superadmin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.platform_admins pa
      on pa.user_id = p.user_id
    where p.user_id = auth.uid()
      and p.status = 'active'
      and pa.role = 'superadmin'
      and pa.status = 'active'
  )
$$;

create function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select m.organization_id
  from public.organization_memberships m
  join public.profiles p
    on p.user_id = m.user_id
  where m.user_id = auth.uid()
    and p.status = 'active'
    and m.status = 'active'
  limit 1
$$;

create function public.current_organization_role()
returns public.organization_role
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select m.role
  from public.organization_memberships m
  join public.profiles p
    on p.user_id = m.user_id
  where m.user_id = auth.uid()
    and p.status = 'active'
    and m.status = 'active'
  limit 1
$$;

create function public.current_organization_is_active()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organizations o
    where o.id = public.current_organization_id()
      and o.status = 'active'
  )
$$;

create function public.current_organization_module_enabled(p_module_code text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    when current_org.id is null then false
    when module_row.id is null then false
    when override_row.override_mode = 'enabled' then true
    when override_row.override_mode = 'disabled' then false
    else coalesce(plan_module.enabled, false)
  end
  from (
    select public.current_organization_id() as id
  ) current_org
  left join public.organization_subscriptions subscription
    on subscription.organization_id = current_org.id
  left join public.modules module_row
    on module_row.code = p_module_code
   and module_row.status = 'active'
  left join public.plan_modules plan_module
    on plan_module.plan_id = subscription.plan_id
   and plan_module.module_id = module_row.id
  left join public.organization_module_overrides override_row
    on override_row.organization_id = current_org.id
   and override_row.module_id = module_row.id
$$;

comment on function public.current_organization_module_enabled(text) is
  'Resuelve plan + override para el usuario tenant actual. No concede acceso al superadmin ni depende de support_access.';

create function public.current_organization_limit_value(p_limit_code text)
returns bigint
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    when override_row.override_mode = 'custom'
      then override_row.limit_value
    else plan_limit.limit_value
  end
  from (
    select public.current_organization_id() as id
  ) current_org
  left join public.organization_subscriptions subscription
    on subscription.organization_id = current_org.id
  left join public.limit_definitions definition
    on definition.code = p_limit_code
   and definition.status = 'active'
  left join public.plan_limits plan_limit
    on plan_limit.plan_id = subscription.plan_id
   and plan_limit.limit_definition_id = definition.id
  left join public.organization_limit_overrides override_row
    on override_row.organization_id = current_org.id
   and override_row.limit_definition_id = definition.id
$$;

create function public.current_organization_has_capacity(
  p_limit_code text,
  p_current_usage bigint,
  p_requested_amount bigint default 1
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    p_current_usage >= 0
    and p_requested_amount >= 0
    and public.current_organization_limit_value(p_limit_code) is not null
    and p_current_usage + p_requested_amount
      <= public.current_organization_limit_value(p_limit_code)
$$;

comment on function public.current_organization_limit_value(text) is
  'Devuelve NULL si no existe plan ni override; la API debe rechazar una cuota sin configurar.';

-- Permisos de funciones: revocación explícita del permiso PUBLIC por defecto.
revoke all on function public.set_updated_at() from public;
revoke all on function public.current_profile_is_active() from public;
revoke all on function public.is_platform_superadmin() from public;
revoke all on function public.current_organization_id() from public;
revoke all on function public.current_organization_role() from public;
revoke all on function public.current_organization_is_active() from public;
revoke all on function public.current_organization_module_enabled(text) from public;
revoke all on function public.current_organization_limit_value(text) from public;
revoke all on function public.current_organization_has_capacity(text, bigint, bigint) from public;

grant execute on function public.current_profile_is_active() to authenticated;
grant execute on function public.is_platform_superadmin() to authenticated;
grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.current_organization_role() to authenticated;
grant execute on function public.current_organization_is_active() to authenticated;
grant execute on function public.current_organization_module_enabled(text) to authenticated;
grant execute on function public.current_organization_limit_value(text) to authenticated;
grant execute on function public.current_organization_has_capacity(text, bigint, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.platform_admins enable row level security;
alter table public.platform_admins force row level security;
alter table public.organization_memberships enable row level security;
alter table public.organization_memberships force row level security;
alter table public.plans enable row level security;
alter table public.plans force row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.organization_subscriptions force row level security;
alter table public.modules enable row level security;
alter table public.modules force row level security;
alter table public.plan_modules enable row level security;
alter table public.plan_modules force row level security;
alter table public.organization_module_overrides enable row level security;
alter table public.organization_module_overrides force row level security;
alter table public.limit_definitions enable row level security;
alter table public.limit_definitions force row level security;
alter table public.plan_limits enable row level security;
alter table public.plan_limits force row level security;
alter table public.organization_limit_overrides enable row level security;
alter table public.organization_limit_overrides force row level security;
alter table public.organization_usage_counters enable row level security;
alter table public.organization_usage_counters force row level security;
alter table public.legacy_identity_links enable row level security;
alter table public.legacy_identity_links force row level security;
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;

-- Profiles: propio, superadmin o admin de la misma empresa.
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (user_id = auth.uid());

create policy profiles_select_platform
on public.profiles
for select
to authenticated
using (public.is_platform_superadmin());

create policy profiles_select_same_organization_admin
on public.profiles
for select
to authenticated
using (
  public.current_organization_role() = 'admin_empresa'
  and public.current_organization_is_active()
  and exists (
    select 1
    from public.organization_memberships target_membership
    where target_membership.user_id = profiles.user_id
      and target_membership.organization_id = public.current_organization_id()
  )
);

-- Organizations: plataforma completa o propia para miembro activo.
create policy organizations_select_platform
on public.organizations
for select
to authenticated
using (public.is_platform_superadmin());

create policy organizations_select_own
on public.organizations
for select
to authenticated
using (
  id = public.current_organization_id()
);

-- Platform admins: únicamente la propia fila activa/inactiva para resolver UI.
create policy platform_admins_select_own
on public.platform_admins
for select
to authenticated
using (user_id = auth.uid());

-- Memberships: propia, misma empresa para admin, o plataforma.
create policy organization_memberships_select_own
on public.organization_memberships
for select
to authenticated
using (user_id = auth.uid());

create policy organization_memberships_select_same_organization_admin
on public.organization_memberships
for select
to authenticated
using (
  public.current_organization_role() = 'admin_empresa'
  and public.current_organization_is_active()
  and organization_id = public.current_organization_id()
);

create policy organization_memberships_select_platform
on public.organization_memberships
for select
to authenticated
using (public.is_platform_superadmin());

-- Catálogos: miembros activos ven entradas activas; plataforma ve todo.
create policy plans_select_authenticated
on public.plans
for select
to authenticated
using (
  public.is_platform_superadmin()
  or (
    public.current_profile_is_active()
    and status = 'active'
  )
);

create policy modules_select_authenticated
on public.modules
for select
to authenticated
using (
  public.is_platform_superadmin()
  or (
    public.current_profile_is_active()
    and status = 'active'
  )
);

create policy limit_definitions_select_authenticated
on public.limit_definitions
for select
to authenticated
using (
  public.is_platform_superadmin()
  or (
    public.current_profile_is_active()
    and status = 'active'
  )
);

-- Suscripción: superadmin completa; solo admin_empresa puede ver la propia.
create policy organization_subscriptions_select_platform
on public.organization_subscriptions
for select
to authenticated
using (public.is_platform_superadmin());

create policy organization_subscriptions_select_own_admin
on public.organization_subscriptions
for select
to authenticated
using (
  public.current_organization_role() = 'admin_empresa'
  and organization_id = public.current_organization_id()
);

-- Entitlements de plan: plataforma o miembros activos.
create policy plan_modules_select_authenticated
on public.plan_modules
for select
to authenticated
using (
  public.is_platform_superadmin()
  or (
    public.current_profile_is_active()
    and public.current_organization_id() is not null
  )
);

create policy plan_limits_select_authenticated
on public.plan_limits
for select
to authenticated
using (
  public.is_platform_superadmin()
  or (
    public.current_profile_is_active()
    and public.current_organization_id() is not null
  )
);

-- Overrides: superadmin todos; admin de empresa solo los propios.
create policy organization_module_overrides_select_platform
on public.organization_module_overrides
for select
to authenticated
using (public.is_platform_superadmin());

create policy organization_module_overrides_select_own_admin
on public.organization_module_overrides
for select
to authenticated
using (
  public.current_organization_role() = 'admin_empresa'
  and organization_id = public.current_organization_id()
);

create policy organization_limit_overrides_select_platform
on public.organization_limit_overrides
for select
to authenticated
using (public.is_platform_superadmin());

create policy organization_limit_overrides_select_own_admin
on public.organization_limit_overrides
for select
to authenticated
using (
  public.current_organization_role() = 'admin_empresa'
  and organization_id = public.current_organization_id()
);

-- Consumo: superadmin o admin de la organización.
create policy organization_usage_counters_select_platform
on public.organization_usage_counters
for select
to authenticated
using (public.is_platform_superadmin());

create policy organization_usage_counters_select_own_admin
on public.organization_usage_counters
for select
to authenticated
using (
  public.current_organization_role() = 'admin_empresa'
  and organization_id = public.current_organization_id()
);

-- Vínculos legacy: plataforma o admin de la organización.
create policy legacy_identity_links_select_platform
on public.legacy_identity_links
for select
to authenticated
using (public.is_platform_superadmin());

create policy legacy_identity_links_select_own_admin
on public.legacy_identity_links
for select
to authenticated
using (
  public.current_organization_role() = 'admin_empresa'
  and organization_id = public.current_organization_id()
);

-- Auditoría append-only desde el punto de vista de clientes. En Fase 1 solo
-- superadmin puede leerla, con independencia de audit_access. En una fase
-- posterior se añadirá la policy empresarial que exigirá simultáneamente:
-- misma organización, rol admin_empresa y módulo audit_access efectivo.
create policy audit_events_select_platform
on public.audit_events
for select
to authenticated
using (public.is_platform_superadmin());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- No se concede INSERT, UPDATE ni DELETE a anon/authenticated. Las futuras Edge
-- Functions operarán con credenciales server-side después de volver a validar
-- JWT, rol, empresa, motivo, módulo, límite e idempotencia.

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.organizations from anon, authenticated;
revoke all on table public.platform_admins from anon, authenticated;
revoke all on table public.organization_memberships from anon, authenticated;
revoke all on table public.plans from anon, authenticated;
revoke all on table public.organization_subscriptions from anon, authenticated;
revoke all on table public.modules from anon, authenticated;
revoke all on table public.plan_modules from anon, authenticated;
revoke all on table public.organization_module_overrides from anon, authenticated;
revoke all on table public.limit_definitions from anon, authenticated;
revoke all on table public.plan_limits from anon, authenticated;
revoke all on table public.organization_limit_overrides from anon, authenticated;
revoke all on table public.organization_usage_counters from anon, authenticated;
revoke all on table public.legacy_identity_links from anon, authenticated;
revoke all on table public.audit_events from anon, authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.organizations to authenticated;
grant select on table public.platform_admins to authenticated;
grant select on table public.organization_memberships to authenticated;
grant select on table public.plans to authenticated;
grant select on table public.organization_subscriptions to authenticated;
grant select on table public.modules to authenticated;
grant select on table public.plan_modules to authenticated;
grant select on table public.organization_module_overrides to authenticated;
grant select on table public.limit_definitions to authenticated;
grant select on table public.plan_limits to authenticated;
grant select on table public.organization_limit_overrides to authenticated;
grant select on table public.organization_usage_counters to authenticated;
grant select on table public.legacy_identity_links to authenticated;
grant select on table public.audit_events to authenticated;

-- Supabase service_role se utiliza exclusivamente en backend/Edge Functions.
-- RLS sigue siendo la defensa principal para cualquier acceso de cliente.
grant all on table public.profiles to service_role;
grant all on table public.organizations to service_role;
grant all on table public.platform_admins to service_role;
grant all on table public.organization_memberships to service_role;
grant all on table public.plans to service_role;
grant all on table public.organization_subscriptions to service_role;
grant all on table public.modules to service_role;
grant all on table public.plan_modules to service_role;
grant all on table public.organization_module_overrides to service_role;
grant all on table public.limit_definitions to service_role;
grant all on table public.plan_limits to service_role;
grant all on table public.organization_limit_overrides to service_role;
grant all on table public.organization_usage_counters to service_role;
grant all on table public.legacy_identity_links to service_role;
grant all on table public.audit_events to service_role;

-- ---------------------------------------------------------------------------
-- Datos semilla estables
-- ---------------------------------------------------------------------------

insert into public.plans (
  id,
  code,
  name,
  description,
  status,
  billing_interval,
  base_price,
  currency_code
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'starter',
    'Starter',
    'Operación básica para pequeñas empresas de transporte.',
    'active',
    'monthly',
    null,
    'EUR'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'professional',
    'Profesional',
    'Operación avanzada, OCR, facturación y gestión laboral.',
    'active',
    'monthly',
    null,
    'EUR'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'enterprise',
    'Enterprise',
    'Todos los módulos y límites numéricos altos configurables.',
    'active',
    'custom',
    null,
    'EUR'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'custom',
    'Personalizado',
    'Módulos y límites configurados manualmente por superadministración.',
    'active',
    'custom',
    null,
    'EUR'
  );

insert into public.modules (
  id,
  code,
  name,
  description,
  category,
  route_prefix,
  sort_order
)
values
  ('20000000-0000-4000-8000-000000000001', 'transport_management', 'Gestión de transportes', null, 'operations', '/transportes', 10),
  ('20000000-0000-4000-8000-000000000002', 'client_management', 'Gestión de clientes', null, 'operations', '/clientes', 20),
  ('20000000-0000-4000-8000-000000000003', 'vehicle_management', 'Gestión de vehículos', null, 'operations', '/vehiculos', 30),
  ('20000000-0000-4000-8000-000000000004', 'pod_signature', 'POD y firma', null, 'documents', '/pod', 40),
  ('20000000-0000-4000-8000-000000000005', 'electronic_delivery_notes', 'Albaranes electrónicos', null, 'documents', '/albaranes', 50),
  ('20000000-0000-4000-8000-000000000006', 'ocr', 'OCR', null, 'automation', '/ocr', 60),
  ('20000000-0000-4000-8000-000000000007', 'billing', 'Facturación', null, 'finance', '/facturacion', 70),
  ('20000000-0000-4000-8000-000000000008', 'time_tracking', 'Fichajes', null, 'workforce', '/fichajes', 80),
  ('20000000-0000-4000-8000-000000000009', 'leave_management', 'Vacaciones', null, 'workforce', '/vacaciones', 90),
  ('20000000-0000-4000-8000-000000000010', 'exports', 'Exportaciones', null, 'analytics', '/exportaciones', 100),
  ('20000000-0000-4000-8000-000000000011', 'reports', 'Informes', null, 'analytics', '/informes', 110),
  ('20000000-0000-4000-8000-000000000012', 'api_access', 'Acceso API', null, 'integrations', '/api', 120),
  (
    '20000000-0000-4000-8000-000000000013',
    'support_access',
    'Soporte avanzado',
    'Prestación comercial para la empresa; no limita al superadmin.',
    'support',
    '/soporte',
    130
  ),
  (
    '20000000-0000-4000-8000-000000000014',
    'audit_access',
    'Auditoría empresarial',
    'Acceso futuro del administrador a la auditoría autorizada de su empresa.',
    'governance',
    '/auditoria',
    140
  );

-- Cada plan declara todos los módulos. Esto hace explícitos los módulos
-- desactivados y evita que la ausencia de una fila se interprete ambiguamente.
insert into public.plan_modules (plan_id, module_id, enabled)
select
  plan_row.id,
  module_row.id,
  case
    when plan_row.code = 'starter' then module_row.code in (
      'transport_management',
      'client_management',
      'vehicle_management',
      'pod_signature',
      'electronic_delivery_notes'
    )
    when plan_row.code = 'professional' then module_row.code <> 'api_access'
    when plan_row.code = 'enterprise' then true
    when plan_row.code = 'custom' then false
  end
from public.plans plan_row
cross join public.modules module_row;

insert into public.limit_definitions (
  id,
  code,
  name,
  description,
  module_id,
  unit,
  period,
  enforcement
)
values
  ('30000000-0000-4000-8000-000000000001', 'max_admins', 'Máximo de administradores', null, null, 'count', 'total', 'hard'),
  ('30000000-0000-4000-8000-000000000002', 'max_drivers', 'Máximo de conductores', null, null, 'count', 'total', 'hard'),
  ('30000000-0000-4000-8000-000000000003', 'max_documents_total', 'Máximo de documentos', null, null, 'count', 'total', 'hard'),
  ('30000000-0000-4000-8000-000000000004', 'max_documents_monthly', 'Documentos mensuales', null, null, 'count', 'monthly', 'hard'),
  (
    '30000000-0000-4000-8000-000000000005',
    'max_ocr_monthly',
    'Operaciones OCR mensuales',
    null,
    '20000000-0000-4000-8000-000000000006',
    'requests',
    'monthly',
    'hard'
  ),
  ('30000000-0000-4000-8000-000000000006', 'max_storage_bytes', 'Almacenamiento máximo', null, null, 'bytes', 'total', 'hard'),
  (
    '30000000-0000-4000-8000-000000000007',
    'max_exports_monthly',
    'Exportaciones mensuales',
    null,
    '20000000-0000-4000-8000-000000000010',
    'count',
    'monthly',
    'hard'
  );

-- Starter y Profesional solo tienen aprobados en Fase 1 los límites de
-- administradores y conductores. Los restantes deberán configurarse antes de
-- activar las funcionalidades que los consuman.
insert into public.plan_limits (
  plan_id,
  limit_definition_id,
  limit_value
)
values
  ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 1),
  ('10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 5),
  ('10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 5),
  ('10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 25),
  ('10000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 100),
  ('10000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', 1000),
  ('10000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 1000000),
  ('10000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000004', 100000),
  ('10000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000005', 50000),
  ('10000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000006', 10995116277760),
  ('10000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000007', 100000);

-- No se crea ninguna organización, usuario, perfil, membresía ni superadmin.

commit;
