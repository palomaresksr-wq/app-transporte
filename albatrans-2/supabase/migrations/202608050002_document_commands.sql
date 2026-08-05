-- Fase D: transacciones PostgreSQL de la saga documental.
create function public.begin_document_upload(
 p_actor uuid,p_scope public.audit_actor_scope,p_org uuid,p_document_type text,p_title text,p_description text,p_source public.document_source,
 p_original_filename text,p_mime_type text,p_size_bytes bigint,p_relations jsonb,p_correlation uuid,p_key uuid
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_request jsonb; v_hash text; v_existing public.document_command_idempotency%rowtype; v_document public.documents%rowtype; v_version public.document_versions%rowtype; v_result jsonb; v_path text;
begin
 if not public.document_actor_authorized(p_actor,p_scope,p_org,'document_management') then raise exception using errcode='42501',message='document actor not authorized'; end if;
 if p_correlation is null or p_key is null or p_relations is null or jsonb_typeof(p_relations)<>'object' then raise exception using errcode='22023',message='invalid upload context'; end if;
 if nullif(btrim(p_document_type),'') is null or length(btrim(p_document_type))>100 or nullif(btrim(p_title),'') is null or length(btrim(p_title))>200 then raise exception using errcode='22023',message='invalid document text'; end if;
 if p_mime_type not in('image/jpeg','image/png','image/webp','application/pdf') or p_size_bytes<0 or p_size_bytes>10485760 then raise exception using errcode='22023',message='invalid file metadata'; end if;
 if not (p_relations ?| array['transportOrderId','transportStopId','transportIncidentId','clientId','vehicleId','driverId']) then raise exception using errcode='22023',message='document relation required'; end if;
 v_request:=jsonb_build_object('actor',p_actor,'scope',p_scope,'org',p_org,'type',p_document_type,'title',p_title,'description',p_description,'source',p_source,'filename',p_original_filename,'mime',p_mime_type,'size',p_size_bytes,'relations',p_relations);
 v_hash:=encode(extensions.digest(convert_to(v_request::text,'UTF8'),'sha256'),'hex');
 insert into public.document_command_idempotency(organization_id,idempotency_key,request_hash,actor_user_id) values(p_org,p_key,v_hash,p_actor) on conflict do nothing;
 select * into v_existing from public.document_command_idempotency where organization_id=p_org and idempotency_key=p_key for update;
 if v_existing.request_hash<>v_hash then raise exception using errcode='23505',message='idempotency key reused with different payload'; end if; if v_existing.result is not null then return v_existing.result; end if;
 insert into public.documents(organization_id,transport_order_id,transport_stop_id,transport_incident_id,client_id,vehicle_id,driver_id,document_type,title,description,source,created_by)
 values(p_org,nullif(p_relations->>'transportOrderId','')::uuid,nullif(p_relations->>'transportStopId','')::uuid,nullif(p_relations->>'transportIncidentId','')::uuid,nullif(p_relations->>'clientId','')::uuid,nullif(p_relations->>'vehicleId','')::uuid,nullif(p_relations->>'driverId','')::uuid,btrim(p_document_type),btrim(p_title),nullif(btrim(p_description),''),p_source,p_actor) returning * into v_document;
 v_version.id:=gen_random_uuid(); v_path:=p_org::text||'/documents/'||v_document.id::text||'/'||v_version.id::text||'/object';
 insert into public.document_versions(id,organization_id,document_id,version_number,storage_bucket,storage_path,original_filename,mime_type,size_bytes,uploaded_by)
 values(v_version.id,p_org,v_document.id,1,'albatrans-documents',v_path,btrim(p_original_filename),p_mime_type,p_size_bytes,p_actor) returning * into v_version;
 insert into public.document_outbox(organization_id,document_id,document_version_id,event_type,payload,correlation_id) values(p_org,v_document.id,v_version.id,'storage.upload_requested',jsonb_build_object('storagePath',v_path),p_correlation);
 insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,after_data,correlation_id) values(p_org,p_actor,p_scope,'document.created','document',v_document.id::text,jsonb_build_object('documentType',v_document.document_type,'status',v_document.status,'idempotencyKey',p_key),p_correlation);
 insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,after_data,correlation_id) values(p_org,p_actor,p_scope,'document.upload_started','document_version',v_version.id::text,jsonb_build_object('mimeType',p_mime_type,'sizeBytes',p_size_bytes,'idempotencyKey',p_key),p_correlation);
 if v_document.transport_order_id is not null then insert into public.transport_events(organization_id,transport_order_id,event_type,actor_user_id,entity_type,entity_id,payload,correlation_id) values(p_org,v_document.transport_order_id,'document.created',p_actor,'document',v_document.id,jsonb_build_object('documentType',v_document.document_type,'title',v_document.title),p_correlation); end if;
 v_result:=jsonb_build_object('documentId',v_document.id,'versionId',v_version.id,'storagePath',v_path,'eventType','document.upload_started','correlationId',p_correlation,'idempotencyKey',p_key);
 update public.document_command_idempotency set result=v_result,completed_at=now() where organization_id=p_org and idempotency_key=p_key; return v_result;
end $$;

create function public.confirm_document_upload(p_actor uuid,p_scope public.audit_actor_scope,p_org uuid,p_document uuid,p_version uuid,p_actual_mime text,p_actual_size bigint,p_sha256 text,p_metadata jsonb,p_correlation uuid,p_key uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_request jsonb;v_hash text;v_existing public.document_command_idempotency%rowtype;v_doc public.documents%rowtype;v_ver public.document_versions%rowtype;v_result jsonb;
begin
 if not public.document_actor_authorized(p_actor,p_scope,p_org,'document_management') then raise exception using errcode='42501',message='document actor not authorized'; end if;
 select * into v_doc from public.documents where id=p_document for update; if not found or v_doc.organization_id<>p_org then raise exception using errcode='P0002',message='document not found'; end if;
 select * into v_ver from public.document_versions where id=p_version for update; if not found or v_ver.document_id<>p_document or v_ver.organization_id<>p_org then raise exception using errcode='P0002',message='version not found'; end if;
 if v_ver.status='available' then null; elsif p_actual_mime<>v_ver.mime_type or p_actual_size<>v_ver.size_bytes or p_actual_mime not in('image/jpeg','image/png','image/webp','application/pdf') or p_actual_size>10485760 or p_sha256!~'^[0-9a-f]{64}$' then raise exception using errcode='23514',message='uploaded object metadata mismatch'; end if;
 v_request:=jsonb_build_object('actor',p_actor,'scope',p_scope,'org',p_org,'document',p_document,'version',p_version,'mime',p_actual_mime,'size',p_actual_size,'sha256',p_sha256,'metadata',coalesce(p_metadata,'{}'));
 v_hash:=encode(extensions.digest(convert_to(v_request::text,'UTF8'),'sha256'),'hex'); insert into public.document_command_idempotency(organization_id,idempotency_key,request_hash,actor_user_id) values(p_org,p_key,v_hash,p_actor) on conflict do nothing;
 select * into v_existing from public.document_command_idempotency where organization_id=p_org and idempotency_key=p_key for update; if v_existing.request_hash<>v_hash then raise exception using errcode='23505',message='idempotency key reused with different payload'; end if; if v_existing.result is not null then return v_existing.result; end if;
 update public.document_versions set status='available',sha256=p_sha256,uploaded_at=statement_timestamp(),metadata=coalesce(p_metadata,'{}') where id=p_version returning * into v_ver;
 update public.documents set status='available',current_version_id=p_version where id=p_document returning * into v_doc;
 update public.document_outbox set status='completed',processed_at=statement_timestamp() where document_version_id=p_version and event_type='storage.upload_requested' and status<>'completed';
 insert into public.document_outbox(organization_id,document_id,document_version_id,event_type,payload,correlation_id) values(p_org,p_document,p_version,'storage.upload_confirmed','{}',p_correlation),(p_org,p_document,p_version,'document.available','{}',p_correlation);
 insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,after_data,correlation_id) values(p_org,p_actor,p_scope,'document.upload_confirmed','document_version',p_version::text,jsonb_build_object('mimeType',p_actual_mime,'sizeBytes',p_actual_size,'sha256',p_sha256,'idempotencyKey',p_key),p_correlation);
 if v_doc.transport_order_id is not null then insert into public.transport_events(organization_id,transport_order_id,event_type,actor_user_id,entity_type,entity_id,payload,correlation_id) values(p_org,v_doc.transport_order_id,'document.upload_confirmed',p_actor,'document',p_document,jsonb_build_object('versionId',p_version,'mimeType',p_actual_mime),p_correlation); end if;
 v_result:=jsonb_build_object('documentId',p_document,'versionId',p_version,'storagePath',v_ver.storage_path,'eventType','document.upload_confirmed','correlationId',p_correlation,'idempotencyKey',p_key);
 update public.document_command_idempotency set result=v_result,completed_at=now() where organization_id=p_org and idempotency_key=p_key;return v_result;
end $$;

revoke all on function public.begin_document_upload(uuid,public.audit_actor_scope,uuid,text,text,text,public.document_source,text,text,bigint,jsonb,uuid,uuid),public.confirm_document_upload(uuid,public.audit_actor_scope,uuid,uuid,uuid,text,bigint,text,jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function public.begin_document_upload(uuid,public.audit_actor_scope,uuid,text,text,text,public.document_source,text,text,bigint,jsonb,uuid,uuid),public.confirm_document_upload(uuid,public.audit_actor_scope,uuid,uuid,uuid,text,bigint,text,jsonb,uuid,uuid) to service_role;
