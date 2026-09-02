-- Phase L: idempotent backend-only provisioning for external client identities.
begin;
create table public.client_portal_commands(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 customer_id uuid not null references public.clients(id) on delete restrict, idempotency_key uuid not null,
 request_hash text not null check(request_hash~'^[0-9a-f]{64}$'), action text not null,
 target_user_id uuid null references auth.users(id) on delete restrict, status public.user_management_command_status not null default 'prepared',
 result jsonb null, actor_user_id uuid not null references public.profiles(user_id) on delete restrict,
 created_at timestamptz not null default now(), completed_at timestamptz null, unique(organization_id,idempotency_key)
);
create function public.prepare_client_portal_user(p_actor uuid,p_org uuid,p_customer uuid,p_key uuid,p_hash text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.client_portal_commands%rowtype; begin
 if auth.role()<>'service_role' or not public.phase_k_actor_can_manage(p_actor,p_org) then raise exception using errcode='42501',message='actor not authorized'; end if;
 if not exists(select 1 from public.clients where id=p_customer and organization_id=p_org and status='active') or not public.phase_l_module_enabled(p_org) then raise exception using errcode='42501',message='customer portal unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':'||p_customer::text,0));
 select * into c from public.client_portal_commands where organization_id=p_org and idempotency_key=p_key;
 if found then if c.request_hash<>p_hash then raise exception using errcode='23505',message='idempotency conflict'; end if; return jsonb_build_object('commandId',c.id,'status',c.status,'result',c.result,'idempotent',true); end if;
 insert into public.client_portal_commands(organization_id,customer_id,idempotency_key,request_hash,action,actor_user_id) values(p_org,p_customer,p_key,p_hash,'create_user',p_actor) returning * into c;
 return jsonb_build_object('commandId',c.id,'status',c.status,'idempotent',false);
end $$;
create function public.complete_client_portal_user(p_actor uuid,p_command uuid,p_user uuid,p_role public.client_portal_role,p_first text,p_last text,p_phone text,p_must_change boolean) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.client_portal_commands%rowtype; output jsonb; begin
 if auth.role()<>'service_role' then raise exception using errcode='42501',message='backend only'; end if;
 select * into c from public.client_portal_commands where id=p_command for update; if not found or c.actor_user_id<>p_actor or c.status<>'prepared' then raise exception using errcode='23514',message='command not prepared'; end if;
 if exists(select 1 from public.profiles where user_id=p_user) then raise exception using errcode='23505',message='ambiguous existing identity'; end if;
 insert into public.profiles(user_id,display_name,phone,status) values(p_user,btrim(p_first)||' '||btrim(p_last),nullif(btrim(p_phone),''),'active');
 insert into public.company_user_lifecycle(user_id,organization_id,first_name,last_name,status,must_change_password,created_by) values(p_user,c.organization_id,btrim(p_first),btrim(p_last),'active',p_must_change,p_actor);
 insert into public.client_portal_memberships(organization_id,customer_id,user_id,role,status,created_by) values(c.organization_id,c.customer_id,p_user,p_role,'active',p_actor);
 insert into public.client_portal_visibility_policies(organization_id,customer_id,updated_by) values(c.organization_id,c.customer_id,p_actor) on conflict do nothing;
 output:=jsonb_build_object('userId',p_user,'organizationId',c.organization_id,'customerId',c.customer_id,'role',p_role,'status','active','mustChangePassword',p_must_change);
 update public.client_portal_commands set target_user_id=p_user,status='completed',result=output,completed_at=now() where id=c.id;
 insert into public.audit_events(organization_id,actor_user_id,actor_scope,action,entity_type,entity_id,after_data,correlation_id) values(c.organization_id,p_actor,'organization','client_portal.user_created','client_portal_user',p_user::text,output,gen_random_uuid()); return output;
end $$;
alter table public.client_portal_commands enable row level security; alter table public.client_portal_commands force row level security;
revoke all on public.client_portal_commands from public,anon,authenticated; grant all on public.client_portal_commands to service_role;
revoke all on function public.prepare_client_portal_user(uuid,uuid,uuid,uuid,text),public.complete_client_portal_user(uuid,uuid,uuid,public.client_portal_role,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.prepare_client_portal_user(uuid,uuid,uuid,uuid,text),public.complete_client_portal_user(uuid,uuid,uuid,public.client_portal_role,text,text,text,boolean) to service_role;
commit;
