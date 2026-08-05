-- Fase D: el trigger compartido debe inspeccionar columnas específicas sin asumir
-- que todos los registros NEW tienen la misma estructura.
create or replace function public.validate_document_child_tenant() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
declare v_org uuid; v_parent uuid; v_new jsonb:=to_jsonb(new);
begin
 select organization_id into v_org from public.documents where id=(v_new->>'document_id')::uuid;
 if v_org is distinct from new.organization_id then raise exception using errcode='23514',message='document tenant mismatch'; end if;
 if tg_table_name='document_signatures' and nullif(v_new->>'document_version_id','') is not null then
  select document_id into v_parent from public.document_versions where id=(v_new->>'document_version_id')::uuid and organization_id=new.organization_id;
  if v_parent is distinct from (v_new->>'document_id')::uuid then raise exception using errcode='23514',message='signature version mismatch'; end if;
 end if;
 if tg_table_name='proofs_of_delivery' then
  if not exists(select 1 from public.documents d where d.id=(v_new->>'document_id')::uuid and d.transport_order_id=(v_new->>'transport_order_id')::uuid) then raise exception using errcode='23514',message='pod document order mismatch'; end if;
  if nullif(v_new->>'transport_stop_id','') is not null and not exists(select 1 from public.transport_stops s where s.id=(v_new->>'transport_stop_id')::uuid and s.transport_order_id=(v_new->>'transport_order_id')::uuid and s.organization_id=new.organization_id) then raise exception using errcode='23514',message='pod stop mismatch'; end if;
  if exists(select 1 from public.transport_orders where id=(v_new->>'transport_order_id')::uuid and status='archived') then raise exception using errcode='23514',message='pod not allowed on archived order'; end if;
 end if;
 return new;
end $$;

revoke all on function public.validate_document_child_tenant() from public,anon,authenticated;
