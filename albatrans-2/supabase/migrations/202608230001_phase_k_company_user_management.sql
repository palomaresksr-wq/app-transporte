-- Fase K: administración empresarial de usuarios, saga Auth y onboarding.
create type public.company_user_lifecycle_status as enum ('pending','active','blocked','deactivated','compensated','reconciliation_required');
create type public.user_management_command_status as enum ('prepared','completed','compensated','reconciliation_required');

create table public.company_user_lifecycle (
  user_id uuid primary key references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  first_name text not null,
  last_name text not null,
  status public.company_user_lifecycle_status not null default 'pending',
  must_change_password boolean not null default true,
  initial_password_changed_at timestamptz null,
  deactivated_at timestamptz null,
  deactivated_by uuid null references public.profiles(user_id) on delete restrict,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_user_names check(btrim(first_name)<>'' and btrim(last_name)<>''),
  constraint company_user_password_change check(not must_change_password or initial_password_changed_at is null)
);
create index company_user_lifecycle_org_status on public.company_user_lifecycle(organization_id,status,created_at);

create table public.user_management_commands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  idempotency_key uuid not null,
  request_hash text not null check(request_hash~'^[0-9a-f]{64}$'),
  action text not null,
  target_role public.organization_role null,
  target_user_id uuid null references auth.users(id) on delete restrict,
  status public.user_management_command_status not null default 'prepared',
  result jsonb null,
  failure_code text null,
  actor_user_id uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(), completed_at timestamptz null,
  unique(organization_id,idempotency_key)
);
create index user_management_pending_slots on public.user_management_commands(organization_id,target_role,status) where action='create_user' and status='prepared';

create table public.organization_onboarding (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  current_step smallint not null default 1 check(current_step between 1 and 7),
  completed_steps smallint[] not null default '{}',
  configuration jsonb not null default '{}'::jsonb check(jsonb_typeof(configuration)='object'),
  completed_at timestamptz null,
  completed_by uuid null references public.profiles(user_id) on delete restrict,
  updated_at timestamptz not null default now()
);

create function public.phase_k_actor_can_manage(p_actor uuid,p_org uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.profiles p join public.platform_admins a on a.user_id=p.user_id where p.user_id=p_actor and p.status='active' and a.role='superadmin' and a.status='active')
 or exists(select 1 from public.profiles p join public.organization_memberships m on m.user_id=p.user_id join public.organizations o on o.id=m.organization_id where p.user_id=p_actor and p.status='active' and m.organization_id=p_org and m.role='admin_empresa' and m.status='active' and o.status='active')
$$;

create function public.phase_k_effective_limit(p_org uuid,p_code text) returns bigint language sql stable security definer set search_path=pg_catalog,public as $$
 select case when ov.override_mode='custom' then ov.limit_value else pl.limit_value end
 from public.organization_subscriptions s join public.limit_definitions d on d.code=p_code and d.status='active'
 left join public.plan_limits pl on pl.plan_id=s.plan_id and pl.limit_definition_id=d.id
 left join public.organization_limit_overrides ov on ov.organization_id=s.organization_id and ov.limit_definition_id=d.id
 where s.organization_id=p_org
$$;

create function public.prepare_company_user_command(p_actor uuid,p_org uuid,p_role public.organization_role,p_key uuid,p_hash text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.user_management_commands%rowtype; limit_value bigint; used bigint; begin
 if auth.role()<>'service_role' or not public.phase_k_actor_can_manage(p_actor,p_org) then raise exception using errcode='42501',message='actor not authorized'; end if;
 if p_role not in('admin_empresa','conductor') then raise exception using errcode='22023',message='role not allowed'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':'||p_role::text,0));
 select * into c from public.user_management_commands where organization_id=p_org and idempotency_key=p_key;
 if found then if c.request_hash<>p_hash then raise exception using errcode='23505',message='idempotency conflict'; end if; return jsonb_build_object('commandId',c.id,'status',c.status,'result',c.result,'idempotent',true); end if;
 limit_value:=public.phase_k_effective_limit(p_org,case when p_role='conductor' then 'max_drivers' else 'max_admins' end);
 select count(*) into used from public.organization_memberships where organization_id=p_org and role=p_role and status<>'revoked';
 used:=used+(select count(*) from public.user_management_commands where organization_id=p_org and target_role=p_role and action='create_user' and status='prepared');
 if limit_value is null then raise exception using errcode='23514',message='organization limit not configured'; end if;
 if used>=limit_value then raise exception using errcode='23514',message=format('Has alcanzado el límite de %s %s de tu plan.',limit_value,case when p_role='conductor' then 'conductores' else 'administradores' end); end if;
 insert into public.user_management_commands(organization_id,idempotency_key,request_hash,action,target_role,actor_user_id) values(p_org,p_key,p_hash,'create_user',p_role,p_actor) returning * into c;
 return jsonb_build_object('commandId',c.id,'status',c.status,'idempotent',false);
end $$;

create function public.complete_company_user_command(p_actor uuid,p_command uuid,p_user uuid,p_first text,p_last text,p_email text,p_phone text,p_must_change boolean) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.user_management_commands%rowtype; membership uuid; driver_id uuid; output jsonb; begin
 if auth.role()<>'service_role' then raise exception using errcode='42501',message='backend only'; end if;
 select * into c from public.user_management_commands where id=p_command for update; if not found or c.actor_user_id<>p_actor or c.status<>'prepared' then raise exception using errcode='23514',message='command not prepared'; end if;
 if exists(select 1 from public.profiles where user_id=p_user) or exists(select 1 from public.organization_memberships where user_id=p_user) then raise exception using errcode='23505',message='ambiguous existing identity'; end if;
 insert into public.profiles(user_id,display_name,phone,status) values(p_user,btrim(p_first)||' '||btrim(p_last),nullif(btrim(p_phone),''),'active');
 insert into public.organization_memberships(organization_id,user_id,role,status,invited_by,invited_at,joined_at) values(c.organization_id,p_user,c.target_role,'active',p_actor,now(),now()) returning id into membership;
 insert into public.company_user_lifecycle(user_id,organization_id,first_name,last_name,status,must_change_password,created_by) values(p_user,c.organization_id,btrim(p_first),btrim(p_last),'active',p_must_change,p_actor);
 if c.target_role='admin_empresa' then insert into public.organization_onboarding(organization_id) values(c.organization_id) on conflict(organization_id) do nothing; end if;
 if c.target_role='conductor' then insert into public.drivers(organization_id,membership_id,first_name,last_name,display_name,email,phone,employment_status,created_by) values(c.organization_id,membership,btrim(p_first),btrim(p_last),btrim(p_first)||' '||btrim(p_last),lower(p_email),nullif(btrim(p_phone),''),'active',p_actor) returning id into driver_id; end if;
 output:=jsonb_strip_nulls(jsonb_build_object('userId',p_user,'organizationId',c.organization_id,'email',lower(p_email),'role',c.target_role,'status','active','mustChangePassword',p_must_change,'driverId',driver_id));
 update public.user_management_commands set target_user_id=p_user,status='completed',result=output,completed_at=now() where id=c.id;
 insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,after_data,correlation_id) values(c.organization_id,p_actor,case when exists(select 1 from public.platform_admins where user_id=p_actor) then 'platform'::public.audit_actor_scope else 'organization'::public.audit_actor_scope end,'user.created','company_user',p_user::text,output,gen_random_uuid());
 return output;
end $$;

create function public.mark_company_user_command_failure(p_actor uuid,p_command uuid,p_status public.user_management_command_status,p_code text) returns void language plpgsql security definer set search_path=pg_catalog,public as $$ begin
 if auth.role()<>'service_role' or p_status not in('compensated','reconciliation_required') then raise exception using errcode='42501',message='backend only'; end if;
 update public.user_management_commands set status=p_status,failure_code=left(p_code,100),completed_at=now() where id=p_command and actor_user_id=p_actor and status='prepared';
end $$;

alter table public.company_user_lifecycle enable row level security; alter table public.company_user_lifecycle force row level security;
alter table public.user_management_commands enable row level security; alter table public.user_management_commands force row level security;
alter table public.organization_onboarding enable row level security; alter table public.organization_onboarding force row level security;
create policy company_user_lifecycle_read on public.company_user_lifecycle for select to authenticated using(user_id=auth.uid() or public.is_platform_superadmin() or (organization_id=public.current_organization_id() and public.current_organization_role()='admin_empresa'));
create policy organization_onboarding_read on public.organization_onboarding for select to authenticated using(public.is_platform_superadmin() or organization_id=public.current_organization_id());
create policy organization_onboarding_write on public.organization_onboarding for all to authenticated using(organization_id=public.current_organization_id() and public.current_organization_role()='admin_empresa') with check(organization_id=public.current_organization_id() and public.current_organization_role()='admin_empresa');
revoke all on public.company_user_lifecycle,public.user_management_commands,public.organization_onboarding from public,anon,authenticated;
grant select on public.company_user_lifecycle,public.organization_onboarding to authenticated;
grant insert,update on public.organization_onboarding to authenticated;
grant all on public.company_user_lifecycle,public.user_management_commands,public.organization_onboarding to service_role;
revoke all on function public.phase_k_actor_can_manage(uuid,uuid),public.phase_k_effective_limit(uuid,text),public.prepare_company_user_command(uuid,uuid,public.organization_role,uuid,text),public.complete_company_user_command(uuid,uuid,uuid,text,text,text,text,boolean),public.mark_company_user_command_failure(uuid,uuid,public.user_management_command_status,text) from public,anon,authenticated;
grant execute on function public.prepare_company_user_command(uuid,uuid,public.organization_role,uuid,text),public.complete_company_user_command(uuid,uuid,uuid,text,text,text,text,boolean),public.mark_company_user_command_failure(uuid,uuid,public.user_management_command_status,text) to service_role;
