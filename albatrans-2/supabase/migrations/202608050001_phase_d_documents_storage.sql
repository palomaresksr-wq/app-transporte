-- Fase D: documentos, POD, firmas, outbox y Storage privado. Aditiva y forward-only.
create type public.document_status as enum ('pending_upload','available','quarantined','archived','failed');
create type public.document_source as enum ('upload','camera','generated','imported','legacy','future_ocr');
create type public.document_version_status as enum ('pending_upload','available','quarantined','failed');
create type public.pod_status as enum ('pending','captured','confirmed','rejected','archived');
create type public.document_signature_type as enum ('drawn','typed','uploaded','future_certificate');
create type public.document_outbox_status as enum ('pending','processing','completed','failed');

insert into public.modules(code,name,description,category,status) values('document_management','Gestión documental','Documentos privados, versiones y ciclo de Storage.','documents','active');
insert into public.plan_modules(plan_id,module_id,enabled) select p.id,m.id,p.code<>'custom' from public.plans p cross join public.modules m where m.code='document_management';

create table public.documents (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 transport_order_id uuid references public.transport_orders(id) on delete restrict, transport_stop_id uuid references public.transport_stops(id) on delete restrict,
 transport_incident_id uuid references public.transport_incidents(id) on delete restrict, client_id uuid references public.clients(id) on delete restrict,
 vehicle_id uuid references public.vehicles(id) on delete restrict, driver_id uuid references public.drivers(id) on delete restrict,
 document_type text not null check(btrim(document_type)<>'' and length(btrim(document_type))<=100), title text not null check(btrim(title)<>'' and length(btrim(title))<=200),
 description text, status public.document_status not null default 'pending_upload', source public.document_source not null,
 current_version_id uuid, created_by uuid not null references public.profiles(user_id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 constraint document_has_relation check(num_nonnulls(transport_order_id,transport_stop_id,transport_incident_id,client_id,vehicle_id,driver_id)>0),
 constraint document_archive_consistent check((status='archived')=(archived_at is not null))
);
create index documents_org_status_idx on public.documents(organization_id,status,created_at desc);
create index documents_order_idx on public.documents(transport_order_id,created_at desc) where transport_order_id is not null;

create table public.document_versions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 document_id uuid not null references public.documents(id) on delete restrict, version_number integer not null check(version_number>0),
 storage_bucket text not null, storage_path text not null unique, original_filename text not null check(btrim(original_filename)<>'' and length(original_filename)<=255),
 mime_type text not null check(mime_type in('image/jpeg','image/png','image/webp','application/pdf')), size_bytes bigint not null check(size_bytes>=0),
 sha256 text check(sha256 is null or sha256~'^[0-9a-f]{64}$'), uploaded_by uuid not null references public.profiles(user_id) on delete restrict,
 uploaded_at timestamptz, metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'), status public.document_version_status not null default 'pending_upload',
 created_at timestamptz not null default now(), unique(document_id,version_number),
 constraint version_available_complete check(status<>'available' or (sha256 is not null and uploaded_at is not null))
);
alter table public.documents add constraint documents_current_version_fk foreign key(current_version_id) references public.document_versions(id) on delete restrict;
create index document_versions_document_idx on public.document_versions(document_id,version_number desc);

create table public.proofs_of_delivery (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 transport_order_id uuid not null references public.transport_orders(id) on delete restrict, transport_stop_id uuid references public.transport_stops(id) on delete restrict,
 document_id uuid not null references public.documents(id) on delete restrict, status public.pod_status not null default 'pending', delivered_at timestamptz,
 recipient_name text, recipient_role text, delivery_notes text, created_by uuid not null references public.profiles(user_id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 constraint pod_archive_consistent check((status='archived')=(archived_at is not null))
);
create unique index pod_active_delivery_idx on public.proofs_of_delivery(transport_order_id,coalesce(transport_stop_id,'00000000-0000-0000-0000-000000000000'::uuid)) where archived_at is null;

create table public.document_signatures (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 document_id uuid not null references public.documents(id) on delete restrict, document_version_id uuid references public.document_versions(id) on delete restrict,
 signature_type public.document_signature_type not null, signer_name text not null check(btrim(signer_name)<>'' and length(btrim(signer_name))<=200), signer_role text,
 signed_at timestamptz not null, signature_data_path text, signature_hash text not null check(signature_hash~'^[0-9a-f]{64}$'), ip_address inet, user_agent text,
 created_by uuid not null references public.profiles(user_id) on delete restrict, created_at timestamptz not null default now(), revoked_at timestamptz, revocation_reason text,
 constraint signature_revocation_consistent check((revoked_at is null)=(revocation_reason is null))
);
create index document_signatures_document_idx on public.document_signatures(document_id,created_at desc);

create table public.document_outbox (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 document_id uuid references public.documents(id) on delete restrict, document_version_id uuid references public.document_versions(id) on delete restrict,
 event_type text not null check(event_type in('storage.upload_requested','storage.upload_confirmed','storage.cleanup_required','storage.orphan_detected','document.available')),
 payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object'), status public.document_outbox_status not null default 'pending',
 attempts integer not null default 0 check(attempts>=0), last_error text, next_attempt_at timestamptz not null default now(), created_at timestamptz not null default now(), processed_at timestamptz,
 correlation_id uuid not null, unique(correlation_id,event_type)
);
create index document_outbox_pending_idx on public.document_outbox(status,next_attempt_at) where status in('pending','failed');

create table public.document_command_idempotency (
 organization_id uuid not null references public.organizations(id) on delete restrict, idempotency_key uuid not null,
 request_hash text not null check(request_hash~'^[0-9a-f]{64}$'), result jsonb check(result is null or jsonb_typeof(result)='object'),
 actor_user_id uuid not null references public.profiles(user_id) on delete restrict, created_at timestamptz not null default now(), completed_at timestamptz,
 primary key(organization_id,idempotency_key)
);

create function public.document_actor_authorized(p_actor uuid,p_scope public.audit_actor_scope,p_org uuid,p_module text) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.profiles where user_id=p_actor and status='active') and (
  (p_scope='platform' and exists(select 1 from public.platform_admins where user_id=p_actor and role='superadmin' and status='active')) or
  (p_scope='organization' and exists(select 1 from public.organizations where id=p_org and status='active') and exists(select 1 from public.organization_memberships where organization_id=p_org and user_id=p_actor and role='admin_empresa' and status='active') and coalesce(
   (select case omo.override_mode when 'enabled' then true when 'disabled' then false else null end from public.organization_module_overrides omo join public.modules m on m.id=omo.module_id where omo.organization_id=p_org and m.code=p_module),
   (select pm.enabled from public.organization_subscriptions os join public.plan_modules pm on pm.plan_id=os.plan_id join public.modules m on m.id=pm.module_id where os.organization_id=p_org and m.code=p_module),false)))
$$;

create function public.validate_document_tenant() returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare v_org uuid; v_doc uuid; begin
 if new.transport_order_id is not null then select organization_id into v_org from public.transport_orders where id=new.transport_order_id; if v_org is distinct from new.organization_id then raise exception using errcode='23514',message='order tenant mismatch'; end if; end if;
 if new.transport_stop_id is not null then select organization_id,transport_order_id into v_org,v_doc from public.transport_stops where id=new.transport_stop_id; if v_org is distinct from new.organization_id or (new.transport_order_id is not null and v_doc is distinct from new.transport_order_id) then raise exception using errcode='23514',message='stop tenant or order mismatch'; end if; end if;
 if new.transport_incident_id is not null then select organization_id,transport_order_id into v_org,v_doc from public.transport_incidents where id=new.transport_incident_id; if v_org is distinct from new.organization_id or (new.transport_order_id is not null and v_doc is distinct from new.transport_order_id) then raise exception using errcode='23514',message='incident tenant or order mismatch'; end if; end if;
 if new.client_id is not null then select organization_id into v_org from public.clients where id=new.client_id; if v_org is distinct from new.organization_id then raise exception using errcode='23514',message='client tenant mismatch'; end if; end if;
 if new.vehicle_id is not null then select organization_id into v_org from public.vehicles where id=new.vehicle_id; if v_org is distinct from new.organization_id then raise exception using errcode='23514',message='vehicle tenant mismatch'; end if; end if;
 if new.driver_id is not null then select organization_id into v_org from public.drivers where id=new.driver_id; if v_org is distinct from new.organization_id then raise exception using errcode='23514',message='driver tenant mismatch'; end if; end if;
 return new; end $$;
create function public.validate_document_child_tenant() returns trigger language plpgsql set search_path=pg_catalog,public as $$ declare v_org uuid; v_parent uuid; begin
 select organization_id into v_org from public.documents where id=new.document_id; if v_org is distinct from new.organization_id then raise exception using errcode='23514',message='document tenant mismatch'; end if;
 if tg_table_name='document_signatures' and new.document_version_id is not null then select document_id into v_parent from public.document_versions where id=new.document_version_id and organization_id=new.organization_id; if v_parent is distinct from new.document_id then raise exception using errcode='23514',message='signature version mismatch'; end if; end if;
 if tg_table_name='proofs_of_delivery' then if not exists(select 1 from public.documents d where d.id=new.document_id and d.transport_order_id=new.transport_order_id) then raise exception using errcode='23514',message='pod document order mismatch'; end if; if new.transport_stop_id is not null and not exists(select 1 from public.transport_stops s where s.id=new.transport_stop_id and s.transport_order_id=new.transport_order_id and s.organization_id=new.organization_id) then raise exception using errcode='23514',message='pod stop mismatch'; end if; if exists(select 1 from public.transport_orders where id=new.transport_order_id and status='archived') then raise exception using errcode='23514',message='pod not allowed on archived order'; end if; end if;
 return new; end $$;
create function public.guard_document_version_mutation() returns trigger language plpgsql set search_path=pg_catalog,public as $$ begin if old.status='available' then raise exception using errcode='55000',message='available document versions are immutable'; end if; return new; end $$;
create function public.guard_signature_mutation() returns trigger language plpgsql set search_path=pg_catalog,public as $$ begin if old.revoked_at is not null or new.id<>old.id or new.organization_id<>old.organization_id or new.document_id<>old.document_id or new.document_version_id is distinct from old.document_version_id or new.signature_type<>old.signature_type or new.signer_name<>old.signer_name or new.signed_at<>old.signed_at or new.signature_hash<>old.signature_hash or new.created_by<>old.created_by then raise exception using errcode='55000',message='signatures are immutable except one revocation'; end if; if new.revoked_at is null or nullif(btrim(new.revocation_reason),'') is null then raise exception using errcode='23514',message='revocation requires reason'; end if; return new; end $$;

create trigger documents_tenant before insert or update on public.documents for each row execute function public.validate_document_tenant();
create trigger documents_updated before update on public.documents for each row execute function public.set_updated_at();
create trigger versions_tenant before insert or update on public.document_versions for each row execute function public.validate_document_child_tenant();
create trigger versions_immutable before update on public.document_versions for each row execute function public.guard_document_version_mutation();
create trigger pod_tenant before insert or update on public.proofs_of_delivery for each row execute function public.validate_document_child_tenant();
create trigger pod_updated before update on public.proofs_of_delivery for each row execute function public.set_updated_at();
create trigger signatures_tenant before insert or update on public.document_signatures for each row execute function public.validate_document_child_tenant();
create trigger signatures_immutable before update on public.document_signatures for each row execute function public.guard_signature_mutation();

alter table public.documents enable row level security; alter table public.documents force row level security;
alter table public.document_versions enable row level security; alter table public.document_versions force row level security;
alter table public.proofs_of_delivery enable row level security; alter table public.proofs_of_delivery force row level security;
alter table public.document_signatures enable row level security; alter table public.document_signatures force row level security;
alter table public.document_outbox enable row level security; alter table public.document_outbox force row level security;
alter table public.document_command_idempotency enable row level security; alter table public.document_command_idempotency force row level security;
create policy documents_read on public.documents for select to authenticated using(public.can_access_master_data(organization_id,'document_management'));
create policy versions_read on public.document_versions for select to authenticated using(public.can_access_master_data(organization_id,'document_management'));
create policy pods_read on public.proofs_of_delivery for select to authenticated using(public.can_access_master_data(organization_id,'pod_signature'));
create policy signatures_read on public.document_signatures for select to authenticated using(public.can_access_master_data(organization_id,'pod_signature'));
revoke all on public.documents,public.document_versions,public.proofs_of_delivery,public.document_signatures,public.document_outbox,public.document_command_idempotency from public,anon,authenticated;
grant select on public.documents,public.document_versions,public.proofs_of_delivery,public.document_signatures to authenticated;
grant all on public.documents,public.document_versions,public.proofs_of_delivery,public.document_signatures,public.document_outbox,public.document_command_idempotency to service_role;
revoke all on function public.document_actor_authorized(uuid,public.audit_actor_scope,uuid,text),public.validate_document_tenant(),public.validate_document_child_tenant(),public.guard_document_version_mutation(),public.guard_signature_mutation() from public;
grant execute on function public.document_actor_authorized(uuid,public.audit_actor_scope,uuid,text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('albatrans-documents','albatrans-documents',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy albatrans_documents_no_direct_select on storage.objects for select to authenticated using(false);
create policy albatrans_documents_no_direct_insert on storage.objects for insert to authenticated with check(false);
create policy albatrans_documents_no_direct_update on storage.objects for update to authenticated using(false) with check(false);
create policy albatrans_documents_no_direct_delete on storage.objects for delete to authenticated using(false);

comment on table public.documents is 'Metadatos documentales multiempresa; nunca contiene binarios ni URLs firmadas.';
comment on table public.document_versions is 'Versiones inmutables reconciliadas con Storage privado.';
comment on table public.document_outbox is 'Outbox de saga Storage, reintentable y reconciliable.';
comment on table public.document_command_idempotency is 'Resultados idempotentes de comandos documentales por organización.';
