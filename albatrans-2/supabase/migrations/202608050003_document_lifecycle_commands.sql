-- Fase D: endurecimiento e invariantes transaccionales del ciclo documental.
create function public.validate_document_current_version() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
begin
  if new.current_version_id is not null and not exists (
    select 1 from public.document_versions v
    where v.id=new.current_version_id and v.document_id=new.id
      and v.organization_id=new.organization_id and v.status='available'
  ) then
    raise exception using errcode='23514',message='current version must be an available version of the same document';
  end if;
  return new;
end $$;

create trigger documents_current_version_valid
before update of current_version_id on public.documents
for each row execute function public.validate_document_current_version();

create function public.begin_document_version_upload(
  p_actor uuid,p_scope public.audit_actor_scope,p_org uuid,p_document uuid,
  p_original_filename text,p_mime_type text,p_size_bytes bigint,
  p_correlation uuid,p_key uuid
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public as $$
declare v_doc public.documents%rowtype; v_version public.document_versions%rowtype;
 v_request jsonb; v_hash text; v_previous public.document_command_idempotency%rowtype;
 v_number integer; v_path text; v_result jsonb;
begin
 if not public.document_actor_authorized(p_actor,p_scope,p_org,'document_management') then raise exception using errcode='42501',message='document actor not authorized'; end if;
 if p_key is null or p_correlation is null or p_mime_type not in('image/jpeg','image/png','image/webp','application/pdf') or p_size_bytes<0 or p_size_bytes>10485760 then raise exception using errcode='22023',message='invalid version upload'; end if;
 select * into v_doc from public.documents where id=p_document and organization_id=p_org for update;
 if not found or v_doc.status='archived' then raise exception using errcode='P0002',message='document not found or archived'; end if;
 v_request:=jsonb_build_object('command','begin_version','documentId',p_document,'filename',p_original_filename,'mimeType',p_mime_type,'sizeBytes',p_size_bytes);
 v_hash:=encode(digest(v_request::text,'sha256'),'hex');
 select * into v_previous from public.document_command_idempotency where organization_id=p_org and idempotency_key=p_key;
 if found then if v_previous.request_hash<>v_hash then raise exception using errcode='23505',message='idempotency key reused with different payload'; end if; return v_previous.result; end if;
 select coalesce(max(version_number),0)+1 into v_number from public.document_versions where document_id=p_document;
 insert into public.document_versions(organization_id,document_id,version_number,storage_bucket,storage_path,original_filename,mime_type,size_bytes,uploaded_by)
 values(p_org,p_document,v_number,'albatrans-documents','pending',btrim(p_original_filename),p_mime_type,p_size_bytes,p_actor) returning * into v_version;
 v_path:=p_org||'/documents/'||p_document||'/'||v_version.id||'/object';
 update public.document_versions set storage_path=v_path where id=v_version.id returning * into v_version;
 insert into public.document_outbox(organization_id,document_id,document_version_id,event_type,payload,correlation_id) values(p_org,p_document,v_version.id,'storage.upload_requested',jsonb_build_object('storagePath',v_path),p_correlation);
 insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,after_data,correlation_id) values(p_org,p_actor,p_scope,'document.version_created','document_version',v_version.id::text,jsonb_build_object('documentId',p_document,'versionNumber',v_number,'idempotencyKey',p_key),p_correlation);
 if v_doc.transport_order_id is not null then insert into public.transport_events(organization_id,transport_order_id,event_type,actor_user_id,entity_type,entity_id,payload,correlation_id) values(p_org,v_doc.transport_order_id,'document.version_created',p_actor,'document',p_document,jsonb_build_object('versionNumber',v_number),p_correlation); end if;
 v_result:=jsonb_build_object('documentId',p_document,'versionId',v_version.id,'versionNumber',v_number,'storageBucket','albatrans-documents','storagePath',v_path,'status','pending_upload');
 insert into public.document_command_idempotency values(p_org,p_key,v_hash,v_result,p_actor,now(),now()); return v_result;
end $$;

create function public.fail_document_upload(p_actor uuid,p_scope public.audit_actor_scope,p_org uuid,p_document uuid,p_version uuid,p_reason text,p_correlation uuid,p_key uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_doc public.documents%rowtype; v_version public.document_versions%rowtype; v_result jsonb; v_hash text; v_old public.document_command_idempotency%rowtype;
begin
 if not public.document_actor_authorized(p_actor,p_scope,p_org,'document_management') then raise exception using errcode='42501',message='document actor not authorized'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception using errcode='22023',message='failure reason required'; end if;
 v_hash:=encode(digest(jsonb_build_object('command','fail','documentId',p_document,'versionId',p_version,'reason',btrim(p_reason))::text,'sha256'),'hex');
 select * into v_old from public.document_command_idempotency where organization_id=p_org and idempotency_key=p_key;
 if found then if v_old.request_hash<>v_hash then raise exception using errcode='23505',message='idempotency conflict'; end if; return v_old.result; end if;
 select * into v_doc from public.documents where id=p_document and organization_id=p_org for update; if not found then raise exception using errcode='P0002',message='document not found'; end if;
 select * into v_version from public.document_versions where id=p_version and document_id=p_document and organization_id=p_org for update; if not found or v_version.status<>'pending_upload' then raise exception using errcode='55000',message='version is not pending'; end if;
 update public.document_versions set status='failed' where id=p_version; update public.documents set status='failed' where id=p_document and current_version_id is null;
 insert into public.document_outbox(organization_id,document_id,document_version_id,event_type,payload,correlation_id) values(p_org,p_document,p_version,'storage.cleanup_required',jsonb_build_object('storagePath',v_version.storage_path,'reason',btrim(p_reason)),p_correlation);
 insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,after_data,reason,correlation_id) values(p_org,p_actor,p_scope,'document.failed','document_version',p_version::text,jsonb_build_object('documentId',p_document),btrim(p_reason),p_correlation);
 v_result:=jsonb_build_object('documentId',p_document,'versionId',p_version,'status','failed'); insert into public.document_command_idempotency values(p_org,p_key,v_hash,v_result,p_actor,now(),now()); return v_result;
end $$;

create function public.archive_document(p_actor uuid,p_scope public.audit_actor_scope,p_org uuid,p_document uuid,p_reason text,p_correlation uuid,p_key uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_doc public.documents%rowtype; v_result jsonb; v_hash text; v_old public.document_command_idempotency%rowtype;
begin
 if not public.document_actor_authorized(p_actor,p_scope,p_org,'document_management') then raise exception using errcode='42501',message='document actor not authorized'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception using errcode='22023',message='archive reason required'; end if;
 v_hash:=encode(digest(jsonb_build_object('command','archive','documentId',p_document,'reason',btrim(p_reason))::text,'sha256'),'hex'); select * into v_old from public.document_command_idempotency where organization_id=p_org and idempotency_key=p_key;
 if found then if v_old.request_hash<>v_hash then raise exception using errcode='23505',message='idempotency conflict'; end if; return v_old.result; end if;
 select * into v_doc from public.documents where id=p_document and organization_id=p_org for update; if not found then raise exception using errcode='P0002',message='document not found'; end if; if v_doc.status='archived' then raise exception using errcode='55000',message='document already archived'; end if;
 update public.documents set status='archived',archived_at=now() where id=p_document;
 insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,before_data,after_data,reason,correlation_id) values(p_org,p_actor,p_scope,'document.archived','document',p_document::text,jsonb_build_object('status',v_doc.status),jsonb_build_object('status','archived'),btrim(p_reason),p_correlation);
 if v_doc.transport_order_id is not null then insert into public.transport_events(organization_id,transport_order_id,event_type,actor_user_id,entity_type,entity_id,payload,correlation_id) values(p_org,v_doc.transport_order_id,'document.archived',p_actor,'document',p_document,'{}',p_correlation); end if;
 v_result:=jsonb_build_object('documentId',p_document,'status','archived'); insert into public.document_command_idempotency values(p_org,p_key,v_hash,v_result,p_actor,now(),now()); return v_result;
end $$;

create function public.command_proof_of_delivery(p_actor uuid,p_scope public.audit_actor_scope,p_org uuid,p_action text,p_pod uuid,p_document uuid,p_order uuid,p_stop uuid,p_values jsonb,p_correlation uuid,p_key uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_pod public.proofs_of_delivery%rowtype; v_doc public.documents%rowtype; v_result jsonb; v_hash text; v_old public.document_command_idempotency%rowtype; v_next public.pod_status;
begin
 if not public.document_actor_authorized(p_actor,p_scope,p_org,'pod_signature') then raise exception using errcode='42501',message='POD actor not authorized'; end if;
 v_hash:=encode(digest(jsonb_build_object('command','pod','action',p_action,'podId',p_pod,'documentId',p_document,'orderId',p_order,'stopId',p_stop,'values',coalesce(p_values,'{}'))::text,'sha256'),'hex'); select * into v_old from public.document_command_idempotency where organization_id=p_org and idempotency_key=p_key; if found then if v_old.request_hash<>v_hash then raise exception using errcode='23505',message='idempotency conflict'; end if; return v_old.result; end if;
 if p_action='create' then
  select * into v_doc from public.documents where id=p_document and organization_id=p_org and transport_order_id=p_order and status='available' for update; if not found then raise exception using errcode='P0002',message='available POD document not found'; end if;
  insert into public.proofs_of_delivery(organization_id,transport_order_id,transport_stop_id,document_id,status,delivered_at,recipient_name,recipient_role,delivery_notes,created_by) values(p_org,p_order,p_stop,p_document,'captured',nullif(p_values->>'deliveredAt','')::timestamptz,nullif(btrim(p_values->>'recipientName'),''),nullif(btrim(p_values->>'recipientRole'),''),nullif(btrim(p_values->>'deliveryNotes'),''),p_actor) returning * into v_pod;
  p_action:='created';
 else
  select * into v_pod from public.proofs_of_delivery where id=p_pod and organization_id=p_org for update; if not found then raise exception using errcode='P0002',message='POD not found'; end if;
  if p_action='confirm' and v_pod.status='captured' then v_next:='confirmed'; elsif p_action='reject' and v_pod.status in('captured','confirmed') then v_next:='rejected'; else raise exception using errcode='55000',message='invalid POD transition'; end if;
  update public.proofs_of_delivery set status=v_next where id=v_pod.id returning * into v_pod;
  p_action:=case when v_next='confirmed' then 'confirmed' else 'rejected' end;
 end if;
 insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,after_data,correlation_id) values(p_org,p_actor,p_scope,'pod.'||p_action,'proof_of_delivery',v_pod.id::text,jsonb_build_object('status',v_pod.status,'documentId',v_pod.document_id),p_correlation);
 insert into public.transport_events(organization_id,transport_order_id,event_type,actor_user_id,entity_type,entity_id,payload,correlation_id) values(p_org,v_pod.transport_order_id,'pod.'||p_action,p_actor,'proof_of_delivery',v_pod.id,jsonb_build_object('status',v_pod.status,'stopId',v_pod.transport_stop_id),p_correlation);
 v_result:=jsonb_build_object('podId',v_pod.id,'documentId',v_pod.document_id,'status',v_pod.status); insert into public.document_command_idempotency values(p_org,p_key,v_hash,v_result,p_actor,now(),now()); return v_result;
end $$;

create function public.command_document_signature(p_actor uuid,p_scope public.audit_actor_scope,p_org uuid,p_action text,p_signature uuid,p_document uuid,p_version uuid,p_values jsonb,p_correlation uuid,p_key uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_sig public.document_signatures%rowtype; v_doc public.documents%rowtype; v_result jsonb; v_hash text; v_old public.document_command_idempotency%rowtype;
begin
 if not public.document_actor_authorized(p_actor,p_scope,p_org,'pod_signature') then raise exception using errcode='42501',message='signature actor not authorized'; end if;
 v_hash:=encode(digest(jsonb_build_object('command','signature','action',p_action,'signatureId',p_signature,'documentId',p_document,'versionId',p_version,'values',coalesce(p_values,'{}'))::text,'sha256'),'hex'); select * into v_old from public.document_command_idempotency where organization_id=p_org and idempotency_key=p_key; if found then if v_old.request_hash<>v_hash then raise exception using errcode='23505',message='idempotency conflict'; end if; return v_old.result; end if;
 if p_action='create' then
  select * into v_doc from public.documents where id=p_document and organization_id=p_org and status='available'; if not found then raise exception using errcode='P0002',message='available document not found'; end if;
  insert into public.document_signatures(organization_id,document_id,document_version_id,signature_type,signer_name,signer_role,signed_at,signature_data_path,signature_hash,ip_address,user_agent,created_by) values(p_org,p_document,p_version,(p_values->>'signatureType')::public.document_signature_type,btrim(p_values->>'signerName'),nullif(btrim(p_values->>'signerRole'),''),coalesce(nullif(p_values->>'signedAt','')::timestamptz,now()),nullif(p_values->>'signatureDataPath',''),p_values->>'signatureHash',nullif(p_values->>'ipAddress','')::inet,nullif(p_values->>'userAgent',''),p_actor) returning * into v_sig; p_action:='created';
 elsif p_action='revoke' then
  select * into v_sig from public.document_signatures where id=p_signature and organization_id=p_org for update; if not found then raise exception using errcode='P0002',message='signature not found'; end if;
  update public.document_signatures set revoked_at=now(),revocation_reason=nullif(btrim(p_values->>'reason'),'') where id=v_sig.id returning * into v_sig; p_action:='revoked';
 else raise exception using errcode='22023',message='invalid signature action'; end if;
 insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,after_data,correlation_id) values(p_org,p_actor,p_scope,'signature.'||p_action,'document_signature',v_sig.id::text,jsonb_build_object('documentId',v_sig.document_id,'signatureType',v_sig.signature_type,'revokedAt',v_sig.revoked_at),p_correlation);
 select * into v_doc from public.documents where id=v_sig.document_id; if v_doc.transport_order_id is not null then insert into public.transport_events(organization_id,transport_order_id,event_type,actor_user_id,entity_type,entity_id,payload,correlation_id) values(p_org,v_doc.transport_order_id,'signature.'||p_action,p_actor,'document_signature',v_sig.id,jsonb_build_object('documentId',v_sig.document_id),p_correlation); end if;
 v_result:=jsonb_build_object('signatureId',v_sig.id,'documentId',v_sig.document_id,'revokedAt',v_sig.revoked_at); insert into public.document_command_idempotency values(p_org,p_key,v_hash,v_result,p_actor,now(),now()); return v_result;
end $$;

revoke all on function public.validate_document_current_version(),public.begin_document_version_upload(uuid,public.audit_actor_scope,uuid,uuid,text,text,bigint,uuid,uuid),public.fail_document_upload(uuid,public.audit_actor_scope,uuid,uuid,uuid,text,uuid,uuid),public.archive_document(uuid,public.audit_actor_scope,uuid,uuid,text,uuid,uuid),public.command_proof_of_delivery(uuid,public.audit_actor_scope,uuid,text,uuid,uuid,uuid,uuid,jsonb,uuid,uuid),public.command_document_signature(uuid,public.audit_actor_scope,uuid,text,uuid,uuid,uuid,jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function public.begin_document_version_upload(uuid,public.audit_actor_scope,uuid,uuid,text,text,bigint,uuid,uuid),public.fail_document_upload(uuid,public.audit_actor_scope,uuid,uuid,uuid,text,uuid,uuid),public.archive_document(uuid,public.audit_actor_scope,uuid,uuid,text,uuid,uuid),public.command_proof_of_delivery(uuid,public.audit_actor_scope,uuid,text,uuid,uuid,uuid,uuid,jsonb,uuid,uuid),public.command_document_signature(uuid,public.audit_actor_scope,uuid,text,uuid,uuid,uuid,jsonb,uuid,uuid) to service_role;

comment on function public.begin_document_version_upload(uuid,public.audit_actor_scope,uuid,uuid,text,text,bigint,uuid,uuid) is 'Creates a new immutable pending document version under a row lock.';
