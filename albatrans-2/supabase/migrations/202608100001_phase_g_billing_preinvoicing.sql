-- Fase G: tarifas, cálculo económico y prefacturación.
-- Migración aditiva y forward-only.

create type public.billing_rate_status as enum (
  'active',
  'inactive',
  'archived'
);

create type public.transport_economic_status as enum (
  'unpriced',
  'calculated',
  'needs_recalculation',
  'validated',
  'prefactured',
  'invoiced',
  'cancelled'
);

create type public.billing_charge_mode as enum (
  'fixed',
  'percent',
  'per_unit'
);

create type public.billing_adjustment_kind as enum (
  'discount',
  'surcharge',
  'correction'
);

create type public.billing_preinvoice_status as enum (
  'draft',
  'review',
  'approved',
  'cancelled',
  'converted'
);

alter table public.transport_orders
  add column if not exists billable_km numeric(12,2) null,
  add column if not exists economic_status public.transport_economic_status not null default 'unpriced',
  add column if not exists current_valuation_id uuid null;

create table public.billing_command_idempotency (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  result jsonb null check (result is null or jsonb_typeof(result) = 'object'),
  actor_user_id uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  primary key (organization_id, idempotency_key)
);
create index billing_command_idempotency_created_idx on public.billing_command_idempotency (created_at desc);

create table public.billing_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  origin_location_id uuid null references public.locations(id) on delete restrict,
  destination_location_id uuid null references public.locations(id) on delete restrict,
  service_type text null,
  name text not null,
  status public.billing_rate_status not null default 'active',
  valid_from date not null,
  valid_until date null,
  currency_code text not null default 'EUR' check (currency_code ~ '^[A-Z]{3}$'),
  version_group_id uuid not null,
  version_number integer not null default 1 check (version_number >= 1),
  previous_rate_id uuid null references public.billing_rates(id) on delete restrict,
  components_json jsonb not null default '[]'::jsonb check (jsonb_typeof(components_json) = 'array'),
  supplement_rules_json jsonb not null default '[]'::jsonb check (jsonb_typeof(supplement_rules_json) = 'array'),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  constraint billing_rates_name_not_blank check (btrim(name) <> ''),
  constraint billing_rates_service_type_not_blank check (service_type is null or btrim(service_type) <> ''),
  constraint billing_rates_validity check (valid_until is null or valid_until >= valid_from),
  constraint billing_rates_archived_consistent check ((status = 'archived') = (archived_at is not null))
);
create unique index billing_rates_version_unique on public.billing_rates (organization_id, version_group_id, version_number);
create index billing_rates_lookup_idx on public.billing_rates (organization_id, client_id, status, valid_from desc, created_at desc);

create table public.billing_supplement_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null check (code ~ '^[a-z][a-z0-9_]*$' and length(code) <= 100),
  name text not null,
  charge_mode public.billing_charge_mode not null,
  amount numeric(12,4) not null check (amount >= 0),
  unit_code text null,
  percentage_base text null,
  status public.master_data_status not null default 'active',
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  constraint billing_supplement_definitions_name_not_blank check (btrim(name) <> ''),
  constraint billing_supplement_definitions_unit_code_not_blank check (unit_code is null or btrim(unit_code) <> ''),
  constraint billing_supplement_definitions_percentage_base check (
    percentage_base is null or percentage_base in ('subtotal_before_percentage', 'subtotal_before_adjustments')
  ),
  constraint billing_supplement_definitions_archived_consistent check ((status = 'archived') = (archived_at is not null))
);
create unique index billing_supplement_definitions_code_unique on public.billing_supplement_definitions (organization_id, lower(code));
create index billing_supplement_definitions_status_idx on public.billing_supplement_definitions (organization_id, status, name);

create table public.transport_order_billing_supplements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  transport_order_id uuid not null references public.transport_orders(id) on delete restrict,
  supplement_definition_id uuid null references public.billing_supplement_definitions(id) on delete restrict,
  code text not null check (code ~ '^[a-z][a-z0-9_]*$' and length(code) <= 100),
  name text not null,
  charge_mode public.billing_charge_mode not null,
  amount numeric(12,4) not null check (amount >= 0),
  quantity numeric(12,4) not null default 1 check (quantity >= 0),
  unit_code text null,
  percentage_base text null,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  removed_by uuid null references public.profiles(user_id) on delete restrict,
  removed_at timestamptz null,
  remove_reason text null,
  constraint transport_order_billing_supplements_name_not_blank check (btrim(name) <> ''),
  constraint transport_order_billing_supplements_percentage_base check (
    percentage_base is null or percentage_base in ('subtotal_before_percentage', 'subtotal_before_adjustments')
  ),
  constraint transport_order_billing_supplements_removal_reason check (
    (removed_at is null and removed_by is null and remove_reason is null)
    or (removed_at is not null and removed_by is not null and btrim(coalesce(remove_reason, '')) <> '')
  )
);
create index transport_order_billing_supplements_active_idx
  on public.transport_order_billing_supplements (organization_id, transport_order_id, created_at)
  where removed_at is null;

create table public.transport_order_pricing_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  transport_order_id uuid not null references public.transport_orders(id) on delete restrict,
  adjustment_kind public.billing_adjustment_kind not null,
  effect_sign smallint not null check (effect_sign in (-1, 1)),
  charge_mode public.billing_charge_mode not null,
  amount numeric(12,4) not null check (amount >= 0),
  quantity numeric(12,4) not null default 1 check (quantity >= 0),
  unit_code text null,
  percentage_base text null,
  reason text not null,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint transport_order_pricing_adjustments_reason_not_blank check (btrim(reason) <> ''),
  constraint transport_order_pricing_adjustments_percentage_base check (
    percentage_base is null or percentage_base in ('subtotal_before_percentage', 'subtotal_before_adjustments')
  )
);
create index transport_order_pricing_adjustments_order_idx on public.transport_order_pricing_adjustments (organization_id, transport_order_id, created_at desc);

create table public.transport_order_valuations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  transport_order_id uuid not null references public.transport_orders(id) on delete restrict,
  valuation_number integer not null check (valuation_number >= 1),
  billing_rate_id uuid null references public.billing_rates(id) on delete restrict,
  rate_snapshot_json jsonb not null check (jsonb_typeof(rate_snapshot_json) = 'object'),
  input_snapshot_json jsonb not null check (jsonb_typeof(input_snapshot_json) = 'object'),
  breakdown_json jsonb not null check (jsonb_typeof(breakdown_json) = 'object'),
  base_amount numeric(12,2) not null,
  supplements_amount numeric(12,2) not null,
  adjustments_amount numeric(12,2) not null,
  total_amount numeric(12,2) not null,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  calculated_by uuid not null references public.profiles(user_id) on delete restrict,
  calculated_at timestamptz not null default now(),
  validated_by uuid null references public.profiles(user_id) on delete restrict,
  validated_at timestamptz null,
  reopened_by uuid null references public.profiles(user_id) on delete restrict,
  reopened_at timestamptz null,
  superseded_by_valuation_id uuid null references public.transport_order_valuations(id) on delete restrict,
  correlation_id uuid not null,
  idempotency_key uuid not null,
  constraint transport_order_valuations_total_consistency check (total_amount = round(base_amount + supplements_amount + adjustments_amount, 2))
);
create unique index transport_order_valuations_order_number_unique on public.transport_order_valuations (organization_id, transport_order_id, valuation_number);
create index transport_order_valuations_order_idx on public.transport_order_valuations (organization_id, transport_order_id, calculated_at desc);

alter table public.transport_orders
  add constraint transport_orders_current_valuation_fk
  foreign key (current_valuation_id) references public.transport_order_valuations(id) on delete restrict;

create table public.billing_preinvoice_counters (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  reference_year integer not null check (reference_year >= 2026),
  last_number integer not null default 0 check (last_number >= 0),
  primary key (organization_id, reference_year)
);

create table public.billing_preinvoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  reference text not null,
  period_start date not null,
  period_end date not null,
  status public.billing_preinvoice_status not null default 'draft',
  currency_code text not null default 'EUR' check (currency_code ~ '^[A-Z]{3}$'),
  subtotal_amount numeric(12,2) not null default 0,
  adjustments_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_by uuid null references public.profiles(user_id) on delete restrict,
  approved_at timestamptz null,
  cancelled_by uuid null references public.profiles(user_id) on delete restrict,
  cancelled_at timestamptz null,
  notes text null,
  constraint billing_preinvoices_reference_not_blank check (btrim(reference) <> ''),
  constraint billing_preinvoices_period check (period_end >= period_start),
  constraint billing_preinvoices_total_consistency check (total_amount = round(subtotal_amount + adjustments_amount, 2))
);
create unique index billing_preinvoices_reference_unique on public.billing_preinvoices (organization_id, lower(reference));
create index billing_preinvoices_client_status_idx on public.billing_preinvoices (organization_id, client_id, status, created_at desc);

create table public.billing_preinvoice_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  preinvoice_id uuid not null references public.billing_preinvoices(id) on delete restrict,
  transport_order_id uuid not null references public.transport_orders(id) on delete restrict,
  valuation_id uuid not null references public.transport_order_valuations(id) on delete restrict,
  line_amount numeric(12,2) not null,
  description text not null,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  removed_by uuid null references public.profiles(user_id) on delete restrict,
  removed_at timestamptz null,
  remove_reason text null,
  constraint billing_preinvoice_lines_description_not_blank check (btrim(description) <> ''),
  constraint billing_preinvoice_lines_removal_reason check (
    (removed_at is null and removed_by is null and remove_reason is null)
    or (removed_at is not null and removed_by is not null and btrim(coalesce(remove_reason, '')) <> '')
  )
);
create unique index billing_preinvoice_lines_active_order_unique
  on public.billing_preinvoice_lines (transport_order_id)
  where removed_at is null;
create index billing_preinvoice_lines_preinvoice_idx on public.billing_preinvoice_lines (organization_id, preinvoice_id, created_at);

create function public.billing_actor_authorized(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid,
  p_write boolean default false
) returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.user_id = p_actor
      and profile.status = 'active'
      and (
        (
          p_scope = 'platform'
          and exists (
            select 1
            from public.platform_admins platform
            where platform.user_id = p_actor
              and platform.role = 'superadmin'
              and platform.status = 'active'
          )
        )
        or (
          p_scope = 'organization'
          and exists (
            select 1
            from public.organizations organization_row
            join public.organization_memberships membership
              on membership.organization_id = organization_row.id
             and membership.user_id = p_actor
             and membership.status = 'active'
            join public.modules module_row
              on module_row.code = 'billing'
             and module_row.status = 'active'
            left join public.organization_subscriptions subscription
              on subscription.organization_id = organization_row.id
            left join public.plan_modules plan_module
              on plan_module.plan_id = subscription.plan_id
             and plan_module.module_id = module_row.id
            left join public.organization_module_overrides override_row
              on override_row.organization_id = organization_row.id
             and override_row.module_id = module_row.id
            where organization_row.id = p_org
              and organization_row.status = 'active'
              and (not p_write or membership.role = 'admin_empresa')
              and case
                when override_row.override_mode = 'enabled' then true
                when override_row.override_mode = 'disabled' then false
                else coalesce(plan_module.enabled, false)
              end
          )
        )
      )
  );
$$;

create function public.billing_round_amount(p_value numeric) returns numeric
language sql
immutable
set search_path = pg_catalog, public
as $$
  select round(coalesce(p_value, 0), 2);
$$;

create function public.billing_next_preinvoice_reference(p_org uuid, p_reference_year integer)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_number integer;
begin
  insert into public.billing_preinvoice_counters (organization_id, reference_year, last_number)
  values (p_org, p_reference_year, 1)
  on conflict (organization_id, reference_year)
  do update set last_number = public.billing_preinvoice_counters.last_number + 1
  returning last_number into v_number;

  return format('PRE-%s-%s', p_reference_year, lpad(v_number::text, 4, '0'));
end;
$$;

create function public.billing_recalculate_preinvoice_totals(p_preinvoice uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_subtotal numeric(12,2);
begin
  select coalesce(sum(line_amount), 0)
  into v_subtotal
  from public.billing_preinvoice_lines
  where preinvoice_id = p_preinvoice
    and removed_at is null;

  update public.billing_preinvoices
  set subtotal_amount = public.billing_round_amount(v_subtotal),
      total_amount = public.billing_round_amount(v_subtotal + adjustments_amount),
      updated_at = statement_timestamp()
  where id = p_preinvoice;
end;
$$;

create function public.billing_mark_order_needs_recalculation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_table_name = 'transport_orders' then
    if (
      new.customer_id is distinct from old.customer_id
      or new.billable_km is distinct from old.billable_km
      or new.transport_type is distinct from old.transport_type
      or new.planned_pickup_at is distinct from old.planned_pickup_at
      or new.requested_pickup_at is distinct from old.requested_pickup_at
    ) then
      if old.economic_status in ('prefactured', 'invoiced') then
        raise exception using errcode = '55000', message = 'economic inputs are locked after preinvoicing';
      elsif old.economic_status in ('calculated', 'validated') then
        new.economic_status := 'needs_recalculation';
      end if;
    end if;
    return new;
  end if;

  if exists (
    select 1
    from public.transport_orders
    where id = coalesce(new.transport_order_id, old.transport_order_id)
      and organization_id = coalesce(new.organization_id, old.organization_id)
      and economic_status in ('prefactured', 'invoiced')
  ) then
    raise exception using errcode = '55000', message = 'economic inputs are locked after preinvoicing';
  end if;

  update public.transport_orders
  set economic_status = case when economic_status in ('calculated', 'validated') then 'needs_recalculation' else economic_status end,
      updated_at = statement_timestamp()
  where id = coalesce(new.transport_order_id, old.transport_order_id)
    and organization_id = coalesce(new.organization_id, old.organization_id)
    and economic_status in ('calculated', 'validated');

  return coalesce(new, old);
end;
$$;

create function public.billing_validate_tenant() returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_org uuid;
begin
  if tg_table_name = 'billing_rates' then
    select organization_id into v_org from public.clients where id = new.client_id;
    if v_org is distinct from new.organization_id then
      raise exception using errcode = '23514', message = 'rate client tenant mismatch';
    end if;
    if new.origin_location_id is not null then
      select organization_id into v_org from public.locations where id = new.origin_location_id;
      if v_org is distinct from new.organization_id then
        raise exception using errcode = '23514', message = 'rate origin tenant mismatch';
      end if;
    end if;
    if new.destination_location_id is not null then
      select organization_id into v_org from public.locations where id = new.destination_location_id;
      if v_org is distinct from new.organization_id then
        raise exception using errcode = '23514', message = 'rate destination tenant mismatch';
      end if;
    end if;
  elsif tg_table_name in ('transport_order_billing_supplements', 'transport_order_pricing_adjustments', 'transport_order_valuations') then
    select organization_id into v_org from public.transport_orders where id = new.transport_order_id;
    if v_org is distinct from new.organization_id then
      raise exception using errcode = '23514', message = 'transport order tenant mismatch';
    end if;
  elsif tg_table_name = 'billing_preinvoices' then
    select organization_id into v_org from public.clients where id = new.client_id;
    if v_org is distinct from new.organization_id then
      raise exception using errcode = '23514', message = 'preinvoice client tenant mismatch';
    end if;
  elsif tg_table_name = 'billing_preinvoice_lines' then
    select organization_id into v_org from public.billing_preinvoices where id = new.preinvoice_id;
    if v_org is distinct from new.organization_id then
      raise exception using errcode = '23514', message = 'preinvoice line tenant mismatch';
    end if;
    select organization_id into v_org from public.transport_orders where id = new.transport_order_id;
    if v_org is distinct from new.organization_id then
      raise exception using errcode = '23514', message = 'preinvoice line order tenant mismatch';
    end if;
    select organization_id into v_org from public.transport_order_valuations where id = new.valuation_id;
    if v_org is distinct from new.organization_id then
      raise exception using errcode = '23514', message = 'preinvoice line valuation tenant mismatch';
    end if;
  end if;
  return new;
end;
$$;

create function public.persist_transport_order_valuation(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid,
  p_order uuid,
  p_rate_id uuid,
  p_rate_snapshot jsonb,
  p_input_snapshot jsonb,
  p_breakdown jsonb,
  p_base_amount numeric,
  p_supplements_amount numeric,
  p_adjustments_amount numeric,
  p_total_amount numeric,
  p_currency_code text,
  p_correlation uuid,
  p_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.transport_orders%rowtype;
  v_hash text;
  v_request jsonb;
  v_previous public.billing_command_idempotency%rowtype;
  v_valuation_id uuid;
  v_valuation_number integer;
  v_result jsonb;
  v_action text := 'billing.valuation_calculated';
  v_event_type text := 'price_calculated';
begin
  if not public.billing_actor_authorized(p_actor, p_scope, p_org, true) then
    raise exception using errcode = '42501', message = 'billing actor not authorized';
  end if;

  v_request := jsonb_build_object(
    'command', 'persist_transport_order_valuation',
    'organization', p_org,
    'orderId', p_order,
    'rateId', p_rate_id,
    'breakdown', p_breakdown,
    'total', p_total_amount,
    'currency', p_currency_code
  );
  v_hash := encode(extensions.digest(convert_to(v_request::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.billing_command_idempotency (organization_id, idempotency_key, request_hash, actor_user_id)
  values (p_org, p_key, v_hash, p_actor)
  on conflict do nothing;

  select * into v_previous
  from public.billing_command_idempotency
  where organization_id = p_org
    and idempotency_key = p_key
  for update;

  if v_previous.request_hash <> v_hash then
    raise exception using errcode = '23505', message = 'idempotency key reused with different payload';
  end if;

  if v_previous.result is not null then
    return v_previous.result;
  end if;

  select * into v_order
  from public.transport_orders
  where id = p_order
    and organization_id = p_org
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'transport order not found';
  end if;

  if v_order.economic_status in ('validated', 'prefactured', 'invoiced', 'cancelled') then
    raise exception using errcode = '22023', message = 'transport order economic state is locked';
  end if;

  select coalesce(max(valuation_number), 0) + 1
  into v_valuation_number
  from public.transport_order_valuations
  where organization_id = p_org
    and transport_order_id = p_order;

  insert into public.transport_order_valuations (
    organization_id,
    transport_order_id,
    valuation_number,
    billing_rate_id,
    rate_snapshot_json,
    input_snapshot_json,
    breakdown_json,
    base_amount,
    supplements_amount,
    adjustments_amount,
    total_amount,
    currency_code,
    calculated_by,
    correlation_id,
    idempotency_key
  ) values (
    p_org,
    p_order,
    v_valuation_number,
    p_rate_id,
    p_rate_snapshot,
    p_input_snapshot,
    p_breakdown,
    public.billing_round_amount(p_base_amount),
    public.billing_round_amount(p_supplements_amount),
    public.billing_round_amount(p_adjustments_amount),
    public.billing_round_amount(p_total_amount),
    p_currency_code,
    p_actor,
    p_correlation,
    p_key
  ) returning id into v_valuation_id;

  update public.transport_orders
  set current_valuation_id = v_valuation_id,
      economic_status = 'calculated',
      updated_at = statement_timestamp()
  where id = p_order;

  if v_order.economic_status = 'needs_recalculation' then
    v_action := 'billing.valuation_recalculated';
    v_event_type := 'price_recalculated';
  end if;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    actor_scope,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    correlation_id
  ) values (
    p_org,
    p_actor,
    p_scope,
    v_action,
    'transport_order_valuation',
    v_valuation_id::text,
    jsonb_build_object('economicStatus', v_order.economic_status, 'currentValuationId', v_order.current_valuation_id),
    jsonb_build_object('economicStatus', 'calculated', 'valuationId', v_valuation_id, 'totalAmount', public.billing_round_amount(p_total_amount), 'currencyCode', p_currency_code),
    p_correlation
  );

  insert into public.transport_events (
    organization_id,
    transport_order_id,
    event_type,
    actor_user_id,
    entity_type,
    entity_id,
    payload,
    correlation_id
  ) values (
    p_org,
    p_order,
    v_event_type,
    p_actor,
    'transport_order_valuation',
    v_valuation_id,
    jsonb_build_object('valuationId', v_valuation_id, 'totalAmount', public.billing_round_amount(p_total_amount), 'currencyCode', p_currency_code),
    p_correlation
  );

  v_result := jsonb_build_object(
    'ok', true,
    'valuationId', v_valuation_id,
    'valuationNumber', v_valuation_number,
    'economicStatus', 'calculated',
    'totalAmount', public.billing_round_amount(p_total_amount),
    'currencyCode', p_currency_code,
    'correlationId', p_correlation,
    'idempotencyKey', p_key
  );

  update public.billing_command_idempotency
  set result = v_result,
      completed_at = statement_timestamp()
  where organization_id = p_org
    and idempotency_key = p_key;

  return v_result;
end;
$$;

create function public.add_transport_order_pricing_adjustment(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid,
  p_order uuid,
  p_adjustment_kind public.billing_adjustment_kind,
  p_effect_sign smallint,
  p_charge_mode public.billing_charge_mode,
  p_amount numeric,
  p_quantity numeric,
  p_unit_code text,
  p_percentage_base text,
  p_reason text,
  p_correlation uuid,
  p_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.transport_orders%rowtype;
  v_adjustment_id uuid;
  v_result jsonb;
begin
  if not public.billing_actor_authorized(p_actor, p_scope, p_org, true) then
    raise exception using errcode = '42501', message = 'billing actor not authorized';
  end if;

  select * into v_order
  from public.transport_orders
  where id = p_order
    and organization_id = p_org
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'transport order not found';
  end if;

  if v_order.economic_status in ('prefactured', 'invoiced', 'cancelled') then
    raise exception using errcode = '22023', message = 'transport order economic state is locked';
  end if;

  insert into public.transport_order_pricing_adjustments (
    organization_id,
    transport_order_id,
    adjustment_kind,
    effect_sign,
    charge_mode,
    amount,
    quantity,
    unit_code,
    percentage_base,
    reason,
    created_by
  ) values (
    p_org,
    p_order,
    p_adjustment_kind,
    p_effect_sign,
    p_charge_mode,
    p_amount,
    coalesce(p_quantity, 1),
    nullif(btrim(coalesce(p_unit_code, '')), ''),
    nullif(btrim(coalesce(p_percentage_base, '')), ''),
    btrim(p_reason),
    p_actor
  ) returning id into v_adjustment_id;

  if v_order.economic_status = 'calculated' then
    update public.transport_orders
    set economic_status = 'needs_recalculation',
        updated_at = statement_timestamp()
    where id = p_order;
  end if;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    actor_scope,
    action,
    entity_type,
    entity_id,
    after_data,
    reason,
    correlation_id
  ) values (
    p_org,
    p_actor,
    p_scope,
    'billing.adjustment_added',
    'transport_order_pricing_adjustment',
    v_adjustment_id::text,
    jsonb_build_object('orderId', p_order, 'adjustmentKind', p_adjustment_kind, 'amount', p_amount, 'quantity', coalesce(p_quantity, 1), 'chargeMode', p_charge_mode),
    btrim(p_reason),
    p_correlation
  );

  v_result := jsonb_build_object('ok', true, 'adjustmentId', v_adjustment_id, 'economicStatus', (select economic_status from public.transport_orders where id = p_order), 'correlationId', p_correlation, 'idempotencyKey', p_key);
  return v_result;
end;
$$;

create function public.add_transport_order_billing_supplement(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid,
  p_order uuid,
  p_definition uuid,
  p_code text,
  p_name text,
  p_charge_mode public.billing_charge_mode,
  p_amount numeric,
  p_quantity numeric,
  p_unit_code text,
  p_percentage_base text,
  p_correlation uuid,
  p_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.transport_orders%rowtype;
  v_supplement_id uuid;
begin
  if not public.billing_actor_authorized(p_actor, p_scope, p_org, true) then
    raise exception using errcode = '42501', message = 'billing actor not authorized';
  end if;

  select * into v_order
  from public.transport_orders
  where id = p_order
    and organization_id = p_org
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'transport order not found';
  end if;

  if v_order.economic_status in ('prefactured', 'invoiced', 'cancelled') then
    raise exception using errcode = '22023', message = 'transport order economic state is locked';
  end if;

  insert into public.transport_order_billing_supplements (
    organization_id,
    transport_order_id,
    supplement_definition_id,
    code,
    name,
    charge_mode,
    amount,
    quantity,
    unit_code,
    percentage_base,
    created_by
  ) values (
    p_org,
    p_order,
    p_definition,
    btrim(p_code),
    btrim(p_name),
    p_charge_mode,
    p_amount,
    coalesce(p_quantity, 1),
    nullif(btrim(coalesce(p_unit_code, '')), ''),
    nullif(btrim(coalesce(p_percentage_base, '')), ''),
    p_actor
  ) returning id into v_supplement_id;

  if v_order.economic_status = 'calculated' then
    update public.transport_orders
    set economic_status = 'needs_recalculation',
        updated_at = statement_timestamp()
    where id = p_order;
  end if;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    actor_scope,
    action,
    entity_type,
    entity_id,
    after_data,
    correlation_id
  ) values (
    p_org,
    p_actor,
    p_scope,
    'billing.supplement_added',
    'transport_order_billing_supplement',
    v_supplement_id::text,
    jsonb_build_object('orderId', p_order, 'code', p_code, 'name', p_name, 'amount', p_amount, 'quantity', coalesce(p_quantity, 1), 'chargeMode', p_charge_mode),
    p_correlation
  );

  return jsonb_build_object('ok', true, 'supplementId', v_supplement_id, 'economicStatus', (select economic_status from public.transport_orders where id = p_order), 'correlationId', p_correlation, 'idempotencyKey', p_key);
end;
$$;

create function public.validate_transport_order_valuation(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid,
  p_order uuid,
  p_reason text,
  p_correlation uuid,
  p_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.transport_orders%rowtype;
  v_valuation public.transport_order_valuations%rowtype;
begin
  if not public.billing_actor_authorized(p_actor, p_scope, p_org, true) then
    raise exception using errcode = '42501', message = 'billing actor not authorized';
  end if;

  select * into v_order
  from public.transport_orders
  where id = p_order
    and organization_id = p_org
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'transport order not found';
  end if;

  if v_order.economic_status <> 'calculated' then
    raise exception using errcode = '22023', message = 'transport order is not pending validation';
  end if;

  if v_order.current_valuation_id is null then
    raise exception using errcode = '22023', message = 'transport order has no current valuation';
  end if;

  select * into v_valuation
  from public.transport_order_valuations
  where id = v_order.current_valuation_id
    and organization_id = p_org
  for update;

  update public.transport_order_valuations
  set validated_by = p_actor,
      validated_at = statement_timestamp()
  where id = v_valuation.id;

  update public.transport_orders
  set economic_status = 'validated',
      updated_at = statement_timestamp()
  where id = p_order;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    actor_scope,
    action,
    entity_type,
    entity_id,
    after_data,
    reason,
    correlation_id
  ) values (
    p_org,
    p_actor,
    p_scope,
    'billing.valuation_validated',
    'transport_order_valuation',
    v_valuation.id::text,
    jsonb_build_object('orderId', p_order, 'valuationId', v_valuation.id, 'totalAmount', v_valuation.total_amount, 'currencyCode', v_valuation.currency_code),
    nullif(btrim(coalesce(p_reason, '')), ''),
    p_correlation
  );

  insert into public.transport_events (
    organization_id,
    transport_order_id,
    event_type,
    actor_user_id,
    entity_type,
    entity_id,
    payload,
    correlation_id
  ) values (
    p_org,
    p_order,
    'price_validated',
    p_actor,
    'transport_order_valuation',
    v_valuation.id,
    jsonb_build_object('valuationId', v_valuation.id, 'totalAmount', v_valuation.total_amount, 'currencyCode', v_valuation.currency_code),
    p_correlation
  );

  return jsonb_build_object('ok', true, 'valuationId', v_valuation.id, 'economicStatus', 'validated', 'correlationId', p_correlation, 'idempotencyKey', p_key);
end;
$$;

create function public.reopen_transport_order_valuation(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid,
  p_order uuid,
  p_reason text,
  p_correlation uuid,
  p_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.transport_orders%rowtype;
begin
  if not public.billing_actor_authorized(p_actor, p_scope, p_org, true) then
    raise exception using errcode = '42501', message = 'billing actor not authorized';
  end if;

  select * into v_order
  from public.transport_orders
  where id = p_order
    and organization_id = p_org
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'transport order not found';
  end if;

  if v_order.economic_status <> 'validated' then
    raise exception using errcode = '22023', message = 'only validated valuations can be reopened';
  end if;

  update public.transport_orders
  set economic_status = 'needs_recalculation',
      updated_at = statement_timestamp()
  where id = p_order;

  if v_order.current_valuation_id is not null then
    update public.transport_order_valuations
    set reopened_by = p_actor,
        reopened_at = statement_timestamp()
    where id = v_order.current_valuation_id;
  end if;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    actor_scope,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    reason,
    correlation_id
  ) values (
    p_org,
    p_actor,
    p_scope,
    'billing.valuation_reopened',
    'transport_order_valuation',
    coalesce(v_order.current_valuation_id::text, p_order::text),
    jsonb_build_object('economicStatus', 'validated', 'valuationId', v_order.current_valuation_id),
    jsonb_build_object('economicStatus', 'needs_recalculation', 'valuationId', v_order.current_valuation_id),
    btrim(p_reason),
    p_correlation
  );

  insert into public.transport_events (
    organization_id,
    transport_order_id,
    event_type,
    actor_user_id,
    entity_type,
    entity_id,
    payload,
    correlation_id
  ) values (
    p_org,
    p_order,
    'price_reopened',
    p_actor,
    'transport_order_valuation',
    v_order.current_valuation_id,
    jsonb_build_object('valuationId', v_order.current_valuation_id, 'reason', btrim(p_reason)),
    p_correlation
  );

  return jsonb_build_object('ok', true, 'economicStatus', 'needs_recalculation', 'correlationId', p_correlation, 'idempotencyKey', p_key);
end;
$$;

create function public.create_billing_preinvoice(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid,
  p_client uuid,
  p_period_start date,
  p_period_end date,
  p_order_ids uuid[],
  p_notes text,
  p_correlation uuid,
  p_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_preinvoice_id uuid;
  v_reference text;
  v_line_order uuid;
  v_order public.transport_orders%rowtype;
  v_valuation public.transport_order_valuations%rowtype;
  v_client public.clients%rowtype;
begin
  if not public.billing_actor_authorized(p_actor, p_scope, p_org, true) then
    raise exception using errcode = '42501', message = 'billing actor not authorized';
  end if;

  if p_order_ids is null or coalesce(array_length(p_order_ids, 1), 0) = 0 then
    raise exception using errcode = '22023', message = 'at least one order is required';
  end if;

  select * into v_client
  from public.clients
  where id = p_client
    and organization_id = p_org
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'client not found';
  end if;

  v_reference := public.billing_next_preinvoice_reference(p_org, extract(year from p_period_start)::integer);

  insert into public.billing_preinvoices (
    organization_id,
    client_id,
    reference,
    period_start,
    period_end,
    status,
    currency_code,
    created_by,
    notes
  ) values (
    p_org,
    p_client,
    v_reference,
    p_period_start,
    p_period_end,
    'draft',
    'EUR',
    p_actor,
    nullif(btrim(coalesce(p_notes, '')), '')
  ) returning id into v_preinvoice_id;

  foreach v_line_order in array p_order_ids loop
    select * into v_order
    from public.transport_orders
    where id = v_line_order
      and organization_id = p_org
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'transport order not found for preinvoice';
    end if;
    if v_order.customer_id <> p_client then
      raise exception using errcode = '22023', message = 'preinvoice client mismatch';
    end if;
    if v_order.economic_status <> 'validated' then
      raise exception using errcode = '22023', message = 'only validated orders can be prefactured';
    end if;
    if v_order.current_valuation_id is null then
      raise exception using errcode = '22023', message = 'transport order has no valuation';
    end if;

    select * into v_valuation
    from public.transport_order_valuations
    where id = v_order.current_valuation_id
      and organization_id = p_org;

    insert into public.billing_preinvoice_lines (
      organization_id,
      preinvoice_id,
      transport_order_id,
      valuation_id,
      line_amount,
      description,
      created_by
    ) values (
      p_org,
      v_preinvoice_id,
      v_line_order,
      v_valuation.id,
      v_valuation.total_amount,
      format('Orden %s', v_order.order_number),
      p_actor
    );

    update public.transport_orders
    set economic_status = 'prefactured',
        updated_at = statement_timestamp()
    where id = v_line_order;

    insert into public.transport_events (
      organization_id,
      transport_order_id,
      event_type,
      actor_user_id,
      entity_type,
      entity_id,
      payload,
      correlation_id
    ) values (
      p_org,
      v_line_order,
      'added_to_preinvoice',
      p_actor,
      'billing_preinvoice',
      v_preinvoice_id,
      jsonb_build_object('preinvoiceId', v_preinvoice_id, 'reference', v_reference, 'valuationId', v_valuation.id, 'lineAmount', v_valuation.total_amount),
      p_correlation
    );
  end loop;

  perform public.billing_recalculate_preinvoice_totals(v_preinvoice_id);

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    actor_scope,
    action,
    entity_type,
    entity_id,
    after_data,
    correlation_id
  ) values (
    p_org,
    p_actor,
    p_scope,
    'billing.preinvoice_created',
    'billing_preinvoice',
    v_preinvoice_id::text,
    jsonb_build_object('reference', v_reference, 'clientId', p_client, 'orderIds', p_order_ids),
    p_correlation
  );

  return (
    select jsonb_build_object(
      'ok', true,
      'preinvoiceId', preinvoice.id,
      'reference', preinvoice.reference,
      'status', preinvoice.status,
      'subtotalAmount', preinvoice.subtotal_amount,
      'totalAmount', preinvoice.total_amount,
      'correlationId', p_correlation,
      'idempotencyKey', p_key
    )
    from public.billing_preinvoices preinvoice
    where preinvoice.id = v_preinvoice_id
  );
end;
$$;

create function public.add_orders_to_billing_preinvoice(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid,
  p_preinvoice uuid,
  p_order_ids uuid[],
  p_correlation uuid,
  p_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_preinvoice public.billing_preinvoices%rowtype;
  v_order_id uuid;
  v_order public.transport_orders%rowtype;
  v_valuation public.transport_order_valuations%rowtype;
begin
  if not public.billing_actor_authorized(p_actor, p_scope, p_org, true) then
    raise exception using errcode = '42501', message = 'billing actor not authorized';
  end if;

  select * into v_preinvoice
  from public.billing_preinvoices
  where id = p_preinvoice
    and organization_id = p_org
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'preinvoice not found';
  end if;

  if v_preinvoice.status <> 'draft' then
    raise exception using errcode = '22023', message = 'only draft preinvoices can receive orders';
  end if;

  foreach v_order_id in array p_order_ids loop
    select * into v_order
    from public.transport_orders
    where id = v_order_id
      and organization_id = p_org
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'transport order not found for preinvoice';
    end if;
    if v_order.customer_id <> v_preinvoice.client_id then
      raise exception using errcode = '22023', message = 'preinvoice client mismatch';
    end if;
    if v_order.economic_status <> 'validated' then
      raise exception using errcode = '22023', message = 'only validated orders can be prefactured';
    end if;

    select * into v_valuation
    from public.transport_order_valuations
    where id = v_order.current_valuation_id
      and organization_id = p_org;

    insert into public.billing_preinvoice_lines (
      organization_id,
      preinvoice_id,
      transport_order_id,
      valuation_id,
      line_amount,
      description,
      created_by
    ) values (
      p_org,
      p_preinvoice,
      v_order_id,
      v_valuation.id,
      v_valuation.total_amount,
      format('Orden %s', v_order.order_number),
      p_actor
    );

    update public.transport_orders
    set economic_status = 'prefactured',
        updated_at = statement_timestamp()
    where id = v_order_id;
  end loop;

  perform public.billing_recalculate_preinvoice_totals(p_preinvoice);
  return jsonb_build_object('ok', true, 'preinvoiceId', p_preinvoice, 'correlationId', p_correlation, 'idempotencyKey', p_key);
end;
$$;

create function public.remove_order_from_billing_preinvoice(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid,
  p_preinvoice uuid,
  p_order uuid,
  p_reason text,
  p_correlation uuid,
  p_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_preinvoice public.billing_preinvoices%rowtype;
  v_line public.billing_preinvoice_lines%rowtype;
begin
  if not public.billing_actor_authorized(p_actor, p_scope, p_org, true) then
    raise exception using errcode = '42501', message = 'billing actor not authorized';
  end if;

  select * into v_preinvoice
  from public.billing_preinvoices
  where id = p_preinvoice
    and organization_id = p_org
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'preinvoice not found';
  end if;
  if v_preinvoice.status <> 'draft' then
    raise exception using errcode = '22023', message = 'only draft preinvoices can remove orders';
  end if;

  select * into v_line
  from public.billing_preinvoice_lines
  where preinvoice_id = p_preinvoice
    and transport_order_id = p_order
    and removed_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'preinvoice line not found';
  end if;

  update public.billing_preinvoice_lines
  set removed_at = statement_timestamp(),
      removed_by = p_actor,
      remove_reason = btrim(p_reason)
  where id = v_line.id;

  update public.transport_orders
  set economic_status = 'validated',
      updated_at = statement_timestamp()
  where id = p_order
    and organization_id = p_org;

  perform public.billing_recalculate_preinvoice_totals(p_preinvoice);
  return jsonb_build_object('ok', true, 'preinvoiceId', p_preinvoice, 'orderId', p_order, 'correlationId', p_correlation, 'idempotencyKey', p_key);
end;
$$;

create function public.approve_billing_preinvoice(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid,
  p_preinvoice uuid,
  p_correlation uuid,
  p_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_preinvoice public.billing_preinvoices%rowtype;
begin
  if not public.billing_actor_authorized(p_actor, p_scope, p_org, true) then
    raise exception using errcode = '42501', message = 'billing actor not authorized';
  end if;

  select * into v_preinvoice
  from public.billing_preinvoices
  where id = p_preinvoice
    and organization_id = p_org
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'preinvoice not found';
  end if;
  if v_preinvoice.status not in ('draft', 'review') then
    raise exception using errcode = '22023', message = 'preinvoice cannot be approved';
  end if;

  update public.billing_preinvoices
  set status = 'approved',
      approved_by = p_actor,
      approved_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = p_preinvoice;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    actor_scope,
    action,
    entity_type,
    entity_id,
    after_data,
    correlation_id
  ) values (
    p_org,
    p_actor,
    p_scope,
    'billing.preinvoice_approved',
    'billing_preinvoice',
    p_preinvoice::text,
    jsonb_build_object('status', 'approved'),
    p_correlation
  );

  return jsonb_build_object('ok', true, 'preinvoiceId', p_preinvoice, 'status', 'approved', 'correlationId', p_correlation, 'idempotencyKey', p_key);
end;
$$;

create function public.cancel_billing_preinvoice(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid,
  p_preinvoice uuid,
  p_reason text,
  p_correlation uuid,
  p_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_preinvoice public.billing_preinvoices%rowtype;
begin
  if not public.billing_actor_authorized(p_actor, p_scope, p_org, true) then
    raise exception using errcode = '42501', message = 'billing actor not authorized';
  end if;

  select * into v_preinvoice
  from public.billing_preinvoices
  where id = p_preinvoice
    and organization_id = p_org
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'preinvoice not found';
  end if;
  if v_preinvoice.status in ('cancelled', 'converted') then
    raise exception using errcode = '22023', message = 'preinvoice cannot be cancelled';
  end if;

  update public.billing_preinvoice_lines
  set removed_at = statement_timestamp(),
      removed_by = p_actor,
      remove_reason = btrim(p_reason)
  where preinvoice_id = p_preinvoice
    and removed_at is null;

  update public.transport_orders order_row
  set economic_status = 'validated',
      updated_at = statement_timestamp()
  from public.billing_preinvoice_lines line
  where line.preinvoice_id = p_preinvoice
    and line.transport_order_id = order_row.id
    and order_row.organization_id = p_org;

  update public.billing_preinvoices
  set status = 'cancelled',
      cancelled_by = p_actor,
      cancelled_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = p_preinvoice;

  perform public.billing_recalculate_preinvoice_totals(p_preinvoice);

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    actor_scope,
    action,
    entity_type,
    entity_id,
    after_data,
    reason,
    correlation_id
  ) values (
    p_org,
    p_actor,
    p_scope,
    'billing.preinvoice_cancelled',
    'billing_preinvoice',
    p_preinvoice::text,
    jsonb_build_object('status', 'cancelled'),
    btrim(p_reason),
    p_correlation
  );

  return jsonb_build_object('ok', true, 'preinvoiceId', p_preinvoice, 'status', 'cancelled', 'correlationId', p_correlation, 'idempotencyKey', p_key);
end;
$$;

create trigger billing_rates_set_updated_at
before update on public.billing_rates
for each row execute function public.set_updated_at();

create trigger billing_supplement_definitions_set_updated_at
before update on public.billing_supplement_definitions
for each row execute function public.set_updated_at();

create trigger billing_preinvoices_set_updated_at
before update on public.billing_preinvoices
for each row execute function public.set_updated_at();

create trigger billing_rates_validate_tenant
before insert or update on public.billing_rates
for each row execute function public.billing_validate_tenant();

create trigger billing_supplements_validate_tenant
before insert or update on public.transport_order_billing_supplements
for each row execute function public.billing_validate_tenant();

create trigger billing_adjustments_validate_tenant
before insert or update on public.transport_order_pricing_adjustments
for each row execute function public.billing_validate_tenant();

create trigger billing_valuations_validate_tenant
before insert or update on public.transport_order_valuations
for each row execute function public.billing_validate_tenant();

create trigger billing_preinvoices_validate_tenant
before insert or update on public.billing_preinvoices
for each row execute function public.billing_validate_tenant();

create trigger billing_preinvoice_lines_validate_tenant
before insert or update on public.billing_preinvoice_lines
for each row execute function public.billing_validate_tenant();

create trigger transport_orders_mark_needs_recalculation
before update on public.transport_orders
for each row execute function public.billing_mark_order_needs_recalculation();

create trigger transport_items_mark_needs_recalculation
after insert or update or delete on public.transport_items
for each row execute function public.billing_mark_order_needs_recalculation();

create trigger transport_stops_mark_needs_recalculation
after insert or update or delete on public.transport_stops
for each row execute function public.billing_mark_order_needs_recalculation();

create trigger transport_order_supplements_mark_needs_recalculation
after insert or update or delete on public.transport_order_billing_supplements
for each row execute function public.billing_mark_order_needs_recalculation();

create trigger transport_order_adjustments_mark_needs_recalculation
after insert or update or delete on public.transport_order_pricing_adjustments
for each row execute function public.billing_mark_order_needs_recalculation();

alter table public.billing_command_idempotency enable row level security;
alter table public.billing_command_idempotency force row level security;
alter table public.billing_rates enable row level security;
alter table public.billing_rates force row level security;
alter table public.billing_supplement_definitions enable row level security;
alter table public.billing_supplement_definitions force row level security;
alter table public.transport_order_billing_supplements enable row level security;
alter table public.transport_order_billing_supplements force row level security;
alter table public.transport_order_pricing_adjustments enable row level security;
alter table public.transport_order_pricing_adjustments force row level security;
alter table public.transport_order_valuations enable row level security;
alter table public.transport_order_valuations force row level security;
alter table public.billing_preinvoice_counters enable row level security;
alter table public.billing_preinvoice_counters force row level security;
alter table public.billing_preinvoices enable row level security;
alter table public.billing_preinvoices force row level security;
alter table public.billing_preinvoice_lines enable row level security;
alter table public.billing_preinvoice_lines force row level security;

create policy billing_rates_read
on public.billing_rates
for select to authenticated
using (public.can_access_master_data(organization_id, 'billing'));

create policy billing_supplement_definitions_read
on public.billing_supplement_definitions
for select to authenticated
using (public.can_access_master_data(organization_id, 'billing'));

create policy transport_order_billing_supplements_read
on public.transport_order_billing_supplements
for select to authenticated
using (public.can_access_master_data(organization_id, 'billing'));

create policy transport_order_pricing_adjustments_read
on public.transport_order_pricing_adjustments
for select to authenticated
using (public.can_access_master_data(organization_id, 'billing'));

create policy transport_order_valuations_read
on public.transport_order_valuations
for select to authenticated
using (public.can_access_master_data(organization_id, 'billing'));

create policy billing_preinvoices_read
on public.billing_preinvoices
for select to authenticated
using (public.can_access_master_data(organization_id, 'billing'));

create policy billing_preinvoice_lines_read
on public.billing_preinvoice_lines
for select to authenticated
using (public.can_access_master_data(organization_id, 'billing'));

revoke all on table public.billing_command_idempotency, public.billing_rates, public.billing_supplement_definitions, public.transport_order_billing_supplements, public.transport_order_pricing_adjustments, public.transport_order_valuations, public.billing_preinvoice_counters, public.billing_preinvoices, public.billing_preinvoice_lines from public, anon, authenticated;
grant select on table public.billing_rates, public.billing_supplement_definitions, public.transport_order_billing_supplements, public.transport_order_pricing_adjustments, public.transport_order_valuations, public.billing_preinvoices, public.billing_preinvoice_lines to authenticated;
grant all on table public.billing_command_idempotency, public.billing_rates, public.billing_supplement_definitions, public.transport_order_billing_supplements, public.transport_order_pricing_adjustments, public.transport_order_valuations, public.billing_preinvoice_counters, public.billing_preinvoices, public.billing_preinvoice_lines to service_role;

revoke all on function public.billing_actor_authorized(uuid, public.audit_actor_scope, uuid, boolean) from public, anon, authenticated;
revoke all on function public.billing_round_amount(numeric) from public, anon, authenticated;
revoke all on function public.billing_next_preinvoice_reference(uuid, integer) from public, anon, authenticated;
revoke all on function public.billing_recalculate_preinvoice_totals(uuid) from public, anon, authenticated;
revoke all on function public.billing_mark_order_needs_recalculation() from public, anon, authenticated;
revoke all on function public.billing_validate_tenant() from public, anon, authenticated;
revoke all on function public.persist_transport_order_valuation(uuid, public.audit_actor_scope, uuid, uuid, uuid, jsonb, jsonb, jsonb, numeric, numeric, numeric, numeric, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.add_transport_order_pricing_adjustment(uuid, public.audit_actor_scope, uuid, uuid, public.billing_adjustment_kind, smallint, public.billing_charge_mode, numeric, numeric, text, text, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.add_transport_order_billing_supplement(uuid, public.audit_actor_scope, uuid, uuid, uuid, text, text, public.billing_charge_mode, numeric, numeric, text, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.validate_transport_order_valuation(uuid, public.audit_actor_scope, uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.reopen_transport_order_valuation(uuid, public.audit_actor_scope, uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_billing_preinvoice(uuid, public.audit_actor_scope, uuid, uuid, date, date, uuid[], text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.add_orders_to_billing_preinvoice(uuid, public.audit_actor_scope, uuid, uuid, uuid[], uuid, uuid) from public, anon, authenticated;
revoke all on function public.remove_order_from_billing_preinvoice(uuid, public.audit_actor_scope, uuid, uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.approve_billing_preinvoice(uuid, public.audit_actor_scope, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.cancel_billing_preinvoice(uuid, public.audit_actor_scope, uuid, uuid, text, uuid, uuid) from public, anon, authenticated;

grant execute on function public.billing_actor_authorized(uuid, public.audit_actor_scope, uuid, boolean), public.billing_round_amount(numeric), public.billing_next_preinvoice_reference(uuid, integer), public.billing_recalculate_preinvoice_totals(uuid), public.persist_transport_order_valuation(uuid, public.audit_actor_scope, uuid, uuid, uuid, jsonb, jsonb, jsonb, numeric, numeric, numeric, numeric, text, uuid, uuid), public.add_transport_order_pricing_adjustment(uuid, public.audit_actor_scope, uuid, uuid, public.billing_adjustment_kind, smallint, public.billing_charge_mode, numeric, numeric, text, text, text, uuid, uuid), public.add_transport_order_billing_supplement(uuid, public.audit_actor_scope, uuid, uuid, uuid, text, text, public.billing_charge_mode, numeric, numeric, text, text, uuid, uuid), public.validate_transport_order_valuation(uuid, public.audit_actor_scope, uuid, uuid, text, uuid, uuid), public.reopen_transport_order_valuation(uuid, public.audit_actor_scope, uuid, uuid, text, uuid, uuid), public.create_billing_preinvoice(uuid, public.audit_actor_scope, uuid, uuid, date, date, uuid[], text, uuid, uuid), public.add_orders_to_billing_preinvoice(uuid, public.audit_actor_scope, uuid, uuid, uuid[], uuid, uuid), public.remove_order_from_billing_preinvoice(uuid, public.audit_actor_scope, uuid, uuid, uuid, text, uuid, uuid), public.approve_billing_preinvoice(uuid, public.audit_actor_scope, uuid, uuid, uuid, uuid), public.cancel_billing_preinvoice(uuid, public.audit_actor_scope, uuid, uuid, text, uuid, uuid) to service_role;
grant execute on function public.billing_validate_tenant(), public.billing_mark_order_needs_recalculation() to service_role;

comment on table public.billing_rates is 'Tarifas versionadas por organización y cliente con componentes y reglas de suplementos serializados en JSON.';
comment on table public.transport_order_valuations is 'Snapshots inmutables de cálculo económico por orden con desglose completo, snapshot de tarifa y total congelado.';
comment on table public.transport_order_pricing_adjustments is 'Ajustes manuales append-only sobre órdenes de transporte con motivo obligatorio.';
comment on table public.billing_preinvoices is 'Prefacturas internas por organización y cliente, sin numeración fiscal definitiva.';
comment on function public.persist_transport_order_valuation(uuid, public.audit_actor_scope, uuid, uuid, uuid, jsonb, jsonb, jsonb, numeric, numeric, numeric, numeric, text, uuid, uuid) is 'Persiste una valoración económica calculada, congela snapshot y registra auditoría/timeline con idempotencia.';
