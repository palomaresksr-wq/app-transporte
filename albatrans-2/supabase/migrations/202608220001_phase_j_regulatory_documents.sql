-- Phase J: regulatory transport document core. Additive, forward-only.
create type public.regulatory_document_type as enum ('control_document','ecmr_draft');
create type public.regulatory_document_status as enum ('draft','ready','issued','in_execution','completed','amended','cancelled','archived');

create table public.regulatory_document_counters(
 organization_id uuid not null references public.organizations(id) on delete restrict, document_type public.regulatory_document_type not null,
 year integer not null check(year between 2000 and 9999), last_value bigint not null default 0 check(last_value>=0),
 primary key(organization_id,document_type,year)
);
create table public.regulatory_validation_policies(
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete restrict,
 document_type public.regulatory_document_type not null, schema_version text not null,
 required_paths text[] not null default array['parties.carrier','stops.pickup','stops.delivery','goods'],
 warning_paths text[] not null default array['transport.vehiclePlate','parties.phone'], active boolean not null default true,
 created_by uuid references public.profiles(user_id) on delete restrict, created_at timestamptz not null default now(),
 unique nulls not distinct(organization_id,document_type,schema_version,active)
);
insert into public.regulatory_validation_policies(organization_id,document_type,schema_version)
values(null,'control_document','1.0'),(null,'ecmr_draft','1.0');

create table public.transport_regulatory_documents(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 transport_order_id uuid not null references public.transport_orders(id) on delete restrict, document_id uuid references public.documents(id) on delete restrict,
 document_type public.regulatory_document_type not null, schema_version text not null default '1.0', document_number text,
 status public.regulatory_document_status not null default 'draft', revision_number integer not null default 1 check(revision_number>0),
 effective_at timestamptz, issued_at timestamptz, closed_at timestamptz, cancelled_at timestamptz,
 external_document_id text, external_provider text, external_status text,
 current_snapshot_json jsonb not null check(jsonb_typeof(current_snapshot_json)='object'), content_hash text check(content_hash is null or content_hash~'^[0-9a-f]{64}$'),
 correlation_id uuid not null, idempotency_key uuid not null, created_by uuid not null references public.profiles(user_id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,idempotency_key), unique(organization_id,document_type,document_number),
 constraint regulatory_number_after_issue check(status in('draft','ready') or document_number is not null),
 constraint regulatory_issue_fields check(issued_at is null or content_hash is not null)
);
create unique index regulatory_one_active_type_per_order on public.transport_regulatory_documents(transport_order_id,document_type) where status not in('cancelled','archived');
create index regulatory_documents_order_idx on public.transport_regulatory_documents(transport_order_id,created_at desc);

create table public.transport_regulatory_revisions(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 regulatory_document_id uuid not null references public.transport_regulatory_documents(id) on delete restrict,
 revision_number integer not null check(revision_number>0), snapshot_json jsonb not null check(jsonb_typeof(snapshot_json)='object'),
 content_hash text check(content_hash is null or content_hash~'^[0-9a-f]{64}$'), previous_revision_id uuid references public.transport_regulatory_revisions(id) on delete restrict,
 amendment_reason text, created_by uuid not null references public.profiles(user_id) on delete restrict, created_at timestamptz not null default now(),
 unique(regulatory_document_id,revision_number)
);
create table public.transport_regulatory_evidence(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 regulatory_document_id uuid not null references public.transport_regulatory_documents(id) on delete restrict,
 revision_id uuid not null references public.transport_regulatory_revisions(id) on delete restrict,
 evidence_type text not null check(evidence_type in('signature','pod','photo','timestamp','document','note','incident')),
 document_id uuid references public.documents(id) on delete restrict, document_version_id uuid references public.document_versions(id) on delete restrict,
 signature_id uuid references public.document_signatures(id) on delete restrict, actor_user_id uuid not null references public.profiles(user_id) on delete restrict,
 evidence_json jsonb not null default '{}'::jsonb check(jsonb_typeof(evidence_json)='object'), created_at timestamptz not null default now()
);
create unique index regulatory_evidence_signature_unique on public.transport_regulatory_evidence(signature_id) where signature_id is not null;
create table public.regulatory_document_outbox(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 regulatory_document_id uuid not null references public.transport_regulatory_documents(id) on delete restrict,
 event_type text not null check(event_type in('document.issued','document.signed','document.completed','document.external_sync_required','document.pdf_generated')),
 payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object'), status public.document_outbox_status not null default 'pending',
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(), created_at timestamptz not null default now(), processed_at timestamptz
);
create table public.regulatory_command_idempotency(
 organization_id uuid not null references public.organizations(id) on delete restrict, idempotency_key uuid not null,
 request_hash text not null check(request_hash~'^[0-9a-f]{64}$'), actor_user_id uuid not null references public.profiles(user_id) on delete restrict,
 result jsonb, created_at timestamptz not null default now(), completed_at timestamptz, primary key(organization_id,idempotency_key)
);

create function public.regulatory_document_access(p_order uuid,p_module text default 'electronic_delivery_notes') returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select public.is_platform_superadmin() or exists(select 1 from public.transport_orders o where o.id=p_order and (
  (public.current_organization_role()='admin_empresa' and public.can_access_master_data(o.organization_id,p_module)) or public.driver_has_order_access(o.id,p_module)))
$$;
revoke all on function public.regulatory_document_access(uuid,text) from public,anon; grant execute on function public.regulatory_document_access(uuid,text) to authenticated,service_role;

create function public.build_regulatory_snapshot(p_org uuid,p_order uuid,p_type public.regulatory_document_type,p_schema text default '1.0') returns jsonb
language sql stable security definer set search_path=pg_catalog,public as $$
 select jsonb_build_object(
  'schemaVersion',p_schema,'documentType',p_type,'capturedAt',statement_timestamp(),
  'parties',jsonb_build_array(
   jsonb_build_object('role','carrier','legalName',org.legal_name,'taxId',org.tax_id,'address',null,'contactName',null,'email',org.email,'phone',org.phone),
   jsonb_build_object('role','consignor','legalName',c.legal_name,'taxId',c.tax_id,'address',null,'contactName',null,'email',c.email,'phone',c.phone),
   jsonb_build_object('role','consignee','legalName',c.legal_name,'taxId',c.tax_id,'address',null,'contactName',null,'email',c.email,'phone',c.phone)),
  'transport',jsonb_build_object('orderId',o.id,'reference',o.order_number,'serviceType',o.transport_type,'plannedPickupAt',o.planned_pickup_at,'plannedDeliveryAt',o.planned_delivery_at,'vehiclePlate',v.registration_plate,'trailerPlate',null,'driverName',d.display_name),
  'stops',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'sequence',s.position,'type',s.stop_type,'locationName',l.name,'address',concat_ws(', ',l.address_line_1,l.address_line_2,l.postal_code,l.city,l.country_code),'city',l.city,'plannedAt',s.window_starts_at,'actualAt',case when s.status in('arrived','completed') then s.updated_at end,'contact',null,'instructions',l.instructions,'observations',s.notes) order by s.position) from public.transport_stops s join public.locations l on l.id=s.location_id where s.transport_order_id=o.id),'[]'::jsonb),
  'goods',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'description',i.description,'quantity',null,'unit','line','packages',i.packages,'pallets',i.pallets,'grossWeightKg',i.weight_kg,'volumeM3',i.volume_m3,'reference',i.reference,'marks',null,'observations',i.notes,'specialRequirements',case when i.is_adr or i.temperature_min_c is not null or i.temperature_max_c is not null then jsonb_strip_nulls(jsonb_build_object('schemaVersion','1.0','adr',i.is_adr,'temperatureMinC',i.temperature_min_c,'temperatureMaxC',i.temperature_max_c)) end) order by i.created_at) from public.transport_items i where i.transport_order_id=o.id),'[]'::jsonb),
  'observations',o.notes)
 from public.transport_orders o join public.organizations org on org.id=o.organization_id join public.clients c on c.id=o.customer_id
 left join public.drivers d on d.id=o.assigned_driver_id left join public.vehicles v on v.id=o.assigned_vehicle_id
 where o.id=p_order and o.organization_id=p_org
$$;
revoke all on function public.build_regulatory_snapshot(uuid,uuid,public.regulatory_document_type,text) from public,anon,authenticated; grant execute on function public.build_regulatory_snapshot(uuid,uuid,public.regulatory_document_type,text) to service_role;

create function public.validate_regulatory_snapshot(p_snapshot jsonb) returns jsonb language sql immutable set search_path=pg_catalog,public as $$
 select jsonb_build_object('errors',jsonb_strip_nulls(jsonb_build_array(
  case when not jsonb_path_exists(p_snapshot,'$.parties[*] ? (@.role == "carrier" && @.legalName != null && @.legalName != "")') then jsonb_build_object('code','carrier_missing','path','parties.carrier','message','Falta transportista','severity','error') end,
  case when not jsonb_path_exists(p_snapshot,'$.stops[*] ? (@.type == "pickup")') then jsonb_build_object('code','origin_missing','path','stops','message','Falta origen','severity','error') end,
  case when not jsonb_path_exists(p_snapshot,'$.stops[*] ? (@.type == "delivery")') then jsonb_build_object('code','destination_missing','path','stops','message','Falta destino','severity','error') end,
  case when jsonb_array_length(coalesce(p_snapshot->'goods','[]'::jsonb))=0 then jsonb_build_object('code','goods_missing','path','goods','message','Falta mercancía','severity','error') end)),
  'warnings',case when p_snapshot#>>'{transport,vehiclePlate}' is null then jsonb_build_array(jsonb_build_object('code','vehicle_missing','path','transport.vehiclePlate','message','No consta matrícula','severity','warning')) else '[]'::jsonb end,
  'complete',(jsonb_path_exists(p_snapshot,'$.parties[*] ? (@.role == "carrier" && @.legalName != null && @.legalName != "")') and jsonb_path_exists(p_snapshot,'$.stops[*] ? (@.type == "pickup")') and jsonb_path_exists(p_snapshot,'$.stops[*] ? (@.type == "delivery")') and jsonb_array_length(coalesce(p_snapshot->'goods','[]'::jsonb))>0))
$$;

create function public.regulatory_idempotency_claim(p_org uuid,p_key uuid,p_hash text,p_actor uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v public.regulatory_command_idempotency%rowtype; begin
 insert into public.regulatory_command_idempotency(organization_id,idempotency_key,request_hash,actor_user_id) values(p_org,p_key,p_hash,p_actor) on conflict do nothing;
 select * into v from public.regulatory_command_idempotency where organization_id=p_org and idempotency_key=p_key for update;
 if v.request_hash<>p_hash then raise exception using errcode='23505',message='idempotency key reused with another command'; end if; return v.result;
end $$;
revoke all on function public.regulatory_idempotency_claim(uuid,uuid,text,uuid) from public,anon,authenticated; grant execute on function public.regulatory_idempotency_claim(uuid,uuid,text,uuid) to service_role;

create function public.create_regulatory_document(p_actor uuid,p_scope public.audit_actor_scope,p_org uuid,p_order uuid,p_type public.regulatory_document_type,p_correlation uuid,p_key uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare snap jsonb; d public.transport_regulatory_documents%rowtype; rev uuid; h text; prior jsonb; v_result jsonb; begin
 if auth.role()<>'service_role' or not public.document_actor_authorized(p_actor,p_scope,p_org,'electronic_delivery_notes') then raise exception using errcode='42501',message='actor not authorized'; end if;
 perform 1 from public.transport_orders where id=p_order and organization_id=p_org for update; if not found then raise exception using errcode='P0002',message='transport not found'; end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_object('action','create','order',p_order,'type',p_type)::text,'UTF8'),'sha256'),'hex'); prior:=public.regulatory_idempotency_claim(p_org,p_key,h,p_actor); if prior is not null then return prior; end if;
 snap:=public.build_regulatory_snapshot(p_org,p_order,p_type,'1.0');
 insert into public.transport_regulatory_documents(organization_id,transport_order_id,document_type,current_snapshot_json,correlation_id,idempotency_key,created_by) values(p_org,p_order,p_type,snap,p_correlation,p_key,p_actor) returning * into d;
 insert into public.transport_regulatory_revisions(organization_id,regulatory_document_id,revision_number,snapshot_json,created_by) values(p_org,d.id,1,snap,p_actor) returning id into rev;
 insert into public.transport_events(organization_id,transport_order_id,event_type,actor_user_id,entity_type,entity_id,payload,correlation_id) values(p_org,p_order,'regulatory_document.created',p_actor,'regulatory_document',d.id,jsonb_build_object('documentType',p_type,'revision',1),p_correlation);
 insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,after_data,correlation_id) values(p_org,p_actor,p_scope,'regulatory_document.created','transport_regulatory_document',d.id::text,jsonb_build_object('orderId',p_order,'type',p_type,'revision',1),p_correlation);
 v_result:=jsonb_build_object('documentId',d.id,'revisionId',rev,'status',d.status,'revisionNumber',1); update public.regulatory_command_idempotency set result=v_result,completed_at=statement_timestamp() where organization_id=p_org and idempotency_key=p_key; return v_result;
end $$;

create function public.issue_transport_regulatory_document(p_actor uuid,p_scope public.audit_actor_scope,p_org uuid,p_document uuid,p_correlation uuid,p_key uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare d public.transport_regulatory_documents%rowtype; validation jsonb; n bigint; num text; hash text; req text; prior jsonb; v_result jsonb; begin
 if auth.role()<>'service_role' or not public.document_actor_authorized(p_actor,p_scope,p_org,'electronic_delivery_notes') then raise exception using errcode='42501',message='actor not authorized'; end if;
 select * into d from public.transport_regulatory_documents where id=p_document and organization_id=p_org for update; if not found then raise exception using errcode='P0002',message='document not found'; end if;
 req:=encode(extensions.digest(convert_to(jsonb_build_object('action','issue','document',p_document,'revision',d.revision_number)::text,'UTF8'),'sha256'),'hex'); prior:=public.regulatory_idempotency_claim(p_org,p_key,req,p_actor); if prior is not null then return prior; end if;
 if d.status not in('draft','ready') then raise exception using errcode='23514',message='document cannot be issued from current status'; end if;
 validation:=public.validate_regulatory_snapshot(d.current_snapshot_json); if not coalesce((validation->>'complete')::boolean,false) then
  insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,after_data,correlation_id) values(p_org,p_actor,p_scope,'regulatory_document.validation_failed','transport_regulatory_document',d.id::text,jsonb_build_object('errors',validation->'errors'),p_correlation);
  raise exception using errcode='23514',message='regulatory document validation failed'; end if;
 hash:=encode(extensions.digest(convert_to(d.current_snapshot_json::text,'UTF8'),'sha256'),'hex');
 if d.document_number is null then insert into public.regulatory_document_counters(organization_id,document_type,year,last_value) values(p_org,d.document_type,extract(year from current_date)::integer,1) on conflict(organization_id,document_type,year) do update set last_value=regulatory_document_counters.last_value+1 returning last_value into n; num:='DC-'||extract(year from current_date)::integer||'-'||lpad(n::text,6,'0'); else num:=d.document_number; end if;
 update public.transport_regulatory_documents set document_number=num,status='issued',effective_at=statement_timestamp(),issued_at=statement_timestamp(),content_hash=hash,updated_at=statement_timestamp() where id=d.id returning * into d;
 update public.transport_regulatory_revisions set content_hash=hash where regulatory_document_id=d.id and revision_number=d.revision_number;
 insert into public.transport_events(organization_id,transport_order_id,event_type,actor_user_id,entity_type,entity_id,payload,correlation_id) values(p_org,d.transport_order_id,'regulatory_document.issued',p_actor,'regulatory_document',d.id,jsonb_build_object('number',num,'revision',d.revision_number,'hashPrefix',left(hash,12)),p_correlation);
 insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,after_data,correlation_id) values(p_org,p_actor,p_scope,'regulatory_document.issued','transport_regulatory_document',d.id::text,jsonb_build_object('number',num,'revision',d.revision_number,'hash',hash),p_correlation);
 insert into public.regulatory_document_outbox(organization_id,regulatory_document_id,event_type,payload) values(p_org,d.id,'document.issued',jsonb_build_object('number',num,'revision',d.revision_number));
 v_result:=jsonb_build_object('documentId',d.id,'documentNumber',num,'revisionNumber',d.revision_number,'status',d.status,'contentHash',hash,'validation',validation); update public.regulatory_command_idempotency set result=v_result,completed_at=statement_timestamp() where organization_id=p_org and idempotency_key=p_key; return v_result;
end $$;

create function public.create_regulatory_revision(p_actor uuid,p_scope public.audit_actor_scope,p_org uuid,p_document uuid,p_reason text,p_correlation uuid,p_key uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare d public.transport_regulatory_documents%rowtype; snap jsonb; previous uuid; rev uuid; req text; prior jsonb; v_result jsonb; begin
 if auth.role()<>'service_role' or not public.document_actor_authorized(p_actor,p_scope,p_org,'electronic_delivery_notes') then raise exception using errcode='42501',message='actor not authorized'; end if;
 if p_reason is null or btrim(p_reason)='' then raise exception using errcode='22023',message='revision reason required'; end if;
 select * into d from public.transport_regulatory_documents where id=p_document and organization_id=p_org for update; if d.status not in('issued','in_execution','completed') then raise exception using errcode='23514',message='revision requires an issued document'; end if;
 req:=encode(extensions.digest(convert_to(jsonb_build_object('action','revision','document',p_document,'current',d.revision_number,'reason',btrim(p_reason))::text,'UTF8'),'sha256'),'hex'); prior:=public.regulatory_idempotency_claim(p_org,p_key,req,p_actor); if prior is not null then return prior; end if;
 select id into previous from public.transport_regulatory_revisions where regulatory_document_id=d.id and revision_number=d.revision_number;
 snap:=public.build_regulatory_snapshot(p_org,d.transport_order_id,d.document_type,d.schema_version);
 update public.transport_regulatory_documents set status='draft',revision_number=revision_number+1,current_snapshot_json=snap,content_hash=null,effective_at=null,issued_at=null,closed_at=null,cancelled_at=null,document_id=null,updated_at=statement_timestamp() where id=d.id returning * into d;
 insert into public.transport_regulatory_revisions(organization_id,regulatory_document_id,revision_number,snapshot_json,previous_revision_id,amendment_reason,created_by) values(p_org,d.id,d.revision_number,snap,previous,btrim(p_reason),p_actor) returning id into rev;
 insert into public.transport_events(organization_id,transport_order_id,event_type,actor_user_id,entity_type,entity_id,payload,correlation_id) values(p_org,d.transport_order_id,'regulatory_document.revision_created',p_actor,'regulatory_document',d.id,jsonb_build_object('revision',d.revision_number,'reason',btrim(p_reason)),p_correlation);
 insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,after_data,correlation_id) values(p_org,p_actor,p_scope,'regulatory_document.revision_created','transport_regulatory_document',d.id::text,jsonb_build_object('revision',d.revision_number,'reason',btrim(p_reason),'previousRevisionId',previous),p_correlation);
 v_result:=jsonb_build_object('documentId',d.id,'revisionId',rev,'revisionNumber',d.revision_number,'status',d.status,'requiresNewSignatures',true); update public.regulatory_command_idempotency set result=v_result,completed_at=statement_timestamp() where organization_id=p_org and idempotency_key=p_key; return v_result;
end $$;

create function public.transition_regulatory_document(p_actor uuid,p_scope public.audit_actor_scope,p_org uuid,p_document uuid,p_target public.regulatory_document_status,p_reason text,p_correlation uuid,p_key uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare d public.transport_regulatory_documents%rowtype; allowed boolean; req text; prior jsonb; v_result jsonb; event text; begin
 if auth.role()<>'service_role' or not public.document_actor_authorized(p_actor,p_scope,p_org,'electronic_delivery_notes') then raise exception using errcode='42501',message='actor not authorized'; end if;
 select * into d from public.transport_regulatory_documents where id=p_document and organization_id=p_org for update; if not found then raise exception using errcode='P0002',message='document not found'; end if;
 allowed:=case d.status when 'draft' then p_target in('ready','cancelled') when 'ready' then p_target in('draft','issued','cancelled') when 'issued' then p_target in('in_execution','completed','cancelled') when 'in_execution' then p_target in('completed','cancelled') when 'completed' then p_target='archived' when 'amended' then p_target='archived' when 'cancelled' then p_target='archived' else false end;
 if not allowed or p_target='issued' then raise exception using errcode='23514',message='invalid regulatory transition'; end if;
 req:=encode(extensions.digest(convert_to(jsonb_build_object('action','transition','document',p_document,'from',d.status,'to',p_target,'reason',p_reason)::text,'UTF8'),'sha256'),'hex'); prior:=public.regulatory_idempotency_claim(p_org,p_key,req,p_actor); if prior is not null then return prior; end if;
 if p_target='cancelled' and coalesce(btrim(p_reason),'')='' then raise exception using errcode='22023',message='cancellation reason required'; end if;
 event:=case p_target when 'completed' then 'regulatory_document.completed' when 'cancelled' then 'regulatory_document.cancelled' else 'regulatory_document.'||p_target::text end;
 update public.transport_regulatory_documents set status=p_target,closed_at=case when p_target='completed' then statement_timestamp() else closed_at end,cancelled_at=case when p_target='cancelled' then statement_timestamp() else cancelled_at end,updated_at=statement_timestamp() where id=d.id returning * into d;
 insert into public.transport_events(organization_id,transport_order_id,event_type,actor_user_id,entity_type,entity_id,payload,correlation_id) values(p_org,d.transport_order_id,event,p_actor,'regulatory_document',d.id,jsonb_strip_nulls(jsonb_build_object('status',p_target,'reason',p_reason,'revision',d.revision_number)),p_correlation);
 insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,before_data,after_data,correlation_id) values(p_org,p_actor,p_scope,event,'transport_regulatory_document',d.id::text,jsonb_build_object('status',d.status),jsonb_strip_nulls(jsonb_build_object('status',p_target,'reason',p_reason)),p_correlation);
 if p_target='completed' then insert into public.regulatory_document_outbox(organization_id,regulatory_document_id,event_type,payload) values(p_org,d.id,'document.completed',jsonb_build_object('revision',d.revision_number)); end if;
 v_result:=jsonb_build_object('documentId',d.id,'status',d.status,'revisionNumber',d.revision_number); update public.regulatory_command_idempotency set result=v_result,completed_at=statement_timestamp() where organization_id=p_org and idempotency_key=p_key; return v_result;
end $$;

create function public.guard_regulatory_immutability() returns trigger language plpgsql set search_path=pg_catalog,public as $$ begin
 if tg_table_name='transport_regulatory_revisions' and tg_op='UPDATE' and old.content_hash is null and new.content_hash~'^[0-9a-f]{64}$' and (to_jsonb(new)-'content_hash')=(to_jsonb(old)-'content_hash') then return new; end if;
 raise exception using errcode='55000',message='regulatory history is immutable';
end $$;
create trigger regulatory_revisions_immutable before update or delete on public.transport_regulatory_revisions for each row execute function public.guard_regulatory_immutability();
create trigger regulatory_evidence_immutable before update or delete on public.transport_regulatory_evidence for each row execute function public.guard_regulatory_immutability();
create function public.guard_issued_regulatory_document() returns trigger language plpgsql set search_path=pg_catalog,public as $$ begin
 if old.status not in('draft','ready') and not (new.status='draft' and new.revision_number=old.revision_number+1 and new.document_number is not distinct from old.document_number and new.content_hash is null) and (new.current_snapshot_json is distinct from old.current_snapshot_json or new.document_number is distinct from old.document_number or new.content_hash is distinct from old.content_hash or new.revision_number is distinct from old.revision_number) then raise exception using errcode='55000',message='issued regulatory content is immutable; create revision'; end if; return new; end $$;
create trigger regulatory_document_issued_guard before update on public.transport_regulatory_documents for each row execute function public.guard_issued_regulatory_document();

alter table public.regulatory_document_counters enable row level security; alter table public.regulatory_document_counters force row level security;
alter table public.regulatory_validation_policies enable row level security; alter table public.regulatory_validation_policies force row level security;
alter table public.transport_regulatory_documents enable row level security; alter table public.transport_regulatory_documents force row level security;
alter table public.transport_regulatory_revisions enable row level security; alter table public.transport_regulatory_revisions force row level security;
alter table public.transport_regulatory_evidence enable row level security; alter table public.transport_regulatory_evidence force row level security;
alter table public.regulatory_document_outbox enable row level security; alter table public.regulatory_document_outbox force row level security;
alter table public.regulatory_command_idempotency enable row level security; alter table public.regulatory_command_idempotency force row level security;
create policy regulatory_documents_read on public.transport_regulatory_documents for select to authenticated using(public.regulatory_document_access(transport_order_id));
create policy regulatory_revisions_read on public.transport_regulatory_revisions for select to authenticated using(exists(select 1 from public.transport_regulatory_documents d where d.id=regulatory_document_id and public.regulatory_document_access(d.transport_order_id)));
create policy regulatory_evidence_read on public.transport_regulatory_evidence for select to authenticated using(exists(select 1 from public.transport_regulatory_documents d where d.id=regulatory_document_id and public.regulatory_document_access(d.transport_order_id)));
create policy regulatory_policies_read on public.regulatory_validation_policies for select to authenticated using(organization_id is null or public.can_access_master_data(organization_id,'electronic_delivery_notes') or public.is_platform_superadmin());
revoke all on public.regulatory_document_counters,public.regulatory_validation_policies,public.transport_regulatory_documents,public.transport_regulatory_revisions,public.transport_regulatory_evidence,public.regulatory_document_outbox,public.regulatory_command_idempotency from public,anon,authenticated;
grant select on public.regulatory_validation_policies,public.transport_regulatory_documents,public.transport_regulatory_revisions,public.transport_regulatory_evidence to authenticated;
grant all on public.regulatory_document_counters,public.regulatory_validation_policies,public.transport_regulatory_documents,public.transport_regulatory_revisions,public.transport_regulatory_evidence,public.regulatory_document_outbox,public.regulatory_command_idempotency to service_role;
revoke all on function public.create_regulatory_document(uuid,public.audit_actor_scope,uuid,uuid,public.regulatory_document_type,uuid,uuid),public.issue_transport_regulatory_document(uuid,public.audit_actor_scope,uuid,uuid,uuid,uuid),public.create_regulatory_revision(uuid,public.audit_actor_scope,uuid,uuid,text,uuid,uuid),public.transition_regulatory_document(uuid,public.audit_actor_scope,uuid,uuid,public.regulatory_document_status,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_regulatory_document(uuid,public.audit_actor_scope,uuid,uuid,public.regulatory_document_type,uuid,uuid),public.issue_transport_regulatory_document(uuid,public.audit_actor_scope,uuid,uuid,uuid,uuid),public.create_regulatory_revision(uuid,public.audit_actor_scope,uuid,uuid,text,uuid,uuid),public.transition_regulatory_document(uuid,public.audit_actor_scope,uuid,uuid,public.regulatory_document_status,text,uuid,uuid) to service_role;
