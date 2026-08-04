-- Endurecimiento aditivo: la auditoría debe ser append-only también para backend.
create function public.prevent_audit_event_mutation() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
begin
  raise exception using errcode='55000',message='audit events are append-only';
end $$;

create trigger audit_events_immutable
before update or delete on public.audit_events
for each row execute function public.prevent_audit_event_mutation();

revoke all on function public.prevent_audit_event_mutation() from public,anon,authenticated;
grant execute on function public.prevent_audit_event_mutation() to service_role;
