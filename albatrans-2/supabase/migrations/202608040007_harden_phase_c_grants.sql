-- Corrección aditiva detectada por la suite completa de instalación limpia.
revoke all on table public.transport_waiting_times from public,anon;
grant select on table public.transport_waiting_times to authenticated,service_role;
update public.plan_modules pm set enabled=false
from public.plans p,public.modules m
where pm.plan_id=p.id and pm.module_id=m.id and p.code='custom' and m.code='transport_execution';
