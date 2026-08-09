-- Fase E: OCR documental y revision humana.
-- Aditiva y forward-only. No modifica migraciones anteriores.

create type public.ocr_job_status as enum (
  'queued',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
  'needs_review',
  'reviewed',
  'archived'
);

create type public.ocr_review_status as enum (
  'pending',
  'in_progress',
  'approved',
  'rejected',
  'archived'
);

create type public.ocr_field_validation_status as enum (
  'extracted',
  'valid',
  'uncertain',
  'invalid',
  'missing',
  'not_applicable'
);

create type public.ocr_quota_reservation_status as enum (
  'reserved',
  'committed',
  'released',
  'expired'
);

create type public.ocr_outbox_status as enum (
  'pending',
  'processing',
  'completed',
  'failed'
);

create table public.ocr_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  document_id uuid not null references public.documents(id) on delete restrict,
  document_version_id uuid not null references public.document_versions(id) on delete restrict,
  provider_code text not null check (provider_code in ('mock_local', 'legacy_leer_albaran')),
  status public.ocr_job_status not null default 'queued',
  requested_by uuid not null references public.profiles(user_id) on delete restrict,
  requested_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  failed_at timestamptz null,
  failure_code text null,
  failure_message text null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  idempotency_key uuid not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  correlation_id uuid not null,
  quota_reservation_id uuid null,
  provider_request_id text null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ocr_jobs_failure_message_sanitized check (failure_message is null or length(failure_message) <= 500),
  constraint ocr_jobs_terminal_timestamps check (
    (
      status in ('queued', 'processing')
      and completed_at is null
      and failed_at is null
    ) or (
      status in ('needs_review', 'succeeded', 'reviewed', 'archived')
      and completed_at is not null
    ) or (
      status in ('failed', 'cancelled')
      and failed_at is not null
    )
  )
);

create unique index ocr_jobs_org_idempotency_idx on public.ocr_jobs (organization_id, idempotency_key);
create index ocr_jobs_org_status_requested_idx on public.ocr_jobs (organization_id, status, requested_at);
create index ocr_jobs_doc_version_idx on public.ocr_jobs (document_version_id, requested_at desc);

create table public.ocr_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ocr_job_id uuid not null unique references public.ocr_jobs(id) on delete restrict,
  document_id uuid not null references public.documents(id) on delete restrict,
  document_version_id uuid not null references public.document_versions(id) on delete restrict,
  provider_code text not null check (provider_code in ('mock_local', 'legacy_leer_albaran')),
  provider_model text null,
  schema_version text not null check (length(btrim(schema_version)) > 0 and length(schema_version) <= 40),
  detected_document_type text null,
  detected_language text null,
  overall_confidence numeric(5,4) null check (overall_confidence between 0 and 1),
  raw_response_json jsonb not null check (jsonb_typeof(raw_response_json) in ('object', 'array')),
  normalized_data_json jsonb not null check (jsonb_typeof(normalized_data_json) = 'object'),
  warnings_json jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings_json) = 'array'),
  created_at timestamptz not null default now()
);

create index ocr_results_org_created_idx on public.ocr_results (organization_id, created_at desc);
create index ocr_results_doc_version_idx on public.ocr_results (document_id, document_version_id, created_at desc);

create table public.ocr_field_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ocr_result_id uuid not null references public.ocr_results(id) on delete restrict,
  field_code text not null check (field_code ~ '^[a-z][a-z0-9_]*$' and length(field_code) <= 100),
  raw_value jsonb null,
  normalized_value jsonb null,
  confidence numeric(5,4) null check (confidence between 0 and 1),
  page_number integer null check (page_number is null or page_number > 0),
  bounding_box_json jsonb null,
  validation_status public.ocr_field_validation_status not null default 'extracted',
  warnings_json jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings_json) = 'array'),
  created_at timestamptz not null default now(),
  constraint ocr_field_results_bbox_shape check (
    bounding_box_json is null
    or jsonb_typeof(bounding_box_json) = 'object'
  )
);

create index ocr_field_results_result_idx on public.ocr_field_results (ocr_result_id, field_code);
create index ocr_field_results_org_field_idx on public.ocr_field_results (organization_id, field_code, created_at desc);

create table public.ocr_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ocr_job_id uuid not null references public.ocr_jobs(id) on delete restrict,
  ocr_result_id uuid not null references public.ocr_results(id) on delete restrict,
  status public.ocr_review_status not null default 'pending',
  reviewed_by uuid not null references public.profiles(user_id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ocr_reviews_notes_sanitized check (notes is null or length(notes) <= 1000)
);

create index ocr_reviews_job_idx on public.ocr_reviews (ocr_job_id, created_at desc);
create index ocr_reviews_org_status_idx on public.ocr_reviews (organization_id, status, created_at desc);

create table public.ocr_field_corrections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ocr_review_id uuid not null references public.ocr_reviews(id) on delete restrict,
  ocr_field_result_id uuid null references public.ocr_field_results(id) on delete restrict,
  field_code text not null check (field_code ~ '^[a-z][a-z0-9_]*$' and length(field_code) <= 100),
  previous_value jsonb null,
  corrected_value jsonb null,
  correction_reason text null,
  corrected_by uuid not null references public.profiles(user_id) on delete restrict,
  corrected_at timestamptz not null default now(),
  constraint ocr_field_corrections_reason_sanitized check (correction_reason is null or length(correction_reason) <= 400)
);

create index ocr_field_corrections_review_idx on public.ocr_field_corrections (ocr_review_id, corrected_at);

create table public.ocr_quota_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  limit_code text not null check (limit_code = 'max_ocr_monthly'),
  ocr_job_id uuid null references public.ocr_jobs(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0 and quantity <= 100),
  status public.ocr_quota_reservation_status not null default 'reserved',
  reserved_at timestamptz not null default now(),
  committed_at timestamptz null,
  released_at timestamptz null,
  idempotency_key uuid not null,
  reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ocr_quota_reservations_reason_sanitized check (reason is null or length(reason) <= 300)
);

create unique index ocr_quota_reservations_org_key_idx on public.ocr_quota_reservations (organization_id, idempotency_key);
create index ocr_quota_reservations_org_status_idx on public.ocr_quota_reservations (organization_id, status, reserved_at);

create table public.ocr_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ocr_job_id uuid null references public.ocr_jobs(id) on delete restrict,
  ocr_result_id uuid null references public.ocr_results(id) on delete restrict,
  event_type text not null check (
    event_type in (
      'ocr.requested',
      'ocr.processing_started',
      'ocr.provider_call_required',
      'ocr.succeeded',
      'ocr.failed',
      'ocr.review_required',
      'ocr.review_approved',
      'ocr.review_rejected',
      'ocr.quota_reserved',
      'ocr.quota_committed',
      'ocr.quota_released',
      'ocr.reconciliation_required'
    )
  ),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status public.ocr_outbox_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  last_error text null,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  processed_at timestamptz null,
  correlation_id uuid not null,
  unique (correlation_id, event_type)
);

create index ocr_outbox_pending_idx on public.ocr_outbox (status, next_attempt_at) where status in ('pending', 'failed');

create table public.ocr_command_idempotency (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  idempotency_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  result jsonb null check (result is null or jsonb_typeof(result) = 'object'),
  actor_user_id uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  primary key (organization_id, idempotency_key)
);

create index ocr_command_idempotency_created_idx on public.ocr_command_idempotency (created_at desc);

create unique index organization_usage_counters_period_unique_idx
on public.organization_usage_counters (organization_id, metric_code, period_start);

create function public.validate_ocr_tenant() returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_org uuid;
  v_doc uuid;
  v_ver uuid;
begin
  if tg_table_name in ('ocr_jobs', 'ocr_results') then
    if new.document_id is not null then
      select organization_id into v_org from public.documents where id = new.document_id;
      if v_org is distinct from new.organization_id then
        raise exception using errcode = '23514', message = 'document tenant mismatch';
      end if;
    end if;
    if new.document_version_id is not null then
      select organization_id, document_id into v_org, v_doc from public.document_versions where id = new.document_version_id;
      if v_org is distinct from new.organization_id then
        raise exception using errcode = '23514', message = 'version tenant mismatch';
      end if;
      if new.document_id is not null and v_doc is distinct from new.document_id then
        raise exception using errcode = '23514', message = 'version does not belong to document';
      end if;
    end if;
  end if;

  if tg_table_name = 'ocr_results' then
    select organization_id, document_id, document_version_id into v_org, v_doc, v_ver
    from public.ocr_jobs
    where id = new.ocr_job_id;
    if not found or v_org is distinct from new.organization_id or v_doc is distinct from new.document_id or v_ver is distinct from new.document_version_id then
      raise exception using errcode = '23514', message = 'result must reference same tenant/doc/version as job';
    end if;
  end if;

  if tg_table_name = 'ocr_field_results' then
    select organization_id into v_org from public.ocr_results where id = new.ocr_result_id;
    if v_org is distinct from new.organization_id then
      raise exception using errcode = '23514', message = 'field result tenant mismatch';
    end if;
  end if;

  if tg_table_name = 'ocr_reviews' then
    select organization_id into v_org from public.ocr_jobs where id = new.ocr_job_id;
    if v_org is distinct from new.organization_id then
      raise exception using errcode = '23514', message = 'review job tenant mismatch';
    end if;
    select organization_id into v_org from public.ocr_results where id = new.ocr_result_id;
    if v_org is distinct from new.organization_id then
      raise exception using errcode = '23514', message = 'review result tenant mismatch';
    end if;
  end if;

  if tg_table_name = 'ocr_field_corrections' then
    select organization_id into v_org from public.ocr_reviews where id = new.ocr_review_id;
    if v_org is distinct from new.organization_id then
      raise exception using errcode = '23514', message = 'correction review tenant mismatch';
    end if;
    if new.ocr_field_result_id is not null then
      select organization_id into v_org from public.ocr_field_results where id = new.ocr_field_result_id;
      if v_org is distinct from new.organization_id then
        raise exception using errcode = '23514', message = 'correction field tenant mismatch';
      end if;
    end if;
  end if;

  if tg_table_name = 'ocr_quota_reservations' then
    if new.ocr_job_id is not null then
      select organization_id into v_org from public.ocr_jobs where id = new.ocr_job_id;
      if v_org is distinct from new.organization_id then
        raise exception using errcode = '23514', message = 'quota reservation tenant mismatch';
      end if;
    end if;
  end if;

  if tg_table_name = 'ocr_outbox' then
    if new.ocr_job_id is not null then
      select organization_id into v_org from public.ocr_jobs where id = new.ocr_job_id;
      if v_org is distinct from new.organization_id then
        raise exception using errcode = '23514', message = 'outbox job tenant mismatch';
      end if;
    end if;
    if new.ocr_result_id is not null then
      select organization_id into v_org from public.ocr_results where id = new.ocr_result_id;
      if v_org is distinct from new.organization_id then
        raise exception using errcode = '23514', message = 'outbox result tenant mismatch';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create function public.guard_ocr_result_mutation() returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception using errcode = '55000', message = 'ocr result rows are immutable';
end;
$$;

create function public.guard_ocr_field_result_mutation() returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception using errcode = '55000', message = 'ocr field result rows are immutable';
end;
$$;

create function public.ocr_actor_authorized(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid
) returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.document_actor_authorized(p_actor, p_scope, p_org, 'ocr')
$$;

create function public.ocr_limit_value_for_organization(
  p_org uuid,
  p_limit_code text
) returns bigint
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    when override_row.override_mode = 'custom' then override_row.limit_value
    else plan_limit.limit_value
  end
  from public.organizations o
  left join public.organization_subscriptions subscription
    on subscription.organization_id = o.id
  left join public.limit_definitions definition
    on definition.code = p_limit_code
   and definition.status = 'active'
  left join public.plan_limits plan_limit
    on plan_limit.plan_id = subscription.plan_id
   and plan_limit.limit_definition_id = definition.id
  left join public.organization_limit_overrides override_row
    on override_row.organization_id = o.id
   and override_row.limit_definition_id = definition.id
  where o.id = p_org
$$;

create function public.ocr_sanitized_message(p_text text) returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case
    when p_text is null then null
    else left(regexp_replace(p_text, '[\n\r\t]+', ' ', 'g'), 500)
  end
$$;

create trigger ocr_jobs_validate_tenant
before insert or update on public.ocr_jobs
for each row execute function public.validate_ocr_tenant();

create trigger ocr_jobs_updated
before update on public.ocr_jobs
for each row execute function public.set_updated_at();

create trigger ocr_results_validate_tenant
before insert or update on public.ocr_results
for each row execute function public.validate_ocr_tenant();

create trigger ocr_results_immutable
before update on public.ocr_results
for each row execute function public.guard_ocr_result_mutation();

create trigger ocr_field_results_validate_tenant
before insert or update on public.ocr_field_results
for each row execute function public.validate_ocr_tenant();

create trigger ocr_field_results_immutable
before update on public.ocr_field_results
for each row execute function public.guard_ocr_field_result_mutation();

create trigger ocr_reviews_validate_tenant
before insert or update on public.ocr_reviews
for each row execute function public.validate_ocr_tenant();

create trigger ocr_reviews_updated
before update on public.ocr_reviews
for each row execute function public.set_updated_at();

create trigger ocr_field_corrections_validate_tenant
before insert or update on public.ocr_field_corrections
for each row execute function public.validate_ocr_tenant();

create trigger ocr_quota_reservations_validate_tenant
before insert or update on public.ocr_quota_reservations
for each row execute function public.validate_ocr_tenant();

create trigger ocr_quota_reservations_updated
before update on public.ocr_quota_reservations
for each row execute function public.set_updated_at();

create trigger ocr_outbox_validate_tenant
before insert or update on public.ocr_outbox
for each row execute function public.validate_ocr_tenant();

create function public.request_document_ocr(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid,
  p_document uuid,
  p_document_version uuid,
  p_provider_code text,
  p_payload jsonb,
  p_correlation uuid,
  p_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_doc public.documents%rowtype;
  v_version public.document_versions%rowtype;
  v_hash text;
  v_request jsonb;
  v_previous public.ocr_command_idempotency%rowtype;
  v_job public.ocr_jobs%rowtype;
  v_result jsonb;
  v_limit bigint;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_usage_row public.organization_usage_counters%rowtype;
  v_reserved bigint;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  if not public.ocr_actor_authorized(p_actor, p_scope, p_org) then
    raise exception using errcode = '42501', message = 'ocr actor not authorized';
  end if;

  if p_document is null or p_document_version is null or p_correlation is null or p_key is null then
    raise exception using errcode = '22023', message = 'missing ocr context';
  end if;

  if p_provider_code not in ('mock_local', 'legacy_leer_albaran') then
    raise exception using errcode = '22023', message = 'unsupported ocr provider';
  end if;

  if jsonb_typeof(v_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'ocr payload must be an object';
  end if;

  if (v_payload - array['schemaVersion', 'reviewThreshold', 'importantFields', 'providerMode']) <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'ocr payload contains unsupported fields';
  end if;

  select * into v_doc
  from public.documents
  where id = p_document
  for update;

  if not found or v_doc.organization_id <> p_org then
    raise exception using errcode = 'P0002', message = 'document not found';
  end if;

  select * into v_version
  from public.document_versions
  where id = p_document_version
  for update;

  if not found or v_version.organization_id <> p_org or v_version.document_id <> p_document then
    raise exception using errcode = 'P0002', message = 'document version not found';
  end if;

  if v_doc.status = 'archived' or v_version.status <> 'available' then
    raise exception using errcode = '55000', message = 'document version is not available for OCR';
  end if;

  if v_version.mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
    raise exception using errcode = '22023', message = 'mime type not supported for OCR';
  end if;

  v_request := jsonb_build_object(
    'command', 'request_document_ocr',
    'actor', p_actor,
    'scope', p_scope,
    'organization', p_org,
    'document', p_document,
    'documentVersion', p_document_version,
    'providerCode', p_provider_code,
    'payload', v_payload
  );
  v_hash := encode(extensions.digest(convert_to(v_request::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.ocr_command_idempotency (organization_id, idempotency_key, request_hash, actor_user_id)
  values (p_org, p_key, v_hash, p_actor)
  on conflict do nothing;

  select * into v_previous
  from public.ocr_command_idempotency
  where organization_id = p_org
    and idempotency_key = p_key
  for update;

  if v_previous.request_hash <> v_hash then
    raise exception using errcode = '23505', message = 'idempotency key reused with different payload';
  end if;

  if v_previous.result is not null then
    return v_previous.result;
  end if;

  perform 1 from public.organizations where id = p_org for update;

  v_limit := public.ocr_limit_value_for_organization(p_org, 'max_ocr_monthly');
  if v_limit is null then
    raise exception using errcode = '23514', message = 'ocr limit is not configured';
  end if;
  if v_limit <= 0 then
    raise exception using errcode = '23514', message = 'ocr quota exhausted';
  end if;

  v_period_start := date_trunc('month', statement_timestamp());
  v_period_end := v_period_start + interval '1 month';

  insert into public.organization_usage_counters (
    organization_id,
    metric_code,
    period_start,
    period_end,
    usage_value
  ) values (
    p_org,
    'ocr_monthly',
    v_period_start,
    v_period_end,
    0
  ) on conflict (organization_id, metric_code, period_start)
  do update set updated_at = statement_timestamp()
  returning * into v_usage_row;

  select * into v_usage_row
  from public.organization_usage_counters
  where organization_id = p_org
    and metric_code = 'ocr_monthly'
    and period_start = v_period_start
  for update;

  select coalesce(sum(quantity), 0)
  into v_reserved
  from public.ocr_quota_reservations
  where organization_id = p_org
    and limit_code = 'max_ocr_monthly'
    and status = 'reserved'
    and reserved_at >= v_period_start
    and reserved_at < v_period_end;

  if v_usage_row.usage_value + v_reserved + 1 > v_limit then
    raise exception using errcode = '23514', message = 'ocr quota exhausted';
  end if;

  insert into public.ocr_jobs (
    organization_id,
    document_id,
    document_version_id,
    provider_code,
    status,
    requested_by,
    idempotency_key,
    payload_hash,
    correlation_id,
    payload
  ) values (
    p_org,
    p_document,
    p_document_version,
    p_provider_code,
    'queued',
    p_actor,
    p_key,
    v_hash,
    p_correlation,
    v_payload
  ) returning * into v_job;

  insert into public.ocr_quota_reservations (
    organization_id,
    limit_code,
    ocr_job_id,
    quantity,
    status,
    idempotency_key,
    reason
  ) values (
    p_org,
    'max_ocr_monthly',
    v_job.id,
    1,
    'reserved',
    p_key,
    'ocr request reserved capacity'
  )
  returning id into v_job.quota_reservation_id;

  update public.ocr_jobs
  set quota_reservation_id = v_job.quota_reservation_id
  where id = v_job.id;

  insert into public.ocr_outbox (organization_id, ocr_job_id, event_type, payload, correlation_id)
  values
    (p_org, v_job.id, 'ocr.requested', jsonb_build_object('providerCode', p_provider_code), p_correlation),
    (p_org, v_job.id, 'ocr.provider_call_required', jsonb_build_object('providerCode', p_provider_code), p_correlation),
    (p_org, v_job.id, 'ocr.quota_reserved', jsonb_build_object('reservationId', v_job.quota_reservation_id), p_correlation);

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
    'ocr.job_created',
    'ocr_job',
    v_job.id::text,
    jsonb_build_object(
      'jobId', v_job.id,
      'documentId', p_document,
      'documentVersionId', p_document_version,
      'providerCode', p_provider_code,
      'status', 'queued',
      'idempotencyKey', p_key,
      'correlationId', p_correlation
    ),
    p_correlation
  );

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
    'ocr.quota_reserved',
    'ocr_quota_reservation',
    v_job.quota_reservation_id::text,
    jsonb_build_object('jobId', v_job.id, 'quantity', 1, 'limitCode', 'max_ocr_monthly'),
    p_correlation
  );

  if v_doc.transport_order_id is not null then
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
      v_doc.transport_order_id,
      'ocr.requested',
      p_actor,
      'ocr_job',
      v_job.id,
      jsonb_build_object(
        'jobId', v_job.id,
        'documentId', p_document,
        'documentVersionId', p_document_version,
        'providerCode', p_provider_code,
        'status', 'queued',
        'correlationId', p_correlation,
        'idempotencyKey', p_key
      ),
      p_correlation
    );
  end if;

  v_result := jsonb_build_object(
    'jobId', v_job.id,
    'documentId', p_document,
    'documentVersionId', p_document_version,
    'providerCode', p_provider_code,
    'status', 'queued',
    'reservationId', v_job.quota_reservation_id,
    'correlationId', p_correlation,
    'idempotencyKey', p_key
  );

  update public.ocr_command_idempotency
  set result = v_result,
      completed_at = statement_timestamp()
  where organization_id = p_org
    and idempotency_key = p_key;

  return v_result;
end;
$$;

create function public.mark_ocr_processing_started(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid,
  p_job uuid,
  p_provider_request_id text,
  p_correlation uuid,
  p_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.ocr_jobs%rowtype;
  v_hash text;
  v_request jsonb;
  v_previous public.ocr_command_idempotency%rowtype;
  v_result jsonb;
  v_usage_row public.organization_usage_counters%rowtype;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_doc public.documents%rowtype;
  v_quota_quantity integer := 0;
begin
  if not public.ocr_actor_authorized(p_actor, p_scope, p_org) then
    raise exception using errcode = '42501', message = 'ocr actor not authorized';
  end if;

  if p_job is null or p_correlation is null or p_key is null then
    raise exception using errcode = '22023', message = 'missing processing context';
  end if;

  v_request := jsonb_build_object(
    'command', 'mark_ocr_processing_started',
    'organization', p_org,
    'job', p_job,
    'providerRequestId', coalesce(p_provider_request_id, '')
  );
  v_hash := encode(extensions.digest(convert_to(v_request::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.ocr_command_idempotency (organization_id, idempotency_key, request_hash, actor_user_id)
  values (p_org, p_key, v_hash, p_actor)
  on conflict do nothing;

  select * into v_previous
  from public.ocr_command_idempotency
  where organization_id = p_org
    and idempotency_key = p_key
  for update;

  if v_previous.request_hash <> v_hash then
    raise exception using errcode = '23505', message = 'idempotency key reused with different payload';
  end if;

  if v_previous.result is not null then
    return v_previous.result;
  end if;

  select * into v_job
  from public.ocr_jobs
  where id = p_job
    and organization_id = p_org
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ocr job not found';
  end if;

  if v_job.status = 'processing' then
    null;
  elsif v_job.status not in ('queued', 'failed') then
    raise exception using errcode = '55000', message = 'ocr job cannot start processing from this state';
  end if;

  perform 1 from public.organizations where id = p_org for update;

  if v_job.quota_reservation_id is not null then
    update public.ocr_quota_reservations
    set status = 'committed',
        committed_at = statement_timestamp(),
        updated_at = statement_timestamp()
    where id = v_job.quota_reservation_id
      and organization_id = p_org
      and status = 'reserved'
    returning quantity into v_quota_quantity;

    if found then
      v_period_start := date_trunc('month', statement_timestamp());
      v_period_end := v_period_start + interval '1 month';

      insert into public.organization_usage_counters (
        organization_id,
        metric_code,
        period_start,
        period_end,
        usage_value
      ) values (
        p_org,
        'ocr_monthly',
        v_period_start,
        v_period_end,
        0
      ) on conflict (organization_id, metric_code, period_start)
      do update set updated_at = statement_timestamp();

      select * into v_usage_row
      from public.organization_usage_counters
      where organization_id = p_org
        and metric_code = 'ocr_monthly'
        and period_start = v_period_start
      for update;

      update public.organization_usage_counters
      set usage_value = usage_value + v_quota_quantity,
          updated_at = statement_timestamp()
      where organization_id = p_org
        and metric_code = 'ocr_monthly'
        and period_start = v_period_start;

      insert into public.ocr_outbox (organization_id, ocr_job_id, event_type, payload, correlation_id)
      values (p_org, v_job.id, 'ocr.quota_committed', jsonb_build_object('reservationId', v_job.quota_reservation_id), p_correlation)
      on conflict do nothing;

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
        'ocr.quota_committed',
        'ocr_quota_reservation',
        v_job.quota_reservation_id::text,
        jsonb_build_object('jobId', v_job.id, 'limitCode', 'max_ocr_monthly'),
        p_correlation
      );
    end if;
  end if;

  update public.ocr_jobs
  set status = 'processing',
      started_at = coalesce(started_at, statement_timestamp()),
      failed_at = null,
      failure_code = null,
      failure_message = null,
      attempt_count = attempt_count + 1,
      provider_request_id = coalesce(nullif(btrim(p_provider_request_id), ''), provider_request_id),
      updated_at = statement_timestamp()
  where id = v_job.id
  returning * into v_job;

  insert into public.ocr_outbox (organization_id, ocr_job_id, event_type, payload, correlation_id)
  values (p_org, v_job.id, 'ocr.processing_started', jsonb_build_object('attemptCount', v_job.attempt_count), p_correlation)
  on conflict do nothing;

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
    'ocr.processing_started',
    'ocr_job',
    v_job.id::text,
    jsonb_build_object('status', v_job.status, 'attemptCount', v_job.attempt_count, 'providerCode', v_job.provider_code),
    p_correlation
  );

  select * into v_doc from public.documents where id = v_job.document_id;
  if v_doc.transport_order_id is not null then
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
      v_doc.transport_order_id,
      'ocr.processing_started',
      p_actor,
      'ocr_job',
      v_job.id,
      jsonb_build_object('jobId', v_job.id, 'status', 'processing', 'providerCode', v_job.provider_code, 'correlationId', p_correlation),
      p_correlation
    );
  end if;

  v_result := jsonb_build_object(
    'jobId', v_job.id,
    'status', v_job.status,
    'attemptCount', v_job.attempt_count,
    'providerRequestId', v_job.provider_request_id,
    'correlationId', p_correlation,
    'idempotencyKey', p_key
  );

  update public.ocr_command_idempotency
  set result = v_result,
      completed_at = statement_timestamp()
  where organization_id = p_org
    and idempotency_key = p_key;

  return v_result;
end;
$$;

create function public.complete_ocr_job_result(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid,
  p_job uuid,
  p_result jsonb,
  p_fields jsonb,
  p_correlation uuid,
  p_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.ocr_jobs%rowtype;
  v_doc public.documents%rowtype;
  v_result_row public.ocr_results%rowtype;
  v_hash text;
  v_request jsonb;
  v_previous public.ocr_command_idempotency%rowtype;
  v_threshold numeric := 0.85;
  v_confidence numeric;
  v_warnings_count integer := 0;
  v_invalid_count integer := 0;
  v_missing_important integer := 0;
  v_requires_review boolean := false;
  v_status public.ocr_job_status;
  v_payload_important jsonb;
  v_field jsonb;
  v_result jsonb;
begin
  if not public.ocr_actor_authorized(p_actor, p_scope, p_org) then
    raise exception using errcode = '42501', message = 'ocr actor not authorized';
  end if;

  if p_job is null or p_result is null or p_fields is null or p_correlation is null or p_key is null then
    raise exception using errcode = '22023', message = 'missing completion context';
  end if;

  if jsonb_typeof(p_result) <> 'object' or jsonb_typeof(p_fields) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid OCR completion payload';
  end if;

  if (p_result - array['providerCode', 'providerModel', 'schemaVersion', 'detectedDocumentType', 'detectedLanguage', 'overallConfidence', 'rawResponse', 'normalizedData', 'warnings']) <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'result payload contains unsupported fields';
  end if;

  if jsonb_typeof(coalesce(p_result->'normalizedData', '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'normalizedData must be an object';
  end if;

  if p_result ? 'warnings' and jsonb_typeof(p_result->'warnings') <> 'array' then
    raise exception using errcode = '22023', message = 'warnings must be an array';
  end if;

  v_request := jsonb_build_object(
    'command', 'complete_ocr_job_result',
    'organization', p_org,
    'job', p_job,
    'result', p_result,
    'fields', p_fields
  );
  v_hash := encode(extensions.digest(convert_to(v_request::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.ocr_command_idempotency (organization_id, idempotency_key, request_hash, actor_user_id)
  values (p_org, p_key, v_hash, p_actor)
  on conflict do nothing;

  select * into v_previous
  from public.ocr_command_idempotency
  where organization_id = p_org
    and idempotency_key = p_key
  for update;

  if v_previous.request_hash <> v_hash then
    raise exception using errcode = '23505', message = 'idempotency key reused with different payload';
  end if;

  if v_previous.result is not null then
    return v_previous.result;
  end if;

  select * into v_job
  from public.ocr_jobs
  where id = p_job
    and organization_id = p_org
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ocr job not found';
  end if;

  if v_job.status not in ('processing', 'needs_review', 'succeeded') then
    raise exception using errcode = '55000', message = 'ocr job is not processing';
  end if;

  if exists(select 1 from public.ocr_results where ocr_job_id = v_job.id) then
    select * into v_result_row from public.ocr_results where ocr_job_id = v_job.id;
  else
    v_confidence := nullif(p_result->>'overallConfidence', '')::numeric;
    if v_confidence is not null and (v_confidence < 0 or v_confidence > 1) then
      raise exception using errcode = '22023', message = 'overall confidence must be between 0 and 1';
    end if;

    insert into public.ocr_results (
      organization_id,
      ocr_job_id,
      document_id,
      document_version_id,
      provider_code,
      provider_model,
      schema_version,
      detected_document_type,
      detected_language,
      overall_confidence,
      raw_response_json,
      normalized_data_json,
      warnings_json
    ) values (
      p_org,
      v_job.id,
      v_job.document_id,
      v_job.document_version_id,
      coalesce(nullif(p_result->>'providerCode', ''), v_job.provider_code),
      nullif(p_result->>'providerModel', ''),
      coalesce(nullif(p_result->>'schemaVersion', ''), coalesce(v_job.payload->>'schemaVersion', '1.0.0')),
      nullif(p_result->>'detectedDocumentType', ''),
      nullif(p_result->>'detectedLanguage', ''),
      v_confidence,
      coalesce(p_result->'rawResponse', '{}'::jsonb),
      coalesce(p_result->'normalizedData', '{}'::jsonb),
      coalesce(p_result->'warnings', '[]'::jsonb)
    ) returning * into v_result_row;

    if jsonb_array_length(p_fields) > 0 then
      for v_field in select value from jsonb_array_elements(p_fields)
      loop
        if jsonb_typeof(v_field) <> 'object' then
          raise exception using errcode = '22023', message = 'field result entry must be an object';
        end if;
        if (v_field - array['fieldCode', 'rawValue', 'normalizedValue', 'confidence', 'pageNumber', 'boundingBox', 'validationStatus', 'warnings']) <> '{}'::jsonb then
          raise exception using errcode = '22023', message = 'field result payload contains unsupported fields';
        end if;
        insert into public.ocr_field_results (
          organization_id,
          ocr_result_id,
          field_code,
          raw_value,
          normalized_value,
          confidence,
          page_number,
          bounding_box_json,
          validation_status,
          warnings_json
        ) values (
          p_org,
          v_result_row.id,
          lower(v_field->>'fieldCode'),
          v_field->'rawValue',
          v_field->'normalizedValue',
          nullif(v_field->>'confidence', '')::numeric,
          nullif(v_field->>'pageNumber', '')::integer,
          v_field->'boundingBox',
          coalesce(nullif(v_field->>'validationStatus', ''), 'extracted')::public.ocr_field_validation_status,
          coalesce(v_field->'warnings', '[]'::jsonb)
        );
      end loop;
    end if;
  end if;

  v_confidence := v_result_row.overall_confidence;
  v_warnings_count := coalesce(jsonb_array_length(v_result_row.warnings_json), 0);

  if jsonb_typeof(v_job.payload->'reviewThreshold') = 'number' then
    v_threshold := greatest(0::numeric, least(1::numeric, (v_job.payload->>'reviewThreshold')::numeric));
  end if;

  select count(*)::integer
  into v_invalid_count
  from public.ocr_field_results
  where ocr_result_id = v_result_row.id
    and validation_status = 'invalid';

  v_payload_important := coalesce(v_job.payload->'importantFields', '[]'::jsonb);
  if jsonb_typeof(v_payload_important) = 'array' and jsonb_array_length(v_payload_important) > 0 then
    select count(*)::integer
    into v_missing_important
    from jsonb_array_elements_text(v_payload_important) f(code)
    where not exists (
      select 1
      from public.ocr_field_results fr
      where fr.ocr_result_id = v_result_row.id
        and fr.field_code = lower(f.code)
        and fr.validation_status not in ('missing', 'not_applicable')
    );
  end if;

  v_requires_review :=
    v_confidence is null
    or v_confidence < v_threshold
    or v_invalid_count > 0
    or v_missing_important > 0
    or v_warnings_count > 0
    or coalesce(v_result_row.detected_document_type, '') = '';

  v_status := case when v_requires_review then 'needs_review' else 'succeeded' end;

  update public.ocr_jobs
  set status = v_status,
      completed_at = statement_timestamp(),
      failed_at = null,
      failure_code = null,
      failure_message = null,
      updated_at = statement_timestamp()
  where id = v_job.id
  returning * into v_job;

  insert into public.ocr_outbox (organization_id, ocr_job_id, ocr_result_id, event_type, payload, correlation_id)
  values (
    p_org,
    v_job.id,
    v_result_row.id,
    case when v_requires_review then 'ocr.review_required' else 'ocr.succeeded' end,
    jsonb_build_object(
      'jobId', v_job.id,
      'resultId', v_result_row.id,
      'confidence', v_result_row.overall_confidence,
      'fieldCount', (select count(*) from public.ocr_field_results where ocr_result_id = v_result_row.id),
      'warningsCount', v_warnings_count
    ),
    p_correlation
  ) on conflict do nothing;

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
    case when v_requires_review then 'ocr.processing_succeeded' else 'ocr.processing_succeeded' end,
    'ocr_job',
    v_job.id::text,
    jsonb_build_object(
      'jobId', v_job.id,
      'documentId', v_job.document_id,
      'documentVersionId', v_job.document_version_id,
      'providerCode', v_result_row.provider_code,
      'status', v_status,
      'confidence', v_result_row.overall_confidence,
      'fieldCount', (select count(*) from public.ocr_field_results where ocr_result_id = v_result_row.id),
      'warningsCount', v_warnings_count,
      'correlationId', p_correlation,
      'idempotencyKey', p_key
    ),
    p_correlation
  );

  select * into v_doc from public.documents where id = v_job.document_id;
  if v_doc.transport_order_id is not null then
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
      v_doc.transport_order_id,
      case when v_requires_review then 'ocr.review_required' else 'ocr.completed' end,
      p_actor,
      'ocr_job',
      v_job.id,
      jsonb_build_object(
        'jobId', v_job.id,
        'documentId', v_job.document_id,
        'documentVersionId', v_job.document_version_id,
        'providerCode', v_result_row.provider_code,
        'status', v_status,
        'confidence', v_result_row.overall_confidence,
        'fieldCount', (select count(*) from public.ocr_field_results where ocr_result_id = v_result_row.id),
        'warningsCount', v_warnings_count,
        'actor', p_actor,
        'correlationId', p_correlation,
        'idempotencyKey', p_key
      ),
      p_correlation
    );
  end if;

  v_result := jsonb_build_object(
    'jobId', v_job.id,
    'resultId', v_result_row.id,
    'status', v_status,
    'confidence', v_result_row.overall_confidence,
    'reviewRequired', v_requires_review,
    'correlationId', p_correlation,
    'idempotencyKey', p_key
  );

  update public.ocr_command_idempotency
  set result = v_result,
      completed_at = statement_timestamp()
  where organization_id = p_org
    and idempotency_key = p_key;

  return v_result;
end;
$$;

create function public.fail_ocr_job(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid,
  p_job uuid,
  p_failure_code text,
  p_failure_message text,
  p_provider_processed boolean,
  p_correlation uuid,
  p_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.ocr_jobs%rowtype;
  v_hash text;
  v_request jsonb;
  v_previous public.ocr_command_idempotency%rowtype;
  v_result jsonb;
  v_doc public.documents%rowtype;
begin
  if not public.ocr_actor_authorized(p_actor, p_scope, p_org) then
    raise exception using errcode = '42501', message = 'ocr actor not authorized';
  end if;

  if p_job is null or p_correlation is null or p_key is null then
    raise exception using errcode = '22023', message = 'missing failure context';
  end if;

  v_request := jsonb_build_object(
    'command', 'fail_ocr_job',
    'organization', p_org,
    'job', p_job,
    'failureCode', coalesce(p_failure_code, ''),
    'failureMessage', coalesce(p_failure_message, ''),
    'providerProcessed', coalesce(p_provider_processed, false)
  );
  v_hash := encode(extensions.digest(convert_to(v_request::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.ocr_command_idempotency (organization_id, idempotency_key, request_hash, actor_user_id)
  values (p_org, p_key, v_hash, p_actor)
  on conflict do nothing;

  select * into v_previous
  from public.ocr_command_idempotency
  where organization_id = p_org
    and idempotency_key = p_key
  for update;

  if v_previous.request_hash <> v_hash then
    raise exception using errcode = '23505', message = 'idempotency key reused with different payload';
  end if;

  if v_previous.result is not null then
    return v_previous.result;
  end if;

  select * into v_job
  from public.ocr_jobs
  where id = p_job
    and organization_id = p_org
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ocr job not found';
  end if;

  if v_job.status in ('succeeded', 'reviewed', 'archived', 'cancelled') then
    raise exception using errcode = '55000', message = 'terminal OCR job cannot fail';
  end if;

  if v_job.quota_reservation_id is not null then
    if coalesce(p_provider_processed, false) = false and v_job.status = 'queued' then
      update public.ocr_quota_reservations
      set status = case when status = 'reserved' then 'released' else status end,
          released_at = case when status = 'reserved' then statement_timestamp() else released_at end,
          reason = coalesce(reason, 'released because provider call did not start'),
          updated_at = statement_timestamp()
      where id = v_job.quota_reservation_id
        and organization_id = p_org;

      insert into public.ocr_outbox (organization_id, ocr_job_id, event_type, payload, correlation_id)
      values (p_org, v_job.id, 'ocr.quota_released', jsonb_build_object('reservationId', v_job.quota_reservation_id), p_correlation)
      on conflict do nothing;

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
        'ocr.quota_released',
        'ocr_quota_reservation',
        v_job.quota_reservation_id::text,
        jsonb_build_object('jobId', v_job.id, 'reason', 'provider not started'),
        p_correlation
      );
    end if;
  end if;

  update public.ocr_jobs
  set status = 'failed',
      failed_at = statement_timestamp(),
      completed_at = null,
      failure_code = left(coalesce(nullif(btrim(p_failure_code), ''), 'provider_error'), 80),
      failure_message = public.ocr_sanitized_message(p_failure_message),
      updated_at = statement_timestamp()
  where id = v_job.id
  returning * into v_job;

  insert into public.ocr_outbox (organization_id, ocr_job_id, event_type, payload, correlation_id)
  values (
    p_org,
    v_job.id,
    'ocr.failed',
    jsonb_build_object(
      'jobId', v_job.id,
      'failureCode', v_job.failure_code,
      'retryable', v_job.attempt_count < v_job.max_attempts
    ),
    p_correlation
  ) on conflict do nothing;

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
    'ocr.processing_failed',
    'ocr_job',
    v_job.id::text,
    jsonb_build_object('jobId', v_job.id, 'failureCode', v_job.failure_code, 'status', v_job.status),
    v_job.failure_message,
    p_correlation
  );

  select * into v_doc from public.documents where id = v_job.document_id;
  if v_doc.transport_order_id is not null then
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
      v_doc.transport_order_id,
      'ocr.failed',
      p_actor,
      'ocr_job',
      v_job.id,
      jsonb_build_object(
        'jobId', v_job.id,
        'documentId', v_job.document_id,
        'documentVersionId', v_job.document_version_id,
        'providerCode', v_job.provider_code,
        'status', v_job.status,
        'failureCode', v_job.failure_code,
        'actor', p_actor,
        'correlationId', p_correlation,
        'idempotencyKey', p_key
      ),
      p_correlation
    );
  end if;

  v_result := jsonb_build_object(
    'jobId', v_job.id,
    'status', v_job.status,
    'failureCode', v_job.failure_code,
    'failureMessage', v_job.failure_message,
    'correlationId', p_correlation,
    'idempotencyKey', p_key
  );

  update public.ocr_command_idempotency
  set result = v_result,
      completed_at = statement_timestamp()
  where organization_id = p_org
    and idempotency_key = p_key;

  return v_result;
end;
$$;

create function public.start_ocr_review(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid,
  p_job uuid,
  p_result uuid,
  p_notes text,
  p_correlation uuid,
  p_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.ocr_jobs%rowtype;
  v_review public.ocr_reviews%rowtype;
  v_hash text;
  v_request jsonb;
  v_previous public.ocr_command_idempotency%rowtype;
  v_result jsonb;
begin
  if not public.ocr_actor_authorized(p_actor, p_scope, p_org) then
    raise exception using errcode = '42501', message = 'ocr actor not authorized';
  end if;

  if p_job is null or p_result is null or p_correlation is null or p_key is null then
    raise exception using errcode = '22023', message = 'missing review context';
  end if;

  v_request := jsonb_build_object(
    'command', 'start_ocr_review',
    'organization', p_org,
    'job', p_job,
    'result', p_result,
    'notes', coalesce(p_notes, '')
  );
  v_hash := encode(extensions.digest(convert_to(v_request::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.ocr_command_idempotency (organization_id, idempotency_key, request_hash, actor_user_id)
  values (p_org, p_key, v_hash, p_actor)
  on conflict do nothing;

  select * into v_previous
  from public.ocr_command_idempotency
  where organization_id = p_org
    and idempotency_key = p_key
  for update;

  if v_previous.request_hash <> v_hash then
    raise exception using errcode = '23505', message = 'idempotency key reused with different payload';
  end if;

  if v_previous.result is not null then
    return v_previous.result;
  end if;

  select * into v_job
  from public.ocr_jobs
  where id = p_job
    and organization_id = p_org
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ocr job not found';
  end if;

  if v_job.status not in ('needs_review', 'succeeded', 'reviewed') then
    raise exception using errcode = '55000', message = 'ocr job is not reviewable';
  end if;

  select * into v_review
  from public.ocr_reviews
  where organization_id = p_org
    and ocr_job_id = p_job
    and status in ('pending', 'in_progress')
  order by created_at desc
  limit 1
  for update;

  if not found then
    insert into public.ocr_reviews (
      organization_id,
      ocr_job_id,
      ocr_result_id,
      status,
      reviewed_by,
      started_at,
      notes
    ) values (
      p_org,
      p_job,
      p_result,
      'in_progress',
      p_actor,
      statement_timestamp(),
      public.ocr_sanitized_message(p_notes)
    )
    returning * into v_review;
  else
    update public.ocr_reviews
    set status = 'in_progress',
        reviewed_by = p_actor,
        notes = coalesce(public.ocr_sanitized_message(p_notes), notes),
        updated_at = statement_timestamp()
    where id = v_review.id
    returning * into v_review;
  end if;

  update public.ocr_jobs
  set status = 'needs_review',
      updated_at = statement_timestamp()
  where id = p_job;

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
    'ocr.review_started',
    'ocr_review',
    v_review.id::text,
    jsonb_build_object('jobId', p_job, 'resultId', p_result, 'status', v_review.status),
    p_correlation
  );

  v_result := jsonb_build_object(
    'reviewId', v_review.id,
    'jobId', p_job,
    'resultId', p_result,
    'status', v_review.status,
    'correlationId', p_correlation,
    'idempotencyKey', p_key
  );

  update public.ocr_command_idempotency
  set result = v_result,
      completed_at = statement_timestamp()
  where organization_id = p_org
    and idempotency_key = p_key;

  return v_result;
end;
$$;

create function public.correct_ocr_field(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid,
  p_review uuid,
  p_field_result uuid,
  p_field_code text,
  p_corrected_value jsonb,
  p_reason text,
  p_correlation uuid,
  p_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_review public.ocr_reviews%rowtype;
  v_field public.ocr_field_results%rowtype;
  v_correction public.ocr_field_corrections%rowtype;
  v_hash text;
  v_request jsonb;
  v_previous public.ocr_command_idempotency%rowtype;
  v_result jsonb;
begin
  if not public.ocr_actor_authorized(p_actor, p_scope, p_org) then
    raise exception using errcode = '42501', message = 'ocr actor not authorized';
  end if;

  if p_review is null or p_correlation is null or p_key is null then
    raise exception using errcode = '22023', message = 'missing correction context';
  end if;

  if nullif(lower(btrim(coalesce(p_field_code, ''))), '') is null then
    raise exception using errcode = '22023', message = 'field code is required';
  end if;

  v_request := jsonb_build_object(
    'command', 'correct_ocr_field',
    'organization', p_org,
    'review', p_review,
    'fieldResult', p_field_result,
    'fieldCode', lower(btrim(p_field_code)),
    'correctedValue', coalesce(p_corrected_value, 'null'::jsonb),
    'reason', coalesce(p_reason, '')
  );
  v_hash := encode(extensions.digest(convert_to(v_request::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.ocr_command_idempotency (organization_id, idempotency_key, request_hash, actor_user_id)
  values (p_org, p_key, v_hash, p_actor)
  on conflict do nothing;

  select * into v_previous
  from public.ocr_command_idempotency
  where organization_id = p_org
    and idempotency_key = p_key
  for update;

  if v_previous.request_hash <> v_hash then
    raise exception using errcode = '23505', message = 'idempotency key reused with different payload';
  end if;

  if v_previous.result is not null then
    return v_previous.result;
  end if;

  select * into v_review
  from public.ocr_reviews
  where id = p_review
    and organization_id = p_org
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ocr review not found';
  end if;

  if v_review.status not in ('pending', 'in_progress') then
    raise exception using errcode = '55000', message = 'ocr review is not editable';
  end if;

  if p_field_result is not null then
    select * into v_field
    from public.ocr_field_results
    where id = p_field_result
      and organization_id = p_org
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'ocr field result not found';
    end if;
  end if;

  insert into public.ocr_field_corrections (
    organization_id,
    ocr_review_id,
    ocr_field_result_id,
    field_code,
    previous_value,
    corrected_value,
    correction_reason,
    corrected_by,
    corrected_at
  ) values (
    p_org,
    p_review,
    p_field_result,
    lower(btrim(p_field_code)),
    case when p_field_result is null then null else v_field.normalized_value end,
    p_corrected_value,
    public.ocr_sanitized_message(p_reason),
    p_actor,
    statement_timestamp()
  ) returning * into v_correction;

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
    'ocr.field_corrected',
    'ocr_field_correction',
    v_correction.id::text,
    jsonb_build_object(
      'reviewId', p_review,
      'fieldCode', v_correction.field_code,
      'fieldResultId', p_field_result,
      'correctedAt', v_correction.corrected_at
    ),
    v_correction.correction_reason,
    p_correlation
  );

  v_result := jsonb_build_object(
    'correctionId', v_correction.id,
    'reviewId', p_review,
    'fieldCode', v_correction.field_code,
    'correlationId', p_correlation,
    'idempotencyKey', p_key
  );

  update public.ocr_command_idempotency
  set result = v_result,
      completed_at = statement_timestamp()
  where organization_id = p_org
    and idempotency_key = p_key;

  return v_result;
end;
$$;

create function public.approve_ocr_review(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid,
  p_review uuid,
  p_notes text,
  p_correlation uuid,
  p_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_review public.ocr_reviews%rowtype;
  v_job public.ocr_jobs%rowtype;
  v_doc public.documents%rowtype;
  v_hash text;
  v_request jsonb;
  v_previous public.ocr_command_idempotency%rowtype;
  v_result jsonb;
begin
  if not public.ocr_actor_authorized(p_actor, p_scope, p_org) then
    raise exception using errcode = '42501', message = 'ocr actor not authorized';
  end if;

  if p_review is null or p_correlation is null or p_key is null then
    raise exception using errcode = '22023', message = 'missing approval context';
  end if;

  v_request := jsonb_build_object(
    'command', 'approve_ocr_review',
    'organization', p_org,
    'review', p_review,
    'notes', coalesce(p_notes, '')
  );
  v_hash := encode(extensions.digest(convert_to(v_request::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.ocr_command_idempotency (organization_id, idempotency_key, request_hash, actor_user_id)
  values (p_org, p_key, v_hash, p_actor)
  on conflict do nothing;

  select * into v_previous
  from public.ocr_command_idempotency
  where organization_id = p_org
    and idempotency_key = p_key
  for update;

  if v_previous.request_hash <> v_hash then
    raise exception using errcode = '23505', message = 'idempotency key reused with different payload';
  end if;

  if v_previous.result is not null then
    return v_previous.result;
  end if;

  select * into v_review
  from public.ocr_reviews
  where id = p_review
    and organization_id = p_org
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ocr review not found';
  end if;

  if v_review.status not in ('pending', 'in_progress') then
    raise exception using errcode = '55000', message = 'ocr review cannot be approved in this state';
  end if;

  update public.ocr_reviews
  set status = 'approved',
      completed_at = statement_timestamp(),
      reviewed_by = p_actor,
      notes = coalesce(public.ocr_sanitized_message(p_notes), notes),
      updated_at = statement_timestamp()
  where id = p_review
  returning * into v_review;

  update public.ocr_jobs
  set status = 'reviewed',
      completed_at = coalesce(completed_at, statement_timestamp()),
      updated_at = statement_timestamp()
  where id = v_review.ocr_job_id
  returning * into v_job;

  insert into public.ocr_outbox (organization_id, ocr_job_id, ocr_result_id, event_type, payload, correlation_id)
  values (
    p_org,
    v_job.id,
    v_review.ocr_result_id,
    'ocr.review_approved',
    jsonb_build_object('reviewId', p_review, 'jobId', v_job.id),
    p_correlation
  ) on conflict do nothing;

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
    'ocr.review_approved',
    'ocr_review',
    p_review::text,
    jsonb_build_object('jobId', v_job.id, 'resultId', v_review.ocr_result_id, 'status', v_review.status),
    public.ocr_sanitized_message(p_notes),
    p_correlation
  );

  select * into v_doc from public.documents where id = v_job.document_id;
  if v_doc.transport_order_id is not null then
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
      v_doc.transport_order_id,
      'ocr.review_approved',
      p_actor,
      'ocr_review',
      v_review.id,
      jsonb_build_object(
        'jobId', v_job.id,
        'documentId', v_job.document_id,
        'documentVersionId', v_job.document_version_id,
        'providerCode', v_job.provider_code,
        'status', v_review.status,
        'actor', p_actor,
        'correlationId', p_correlation,
        'idempotencyKey', p_key
      ),
      p_correlation
    );
  end if;

  v_result := jsonb_build_object(
    'reviewId', p_review,
    'jobId', v_job.id,
    'status', v_review.status,
    'jobStatus', v_job.status,
    'correlationId', p_correlation,
    'idempotencyKey', p_key
  );

  update public.ocr_command_idempotency
  set result = v_result,
      completed_at = statement_timestamp()
  where organization_id = p_org
    and idempotency_key = p_key;

  return v_result;
end;
$$;

create function public.reject_ocr_review(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid,
  p_review uuid,
  p_reason text,
  p_correlation uuid,
  p_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_review public.ocr_reviews%rowtype;
  v_job public.ocr_jobs%rowtype;
  v_doc public.documents%rowtype;
  v_hash text;
  v_request jsonb;
  v_previous public.ocr_command_idempotency%rowtype;
  v_result jsonb;
begin
  if not public.ocr_actor_authorized(p_actor, p_scope, p_org) then
    raise exception using errcode = '42501', message = 'ocr actor not authorized';
  end if;

  if p_review is null or p_correlation is null or p_key is null then
    raise exception using errcode = '22023', message = 'missing rejection context';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception using errcode = '22023', message = 'rejection reason is required';
  end if;

  v_request := jsonb_build_object(
    'command', 'reject_ocr_review',
    'organization', p_org,
    'review', p_review,
    'reason', p_reason
  );
  v_hash := encode(extensions.digest(convert_to(v_request::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.ocr_command_idempotency (organization_id, idempotency_key, request_hash, actor_user_id)
  values (p_org, p_key, v_hash, p_actor)
  on conflict do nothing;

  select * into v_previous
  from public.ocr_command_idempotency
  where organization_id = p_org
    and idempotency_key = p_key
  for update;

  if v_previous.request_hash <> v_hash then
    raise exception using errcode = '23505', message = 'idempotency key reused with different payload';
  end if;

  if v_previous.result is not null then
    return v_previous.result;
  end if;

  select * into v_review
  from public.ocr_reviews
  where id = p_review
    and organization_id = p_org
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ocr review not found';
  end if;

  if v_review.status not in ('pending', 'in_progress') then
    raise exception using errcode = '55000', message = 'ocr review cannot be rejected in this state';
  end if;

  update public.ocr_reviews
  set status = 'rejected',
      completed_at = statement_timestamp(),
      reviewed_by = p_actor,
      notes = coalesce(public.ocr_sanitized_message(p_reason), notes),
      updated_at = statement_timestamp()
  where id = p_review
  returning * into v_review;

  update public.ocr_jobs
  set status = 'reviewed',
      completed_at = coalesce(completed_at, statement_timestamp()),
      updated_at = statement_timestamp()
  where id = v_review.ocr_job_id
  returning * into v_job;

  insert into public.ocr_outbox (organization_id, ocr_job_id, ocr_result_id, event_type, payload, correlation_id)
  values (
    p_org,
    v_job.id,
    v_review.ocr_result_id,
    'ocr.review_rejected',
    jsonb_build_object('reviewId', p_review, 'jobId', v_job.id),
    p_correlation
  ) on conflict do nothing;

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
    'ocr.review_rejected',
    'ocr_review',
    p_review::text,
    jsonb_build_object('jobId', v_job.id, 'resultId', v_review.ocr_result_id, 'status', v_review.status),
    public.ocr_sanitized_message(p_reason),
    p_correlation
  );

  select * into v_doc from public.documents where id = v_job.document_id;
  if v_doc.transport_order_id is not null then
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
      v_doc.transport_order_id,
      'ocr.review_rejected',
      p_actor,
      'ocr_review',
      v_review.id,
      jsonb_build_object(
        'jobId', v_job.id,
        'documentId', v_job.document_id,
        'documentVersionId', v_job.document_version_id,
        'providerCode', v_job.provider_code,
        'status', v_review.status,
        'actor', p_actor,
        'correlationId', p_correlation,
        'idempotencyKey', p_key
      ),
      p_correlation
    );
  end if;

  v_result := jsonb_build_object(
    'reviewId', p_review,
    'jobId', v_job.id,
    'status', v_review.status,
    'jobStatus', v_job.status,
    'correlationId', p_correlation,
    'idempotencyKey', p_key
  );

  update public.ocr_command_idempotency
  set result = v_result,
      completed_at = statement_timestamp()
  where organization_id = p_org
    and idempotency_key = p_key;

  return v_result;
end;
$$;

create function public.archive_ocr_job(
  p_actor uuid,
  p_scope public.audit_actor_scope,
  p_org uuid,
  p_job uuid,
  p_reason text,
  p_correlation uuid,
  p_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.ocr_jobs%rowtype;
  v_hash text;
  v_request jsonb;
  v_previous public.ocr_command_idempotency%rowtype;
  v_result jsonb;
begin
  if not public.ocr_actor_authorized(p_actor, p_scope, p_org) then
    raise exception using errcode = '42501', message = 'ocr actor not authorized';
  end if;

  if p_job is null or p_correlation is null or p_key is null then
    raise exception using errcode = '22023', message = 'missing archive context';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception using errcode = '22023', message = 'archive reason is required';
  end if;

  v_request := jsonb_build_object(
    'command', 'archive_ocr_job',
    'organization', p_org,
    'job', p_job,
    'reason', p_reason
  );
  v_hash := encode(extensions.digest(convert_to(v_request::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.ocr_command_idempotency (organization_id, idempotency_key, request_hash, actor_user_id)
  values (p_org, p_key, v_hash, p_actor)
  on conflict do nothing;

  select * into v_previous
  from public.ocr_command_idempotency
  where organization_id = p_org
    and idempotency_key = p_key
  for update;

  if v_previous.request_hash <> v_hash then
    raise exception using errcode = '23505', message = 'idempotency key reused with different payload';
  end if;

  if v_previous.result is not null then
    return v_previous.result;
  end if;

  select * into v_job
  from public.ocr_jobs
  where id = p_job
    and organization_id = p_org
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ocr job not found';
  end if;

  if v_job.status in ('queued', 'processing') then
    raise exception using errcode = '55000', message = 'active OCR job cannot be archived';
  end if;

  update public.ocr_jobs
  set status = 'archived',
      completed_at = coalesce(completed_at, statement_timestamp()),
      updated_at = statement_timestamp()
  where id = p_job
  returning * into v_job;

  update public.ocr_reviews
  set status = 'archived',
      updated_at = statement_timestamp()
  where organization_id = p_org
    and ocr_job_id = p_job
    and status in ('pending', 'in_progress', 'approved', 'rejected');

  v_result := jsonb_build_object(
    'jobId', p_job,
    'status', v_job.status,
    'correlationId', p_correlation,
    'idempotencyKey', p_key
  );

  update public.ocr_command_idempotency
  set result = v_result,
      completed_at = statement_timestamp()
  where organization_id = p_org
    and idempotency_key = p_key;

  return v_result;
end;
$$;

create function public.reconcile_ocr_jobs(
  p_org uuid,
  p_limit integer default 100
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_stuck jsonb;
  v_expired_reservations jsonb;
  v_outbox_pending jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'jobId', j.id,
    'status', j.status,
    'startedAt', j.started_at,
    'attemptCount', j.attempt_count,
    'maxAttempts', j.max_attempts,
    'correlationId', j.correlation_id
  )), '[]'::jsonb)
  into v_stuck
  from (
    select *
    from public.ocr_jobs
    where organization_id = p_org
      and status = 'processing'
      and started_at < statement_timestamp() - interval '20 minutes'
    order by started_at
    limit v_limit
  ) j;

  select coalesce(jsonb_agg(jsonb_build_object(
    'reservationId', r.id,
    'jobId', r.ocr_job_id,
    'reservedAt', r.reserved_at,
    'status', r.status
  )), '[]'::jsonb)
  into v_expired_reservations
  from (
    select *
    from public.ocr_quota_reservations
    where organization_id = p_org
      and status = 'reserved'
      and reserved_at < statement_timestamp() - interval '30 minutes'
    order by reserved_at
    limit v_limit
  ) r;

  select coalesce(jsonb_agg(jsonb_build_object(
    'outboxId', o.id,
    'eventType', o.event_type,
    'status', o.status,
    'attempts', o.attempts,
    'nextAttemptAt', o.next_attempt_at
  )), '[]'::jsonb)
  into v_outbox_pending
  from (
    select *
    from public.ocr_outbox
    where organization_id = p_org
      and status in ('pending', 'failed')
      and next_attempt_at <= statement_timestamp()
    order by next_attempt_at
    limit v_limit
  ) o;

  return jsonb_build_object(
    'stuckJobs', v_stuck,
    'expiredReservations', v_expired_reservations,
    'outboxPending', v_outbox_pending
  );
end;
$$;

alter table public.ocr_jobs enable row level security;
alter table public.ocr_jobs force row level security;
alter table public.ocr_results enable row level security;
alter table public.ocr_results force row level security;
alter table public.ocr_field_results enable row level security;
alter table public.ocr_field_results force row level security;
alter table public.ocr_reviews enable row level security;
alter table public.ocr_reviews force row level security;
alter table public.ocr_field_corrections enable row level security;
alter table public.ocr_field_corrections force row level security;
alter table public.ocr_quota_reservations enable row level security;
alter table public.ocr_quota_reservations force row level security;
alter table public.ocr_outbox enable row level security;
alter table public.ocr_outbox force row level security;
alter table public.ocr_command_idempotency enable row level security;
alter table public.ocr_command_idempotency force row level security;

create policy ocr_jobs_read
on public.ocr_jobs
for select
to authenticated
using (public.can_access_master_data(organization_id, 'ocr'));

create policy ocr_results_read
on public.ocr_results
for select
to authenticated
using (public.can_access_master_data(organization_id, 'ocr'));

create policy ocr_field_results_read
on public.ocr_field_results
for select
to authenticated
using (public.can_access_master_data(organization_id, 'ocr'));

create policy ocr_reviews_read
on public.ocr_reviews
for select
to authenticated
using (public.can_access_master_data(organization_id, 'ocr'));

create policy ocr_field_corrections_read
on public.ocr_field_corrections
for select
to authenticated
using (public.can_access_master_data(organization_id, 'ocr'));

create policy ocr_quota_reservations_read
on public.ocr_quota_reservations
for select
to authenticated
using (public.can_access_master_data(organization_id, 'ocr'));

revoke all on table public.ocr_jobs, public.ocr_results, public.ocr_field_results, public.ocr_reviews, public.ocr_field_corrections, public.ocr_quota_reservations, public.ocr_outbox, public.ocr_command_idempotency from public, anon, authenticated;
grant select on table public.ocr_jobs, public.ocr_field_results, public.ocr_reviews, public.ocr_field_corrections, public.ocr_quota_reservations to authenticated;
grant select (
  id,
  organization_id,
  ocr_job_id,
  document_id,
  document_version_id,
  provider_code,
  provider_model,
  schema_version,
  detected_document_type,
  detected_language,
  overall_confidence,
  normalized_data_json,
  warnings_json,
  created_at
) on public.ocr_results to authenticated;
grant all on table public.ocr_jobs, public.ocr_results, public.ocr_field_results, public.ocr_reviews, public.ocr_field_corrections, public.ocr_quota_reservations, public.ocr_outbox, public.ocr_command_idempotency to service_role;

revoke all on function public.validate_ocr_tenant(), public.guard_ocr_result_mutation(), public.guard_ocr_field_result_mutation(), public.ocr_actor_authorized(uuid, public.audit_actor_scope, uuid), public.ocr_limit_value_for_organization(uuid, text), public.ocr_sanitized_message(text), public.request_document_ocr(uuid, public.audit_actor_scope, uuid, uuid, uuid, text, jsonb, uuid, uuid), public.mark_ocr_processing_started(uuid, public.audit_actor_scope, uuid, uuid, text, uuid, uuid), public.complete_ocr_job_result(uuid, public.audit_actor_scope, uuid, uuid, jsonb, jsonb, uuid, uuid), public.fail_ocr_job(uuid, public.audit_actor_scope, uuid, uuid, text, text, boolean, uuid, uuid), public.start_ocr_review(uuid, public.audit_actor_scope, uuid, uuid, uuid, text, uuid, uuid), public.correct_ocr_field(uuid, public.audit_actor_scope, uuid, uuid, uuid, text, jsonb, text, uuid, uuid), public.approve_ocr_review(uuid, public.audit_actor_scope, uuid, uuid, text, uuid, uuid), public.reject_ocr_review(uuid, public.audit_actor_scope, uuid, uuid, text, uuid, uuid), public.archive_ocr_job(uuid, public.audit_actor_scope, uuid, uuid, text, uuid, uuid), public.reconcile_ocr_jobs(uuid, integer) from public, anon, authenticated;

grant execute on function public.request_document_ocr(uuid, public.audit_actor_scope, uuid, uuid, uuid, text, jsonb, uuid, uuid), public.mark_ocr_processing_started(uuid, public.audit_actor_scope, uuid, uuid, text, uuid, uuid), public.complete_ocr_job_result(uuid, public.audit_actor_scope, uuid, uuid, jsonb, jsonb, uuid, uuid), public.fail_ocr_job(uuid, public.audit_actor_scope, uuid, uuid, text, text, boolean, uuid, uuid), public.start_ocr_review(uuid, public.audit_actor_scope, uuid, uuid, uuid, text, uuid, uuid), public.correct_ocr_field(uuid, public.audit_actor_scope, uuid, uuid, uuid, text, jsonb, text, uuid, uuid), public.approve_ocr_review(uuid, public.audit_actor_scope, uuid, uuid, text, uuid, uuid), public.reject_ocr_review(uuid, public.audit_actor_scope, uuid, uuid, text, uuid, uuid), public.archive_ocr_job(uuid, public.audit_actor_scope, uuid, uuid, text, uuid, uuid), public.reconcile_ocr_jobs(uuid, integer) to service_role;

grant execute on function public.ocr_actor_authorized(uuid, public.audit_actor_scope, uuid), public.ocr_limit_value_for_organization(uuid, text), public.ocr_sanitized_message(text) to service_role;

comment on table public.ocr_jobs is 'Trabajos OCR por version concreta de documento; idempotentes y auditables.';
comment on table public.ocr_results is 'Resultado OCR original e inmutable. raw_response_json queda reservado para backend.';
comment on table public.ocr_field_results is 'Extraccion de campos con confianza, validacion y metadatos de localizacion visual.';
comment on table public.ocr_reviews is 'Revision humana del resultado OCR con estado explicito.';
comment on table public.ocr_field_corrections is 'Correcciones append-only de campos OCR; nunca sobreescribe historial.';
comment on table public.ocr_quota_reservations is 'Reserva/commit/release de cuota OCR para control mensual concurrente.';
comment on table public.ocr_outbox is 'Outbox OCR para efectos externos, reintentos y reconciliacion.';
comment on table public.ocr_command_idempotency is 'Registro idempotente por tenant para comandos OCR transaccionales.';
comment on function public.request_document_ocr(uuid, public.audit_actor_scope, uuid, uuid, uuid, text, jsonb, uuid, uuid) is 'Reserva cuota y crea job OCR queued en una sola transaccion atomica.';
comment on function public.mark_ocr_processing_started(uuid, public.audit_actor_scope, uuid, uuid, text, uuid, uuid) is 'Marca inicio OCR y compromete cuota al iniciar llamada al proveedor.';
comment on function public.complete_ocr_job_result(uuid, public.audit_actor_scope, uuid, uuid, jsonb, jsonb, uuid, uuid) is 'Persiste resultado OCR inmutable y evalua si requiere revision humana.';
comment on function public.fail_ocr_job(uuid, public.audit_actor_scope, uuid, uuid, text, text, boolean, uuid, uuid) is 'Registra fallo OCR y libera cuota solo cuando el proveedor no llego a procesar.';
comment on function public.reconcile_ocr_jobs(uuid, integer) is 'Devuelve candidatos stuck/pending para operativa local de reconciliacion.';
