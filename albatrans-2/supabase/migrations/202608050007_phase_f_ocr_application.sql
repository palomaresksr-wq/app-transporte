-- Fase F: aplicación controlada del OCR sobre entidades operativas.
-- Migración aditiva y forward-only.

alter table public.transport_orders
  add column if not exists external_reference text null;

create unique index if not exists transport_orders_external_reference_unique
  on public.transport_orders (organization_id, lower(external_reference))
  where external_reference is not null;

create type public.ocr_application_target_entity_type as enum (
  'transport_order',
  'transport_stop',
  'transport_item',
  'client',
  'location',
  'vehicle',
  'driver'
);

create type public.ocr_application_review_status as enum (
  'pending',
  'ready',
  'conflict',
  'invalid',
  'ignored'
);

create type public.ocr_application_status as enum (
  'pending',
  'approved',
  'applied',
  'rejected',
  'failed',
  'archived'
);

create type public.ocr_application_comparison_status as enum (
  'exact_match',
  'new_value',
  'conflict',
  'target_missing',
  'invalid',
  'ambiguous'
);

create table public.ocr_application_command_idempotency (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  result jsonb null check (result is null or jsonb_typeof(result) = 'object'),
  actor_user_id uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  primary key (organization_id, idempotency_key)
);
create index ocr_application_command_idempotency_created_idx on public.ocr_application_command_idempotency (created_at);
alter table public.ocr_application_command_idempotency enable row level security;
alter table public.ocr_application_command_idempotency force row level security;
revoke all on table public.ocr_application_command_idempotency from public, anon, authenticated;
grant all on table public.ocr_application_command_idempotency to service_role;

create table public.ocr_application_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ocr_job_id uuid not null references public.ocr_jobs(id) on delete restrict,
  ocr_result_id uuid not null references public.ocr_results(id) on delete restrict,
  ocr_review_id uuid not null references public.ocr_reviews(id) on delete restrict,
  document_id uuid not null references public.documents(id) on delete restrict,
  transport_order_id uuid not null references public.transport_orders(id) on delete restrict,
  target_entity_type public.ocr_application_target_entity_type not null,
  target_entity_id uuid null,
  field_code text not null check (btrim(field_code) <> '' and length(btrim(field_code)) <= 100),
  current_value_json jsonb null,
  proposed_value_json jsonb not null,
  normalized_value_json jsonb null,
  confidence numeric(5,4) null check (confidence is null or confidence between 0 and 1),
  comparison_status public.ocr_application_comparison_status not null,
  review_status public.ocr_application_review_status not null default 'pending',
  application_status public.ocr_application_status not null default 'pending',
  decision_reason text null,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  decided_by uuid null references public.profiles(user_id) on delete restrict,
  decided_at timestamptz null,
  applied_by uuid null references public.profiles(user_id) on delete restrict,
  applied_at timestamptz null,
  idempotency_key uuid not null,
  correlation_id uuid not null,
  source_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(source_summary) = 'object'),
  constraint ocr_application_proposals_decision_reason_sanitized check (decision_reason is null or length(decision_reason) <= 500)
);
create index ocr_application_proposals_org_job_idx on public.ocr_application_proposals (organization_id, ocr_job_id, created_at desc);
create index ocr_application_proposals_org_review_idx on public.ocr_application_proposals (organization_id, ocr_review_id, created_at desc);
create index ocr_application_proposals_org_status_idx on public.ocr_application_proposals (organization_id, application_status, review_status, created_at desc);
create unique index ocr_application_proposals_idempotency_idx
  on public.ocr_application_proposals (organization_id, idempotency_key, target_entity_type, field_code, coalesce(target_entity_id, '00000000-0000-0000-0000-000000000000'::uuid));

create function public.ocr_application_normalized_text(p_value text) returns text
language sql immutable
set search_path = pg_catalog, public
as $$
  select nullif(regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g'), '');
$$;

create function public.ocr_application_normalized_upper(p_value text) returns text
language sql immutable
set search_path = pg_catalog, public
as $$
  select upper(public.ocr_application_normalized_text(p_value));
$$;

create function public.ocr_application_normalized_lower(p_value text) returns text
language sql immutable
set search_path = pg_catalog, public
as $$
  select lower(public.ocr_application_normalized_text(p_value));
$$;

create function public.ocr_application_normalized_digits(p_value text) returns text
language sql immutable
set search_path = pg_catalog, public
as $$
  select nullif(regexp_replace(coalesce(p_value, ''), '\D+', '', 'g'), '');
$$;

create function public.ocr_application_module_enabled(p_org uuid, p_module_code text) returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    (
      select case omo.override_mode
        when 'enabled' then true
        when 'disabled' then false
        else null
      end
      from public.organization_module_overrides omo
      join public.modules m on m.id = omo.module_id
      where omo.organization_id = p_org
        and m.code = p_module_code
    ),
    (
      select pm.enabled
      from public.organization_subscriptions os
      join public.plan_modules pm on pm.plan_id = os.plan_id
      join public.modules m on m.id = pm.module_id
      where os.organization_id = p_org
        and m.code = p_module_code
    ),
    false
  );
$$;

create function public.apply_ocr_proposals(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid,
  p_proposal_ids uuid[],
  p_correlation uuid,
  p_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_request jsonb;
  v_hash text;
  v_previous public.ocr_application_command_idempotency%rowtype;
  v_proposal public.ocr_application_proposals%rowtype;
  v_order_id uuid;
  v_order public.transport_orders%rowtype;
  v_stop public.transport_stops%rowtype;
  v_item public.transport_items%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_applied_count integer := 0;
  v_failure_code text;
  v_failure_message text;
  v_result jsonb;
  v_field_text text;
  v_field_numeric numeric;
  v_field_timestamp timestamptz;
  v_field_uuid uuid;
  v_target_json jsonb;
begin
  if not public.ocr_actor_authorized(p_actor, p_scope, p_org) then
    raise exception using errcode = '42501', message = 'ocr actor not authorized';
  end if;

  if not public.ocr_application_module_enabled(p_org, 'ocr') or not public.ocr_application_module_enabled(p_org, 'transport_management') then
    raise exception using errcode = '42501', message = 'ocr application modules are disabled';
  end if;

  if p_proposal_ids is null or coalesce(array_length(p_proposal_ids, 1), 0) = 0 then
    raise exception using errcode = '22023', message = 'proposal ids are required';
  end if;

  v_request := jsonb_build_object(
    'command', 'apply_ocr_proposals',
    'organization', p_org,
    'proposalIds', p_proposal_ids
  );
  v_hash := encode(extensions.digest(convert_to(v_request::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.ocr_application_command_idempotency (organization_id, idempotency_key, request_hash, actor_user_id)
  values (p_org, p_key, v_hash, p_actor)
  on conflict do nothing;

  select * into v_previous
  from public.ocr_application_command_idempotency
  where organization_id = p_org
    and idempotency_key = p_key
  for update;

  if v_previous.request_hash <> v_hash then
    raise exception using errcode = '23505', message = 'idempotency key reused with different payload';
  end if;

  if v_previous.result is not null then
    return v_previous.result;
  end if;

  select distinct transport_order_id into v_order_id
  from public.ocr_application_proposals
  where organization_id = p_org
    and id = any(p_proposal_ids)
  order by transport_order_id
  limit 1;

  if v_order_id is null then
    v_failure_code := 'proposal_not_found';
    v_failure_message := 'No se encontraron propuestas para aplicar.';
    update public.ocr_application_proposals
    set application_status = 'failed',
        decision_reason = v_failure_message,
        decided_by = coalesce(decided_by, p_actor),
        decided_at = coalesce(decided_at, statement_timestamp())
    where organization_id = p_org
      and id = any(p_proposal_ids);
    insert into public.transport_events (organization_id, transport_order_id, event_type, actor_user_id, entity_type, entity_id, payload, correlation_id)
    values (p_org, null, 'ocr.application_failed', p_actor, 'ocr_application', null, jsonb_build_object('reason', v_failure_message, 'proposalIds', p_proposal_ids), p_correlation);
    v_result := jsonb_build_object('ok', false, 'code', v_failure_code, 'message', v_failure_message, 'correlationId', p_correlation, 'idempotencyKey', p_key);
    update public.ocr_application_command_idempotency
    set result = v_result,
        completed_at = statement_timestamp()
    where organization_id = p_org
      and idempotency_key = p_key;
    return v_result;
  end if;

  select * into v_order
  from public.transport_orders
  where id = v_order_id
    and organization_id = p_org
  for update;

  if not found then
    v_failure_code := 'target_missing';
    v_failure_message := 'La orden operativa ya no existe.';
    update public.ocr_application_proposals
    set application_status = 'failed',
        decision_reason = v_failure_message,
        decided_by = coalesce(decided_by, p_actor),
        decided_at = coalesce(decided_at, statement_timestamp())
    where organization_id = p_org
      and id = any(p_proposal_ids);
    insert into public.transport_events (organization_id, transport_order_id, event_type, actor_user_id, entity_type, entity_id, payload, correlation_id)
    values (p_org, v_order_id, 'ocr.application_failed', p_actor, 'ocr_application', null, jsonb_build_object('reason', v_failure_message, 'orderId', v_order_id, 'proposalIds', p_proposal_ids), p_correlation);
    v_result := jsonb_build_object('ok', false, 'code', v_failure_code, 'message', v_failure_message, 'correlationId', p_correlation, 'idempotencyKey', p_key);
    update public.ocr_application_command_idempotency
    set result = v_result,
        completed_at = statement_timestamp()
    where organization_id = p_org
      and idempotency_key = p_key;
    return v_result;
  end if;

  for v_proposal in
    select *
    from public.ocr_application_proposals
    where organization_id = p_org
      and id = any(p_proposal_ids)
    order by created_at asc
    for update
  loop
    if v_proposal.application_status <> 'approved' then
      v_failure_code := 'proposal_not_approved';
      v_failure_message := 'Todas las propuestas deben estar aprobadas antes de aplicar.';
      exit;
    end if;
    if v_proposal.comparison_status <> 'new_value' then
      v_failure_code := 'proposal_not_applicable';
      v_failure_message := 'Solo las propuestas con nuevo valor se pueden aplicar.';
      exit;
    end if;

    if v_proposal.target_entity_type = 'transport_order' then
      if v_proposal.transport_order_id <> v_order.id then
        v_failure_code := 'target_mismatch';
        v_failure_message := 'La propuesta no pertenece a la orden bloqueada.';
        exit;
      end if;

      case v_proposal.field_code
        when 'external_reference' then v_target_json := to_jsonb(v_order.external_reference);
        when 'planned_pickup_at' then v_target_json := to_jsonb(v_order.planned_pickup_at);
        when 'planned_delivery_at' then v_target_json := to_jsonb(v_order.planned_delivery_at);
        when 'notes' then v_target_json := to_jsonb(v_order.notes);
        else
          v_failure_code := 'field_not_supported';
          v_failure_message := 'Campo de orden no soportado para aplicación.';
      end case;

      if v_failure_code is not null then
        exit;
      end if;

      if coalesce(v_proposal.current_value_json, 'null'::jsonb) <> coalesce(v_target_json, 'null'::jsonb) then
        v_failure_code := 'stale_proposal';
        v_failure_message := format('El valor actual del campo %s cambió antes de aplicar.', v_proposal.field_code);
        exit;
      end if;

      v_before := jsonb_build_object(v_proposal.field_code, v_target_json);
      if v_proposal.field_code = 'external_reference' then
        v_field_text := nullif(v_proposal.proposed_value_json #>> '{}', '');
        update public.transport_orders
        set external_reference = v_field_text,
            updated_at = statement_timestamp()
        where id = v_order.id
        returning * into v_order;
      elsif v_proposal.field_code = 'planned_pickup_at' then
        v_field_timestamp := (v_proposal.proposed_value_json #>> '{}')::timestamptz;
        update public.transport_orders
        set planned_pickup_at = v_field_timestamp,
            updated_at = statement_timestamp()
        where id = v_order.id
        returning * into v_order;
      elsif v_proposal.field_code = 'planned_delivery_at' then
        v_field_timestamp := (v_proposal.proposed_value_json #>> '{}')::timestamptz;
        update public.transport_orders
        set planned_delivery_at = v_field_timestamp,
            updated_at = statement_timestamp()
        where id = v_order.id
        returning * into v_order;
      elsif v_proposal.field_code = 'notes' then
        v_field_text := nullif(v_proposal.proposed_value_json #>> '{}', '');
        update public.transport_orders
        set notes = v_field_text,
            updated_at = statement_timestamp()
        where id = v_order.id
        returning * into v_order;
      end if;

      v_after := jsonb_build_object(v_proposal.field_code, case v_proposal.field_code when 'planned_pickup_at' then to_jsonb(v_order.planned_pickup_at) when 'planned_delivery_at' then to_jsonb(v_order.planned_delivery_at) when 'notes' then to_jsonb(v_order.notes) else to_jsonb(v_order.external_reference) end);

    elsif v_proposal.target_entity_type = 'transport_stop' then
      select * into v_stop
      from public.transport_stops
      where id = v_proposal.target_entity_id
        and organization_id = p_org
        and transport_order_id = v_order.id
      for update;

      if not found then
        v_failure_code := 'target_missing';
        v_failure_message := 'La parada objetivo ya no existe.';
        exit;
      end if;

      if v_proposal.field_code <> 'location_id' then
        v_failure_code := 'field_not_supported';
        v_failure_message := 'Campo de parada no soportado para aplicación.';
        exit;
      end if;

      v_target_json := to_jsonb(v_stop.location_id);
      if coalesce(v_proposal.current_value_json, 'null'::jsonb) <> coalesce(v_target_json, 'null'::jsonb) then
        v_failure_code := 'stale_proposal';
        v_failure_message := 'La parada cambió antes de aplicar.';
        exit;
      end if;

      v_field_uuid := (v_proposal.proposed_value_json #>> '{}')::uuid;
      v_before := jsonb_build_object('location_id', to_jsonb(v_stop.location_id));
      update public.transport_stops
      set location_id = v_field_uuid,
          updated_at = statement_timestamp()
      where id = v_stop.id
      returning * into v_stop;
      v_after := jsonb_build_object('location_id', to_jsonb(v_stop.location_id));

    elsif v_proposal.target_entity_type = 'transport_item' then
      select * into v_item
      from public.transport_items
      where id = v_proposal.target_entity_id
        and organization_id = p_org
        and transport_order_id = v_order.id
      for update;

      if not found then
        v_failure_code := 'target_missing';
        v_failure_message := 'El item objetivo ya no existe.';
        exit;
      end if;

      case v_proposal.field_code
        when 'packages' then v_target_json := to_jsonb(v_item.packages);
        when 'pallets' then v_target_json := to_jsonb(v_item.pallets);
        when 'weight_kg' then v_target_json := to_jsonb(v_item.weight_kg);
        when 'volume_m3' then v_target_json := to_jsonb(v_item.volume_m3);
        when 'reference' then v_target_json := to_jsonb(v_item.reference);
        when 'notes' then v_target_json := to_jsonb(v_item.notes);
        else
          v_failure_code := 'field_not_supported';
          v_failure_message := 'Campo de item no soportado para aplicación.';
      end case;

      if v_failure_code is not null then
        exit;
      end if;

      if coalesce(v_proposal.current_value_json, 'null'::jsonb) <> coalesce(v_target_json, 'null'::jsonb) then
        v_failure_code := 'stale_proposal';
        v_failure_message := format('El valor actual del campo %s del item cambió antes de aplicar.', v_proposal.field_code);
        exit;
      end if;

      v_before := jsonb_build_object(v_proposal.field_code, v_target_json);
      if v_proposal.field_code = 'packages' then
        v_field_numeric := (v_proposal.proposed_value_json #>> '{}')::numeric;
        update public.transport_items
        set packages = v_field_numeric::integer,
            updated_at = statement_timestamp()
        where id = v_item.id
        returning * into v_item;
      elsif v_proposal.field_code = 'pallets' then
        v_field_numeric := (v_proposal.proposed_value_json #>> '{}')::numeric;
        update public.transport_items
        set pallets = v_field_numeric::integer,
            updated_at = statement_timestamp()
        where id = v_item.id
        returning * into v_item;
      elsif v_proposal.field_code = 'weight_kg' then
        v_field_numeric := (v_proposal.proposed_value_json #>> '{}')::numeric;
        update public.transport_items
        set weight_kg = v_field_numeric,
            updated_at = statement_timestamp()
        where id = v_item.id
        returning * into v_item;
      elsif v_proposal.field_code = 'volume_m3' then
        v_field_numeric := (v_proposal.proposed_value_json #>> '{}')::numeric;
        update public.transport_items
        set volume_m3 = v_field_numeric,
            updated_at = statement_timestamp()
        where id = v_item.id
        returning * into v_item;
      elsif v_proposal.field_code = 'reference' then
        v_field_text := nullif(v_proposal.proposed_value_json #>> '{}', '');
        update public.transport_items
        set reference = v_field_text,
            updated_at = statement_timestamp()
        where id = v_item.id
        returning * into v_item;
      elsif v_proposal.field_code = 'notes' then
        v_field_text := nullif(v_proposal.proposed_value_json #>> '{}', '');
        update public.transport_items
        set notes = v_field_text,
            updated_at = statement_timestamp()
        where id = v_item.id
        returning * into v_item;
      end if;

      v_after := jsonb_build_object(v_proposal.field_code, case v_proposal.field_code when 'packages' then to_jsonb(v_item.packages) when 'pallets' then to_jsonb(v_item.pallets) when 'weight_kg' then to_jsonb(v_item.weight_kg) when 'volume_m3' then to_jsonb(v_item.volume_m3) when 'reference' then to_jsonb(v_item.reference) else to_jsonb(v_item.notes) end);

    else
      v_failure_code := 'target_not_applicable';
      v_failure_message := 'Las propuestas de esta fase solo se aplican a ordenes, paradas e items.';
      exit;
    end if;

    v_applied_count := v_applied_count + 1;

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
      'ocr.application_applied',
      'ocr_application_proposal',
      v_proposal.id::text,
      v_before,
      v_after,
      v_proposal.decision_reason,
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
      v_order.id,
      'ocr.application_applied',
      p_actor,
      'ocr_application_proposal',
      v_proposal.id,
      jsonb_build_object(
        'fieldCode', v_proposal.field_code,
        'targetEntityType', v_proposal.target_entity_type,
        'before', v_before,
        'after', v_after,
        'proposalId', v_proposal.id,
        'ocrJobId', v_proposal.ocr_job_id,
        'ocrReviewId', v_proposal.ocr_review_id,
        'correlationId', p_correlation,
        'idempotencyKey', p_key
      ),
      p_correlation
    );

    update public.ocr_application_proposals
    set application_status = 'applied',
        applied_by = p_actor,
        applied_at = statement_timestamp(),
        decided_by = coalesce(decided_by, p_actor),
        decided_at = coalesce(decided_at, statement_timestamp())
    where id = v_proposal.id;
  end loop;

  if v_failure_code is not null then
    update public.ocr_application_proposals
    set application_status = 'failed',
        decision_reason = coalesce(decision_reason, v_failure_message),
        decided_by = coalesce(decided_by, p_actor),
        decided_at = coalesce(decided_at, statement_timestamp())
    where organization_id = p_org
      and id = any(p_proposal_ids)
      and application_status = 'approved';

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
      'ocr.application_failed',
      'ocr_application',
      null,
      jsonb_build_object('proposalIds', p_proposal_ids, 'appliedCount', v_applied_count),
      v_failure_message,
      p_correlation
    );

    insert into public.internal_notifications (
      organization_id,
      transport_order_id,
      recipient_user_id,
      event_type,
      title,
      payload
    ) values (
      p_org,
      v_order.id,
      p_actor,
      'ocr.application_failed',
      'Aplicacion OCR fallida',
      jsonb_build_object('reason', v_failure_message, 'proposalIds', p_proposal_ids)
    );

    v_result := jsonb_build_object(
      'ok', false,
      'code', v_failure_code,
      'message', v_failure_message,
      'appliedCount', v_applied_count,
      'correlationId', p_correlation,
      'idempotencyKey', p_key
    );
  else
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
      'ocr.application_completed',
      'ocr_application',
      v_order.id::text,
      jsonb_build_object('appliedCount', v_applied_count, 'proposalIds', p_proposal_ids),
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
      v_order.id,
      'ocr.application_completed',
      p_actor,
      'ocr_application',
      v_order.id,
      jsonb_build_object(
        'summary', format('Se aplicaron %s campos procedentes del OCR del documento %s.', v_applied_count, v_order.id),
        'appliedCount', v_applied_count,
        'proposalIds', p_proposal_ids,
        'correlationId', p_correlation,
        'idempotencyKey', p_key
      ),
      p_correlation
    );

    insert into public.internal_notifications (
      organization_id,
      transport_order_id,
      recipient_user_id,
      event_type,
      title,
      payload
    ) values (
      p_org,
      v_order.id,
      p_actor,
      'ocr.application_completed',
      'Aplicacion OCR completada',
      jsonb_build_object('appliedCount', v_applied_count, 'proposalIds', p_proposal_ids)
    );

    v_result := jsonb_build_object(
      'ok', true,
      'appliedCount', v_applied_count,
      'proposalIds', p_proposal_ids,
      'orderId', v_order.id,
      'correlationId', p_correlation,
      'idempotencyKey', p_key
    );
  end if;

  update public.ocr_application_command_idempotency
  set result = v_result,
      completed_at = statement_timestamp()
  where organization_id = p_org
    and idempotency_key = p_key;

  return v_result;
end;
$$;

alter table public.ocr_application_proposals enable row level security;
alter table public.ocr_application_proposals force row level security;

create policy ocr_application_proposals_read
on public.ocr_application_proposals
for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.current_organization_is_active()
  and public.current_organization_role() = 'admin_empresa'
);

revoke all on table public.ocr_application_proposals from public, anon, authenticated;
grant select on table public.ocr_application_proposals to authenticated;
grant all on table public.ocr_application_proposals to service_role;

revoke all on function public.apply_ocr_proposals(uuid, public.audit_actor_scope, uuid, uuid[], uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_ocr_proposals(uuid, public.audit_actor_scope, uuid, uuid[], uuid, uuid) to service_role;

comment on table public.ocr_application_proposals is 'Propuestas OCR para aplicar cambios operativos con revision humana, comparacion y trazabilidad.';
comment on table public.ocr_application_command_idempotency is 'Resultados inmutables por tenant y key para aplicar propuestas OCR.';
comment on function public.apply_ocr_proposals(uuid, public.audit_actor_scope, uuid, uuid[], uuid, uuid) is 'Aplica en una sola transaccion las propuestas OCR aprobadas sobre entidades operativas.';
