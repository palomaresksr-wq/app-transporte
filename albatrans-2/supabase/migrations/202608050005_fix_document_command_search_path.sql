-- Fase D: pgcrypto está instalado en extensions; mantener un search_path fijo
-- y explícito para las funciones SECURITY DEFINER que calculan hashes.
alter function public.begin_document_version_upload(uuid,public.audit_actor_scope,uuid,uuid,text,text,bigint,uuid,uuid)
  set search_path=pg_catalog,public,extensions;
alter function public.fail_document_upload(uuid,public.audit_actor_scope,uuid,uuid,uuid,text,uuid,uuid)
  set search_path=pg_catalog,public,extensions;
alter function public.archive_document(uuid,public.audit_actor_scope,uuid,uuid,text,uuid,uuid)
  set search_path=pg_catalog,public,extensions;
alter function public.command_proof_of_delivery(uuid,public.audit_actor_scope,uuid,text,uuid,uuid,uuid,uuid,jsonb,uuid,uuid)
  set search_path=pg_catalog,public,extensions;
alter function public.command_document_signature(uuid,public.audit_actor_scope,uuid,text,uuid,uuid,uuid,jsonb,uuid,uuid)
  set search_path=pg_catalog,public,extensions;
