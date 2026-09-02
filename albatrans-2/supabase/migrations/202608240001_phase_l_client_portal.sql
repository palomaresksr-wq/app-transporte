-- Phase L: authenticated customer portal. Additive, tenant-scoped and private by default.
begin;

create type public.client_portal_role as enum ('client_admin','client_viewer');
create type public.client_portal_status as enum ('active','blocked','revoked');
create type public.client_incident_visibility as enum ('internal','client_visible');

insert into public.modules(id,code,name,description,category,route_prefix,sort_order)
values('20000000-0000-4000-8000-000000000015','client_portal','Portal del cliente','Acceso autenticado y aislado para clientes','customer','/client',150);
insert into public.plan_modules(plan_id,module_id,enabled)
select p.id,'20000000-0000-4000-8000-000000000015',p.code in ('professional','enterprise') from public.plans p;

create table public.client_portal_memberships(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 customer_id uuid not null references public.clients(id) on delete restrict,
 user_id uuid not null references public.profiles(user_id) on delete restrict,
 role public.client_portal_role not null default 'client_viewer',
 status public.client_portal_status not null default 'active',
 created_by uuid not null references public.profiles(user_id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 last_access_at timestamptz null, revoked_at timestamptz null,
 unique(user_id),
 constraint client_portal_revoked_consistent check((status='revoked')=(revoked_at is not null))
);
create index client_portal_memberships_customer_idx on public.client_portal_memberships(organization_id,customer_id,status);

create table public.client_portal_visibility_policies(
 organization_id uuid not null references public.organizations(id) on delete restrict,
 customer_id uuid not null references public.clients(id) on delete restrict,
 transport_status boolean not null default true, planned_dates boolean not null default true,
 actual_dates boolean not null default true, goods_summary boolean not null default true,
 incidents boolean not null default false, pod boolean not null default true,
 regulatory_documents boolean not null default true, invoices boolean not null default true,
 signatures boolean not null default false,
 updated_by uuid not null references public.profiles(user_id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(organization_id,customer_id)
);

create table public.client_portal_branding(
 organization_id uuid primary key references public.organizations(id) on delete restrict,
 display_name text not null, logo_document_id uuid null references public.documents(id) on delete restrict,
 support_email text null, support_phone text null,
 updated_by uuid not null references public.profiles(user_id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(btrim(display_name)<>'')
);

alter table public.transport_incidents add column client_visibility public.client_incident_visibility not null default 'internal';
alter table public.documents add column client_visible boolean not null default false;
create index transport_incidents_client_visible_idx on public.transport_incidents(organization_id,transport_order_id,reported_at desc) where client_visibility='client_visible' and archived_at is null;
create index documents_client_visible_idx on public.documents(organization_id,transport_order_id,created_at desc) where client_visible and archived_at is null;

create function public.phase_l_module_enabled(p_org uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select coalesce(case when ov.override_mode='enabled' then true when ov.override_mode='disabled' then false else pm.enabled end,false)
 from public.organization_subscriptions s join public.modules m on m.code='client_portal' and m.status='active'
 join public.plan_modules pm on pm.plan_id=s.plan_id and pm.module_id=m.id
 left join public.organization_module_overrides ov on ov.organization_id=s.organization_id and ov.module_id=m.id
 where s.organization_id=p_org and (s.status in('trial','active') or (s.status='past_due' and s.grace_period_ends_at>statement_timestamp()))
$$;

create function public.client_portal_context_active(p_org uuid,p_customer uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(
  select 1 from public.client_portal_memberships m
  join public.profiles p on p.user_id=m.user_id
  join public.organizations o on o.id=m.organization_id
  join public.clients c on c.id=m.customer_id and c.organization_id=m.organization_id
  where m.user_id=auth.uid() and m.organization_id=p_org and m.customer_id=p_customer
   and m.status='active' and p.status='active' and o.status='active' and c.status='active'
   and public.phase_l_module_enabled(m.organization_id)
 )
$$;

create function public.client_portal_order_access(p_order uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.transport_orders o where o.id=p_order and public.client_portal_context_active(o.organization_id,o.customer_id))
$$;

create function public.client_portal_invoice_access(p_invoice uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.invoices i join public.client_portal_visibility_policies v on v.organization_id=i.organization_id and v.customer_id=i.customer_id
 where i.id=p_invoice and i.status<>'draft' and v.invoices and public.client_portal_context_active(i.organization_id,i.customer_id))
$$;

create function public.client_portal_policy(p_customer uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog,public as $$
 select jsonb_build_object('transport_status',v.transport_status,'planned_dates',v.planned_dates,'actual_dates',v.actual_dates,'goods_summary',v.goods_summary,'incidents',v.incidents,'pod',v.pod,'regulatory_documents',v.regulatory_documents,'invoices',v.invoices,'signatures',v.signatures)
 from public.client_portal_visibility_policies v where v.customer_id=p_customer and public.client_portal_context_active(v.organization_id,v.customer_id)
$$;

create function public.client_portal_touch_access() returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin update public.client_portal_memberships set last_access_at=statement_timestamp() where user_id=auth.uid() and status='active' and (last_access_at is null or last_access_at<statement_timestamp()-interval '15 minutes'); end $$;

create function public.validate_client_portal_tenant() returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare linked uuid; begin select organization_id into linked from public.clients where id=new.customer_id; if linked is distinct from new.organization_id then raise exception using errcode='23514',message='client portal customer tenant mismatch'; end if; return new; end $$;
create trigger client_portal_membership_tenant before insert or update on public.client_portal_memberships for each row execute function public.validate_client_portal_tenant();
create trigger client_portal_policy_tenant before insert or update on public.client_portal_visibility_policies for each row execute function public.validate_client_portal_tenant();
create trigger client_portal_memberships_updated before update on public.client_portal_memberships for each row execute function public.set_updated_at();
create trigger client_portal_policies_updated before update on public.client_portal_visibility_policies for each row execute function public.set_updated_at();
create trigger client_portal_branding_updated before update on public.client_portal_branding for each row execute function public.set_updated_at();

alter table public.client_portal_memberships enable row level security; alter table public.client_portal_memberships force row level security;
alter table public.client_portal_visibility_policies enable row level security; alter table public.client_portal_visibility_policies force row level security;
alter table public.client_portal_branding enable row level security; alter table public.client_portal_branding force row level security;
create policy client_portal_membership_self on public.client_portal_memberships for select to authenticated using(user_id=auth.uid());
create policy client_portal_membership_admin on public.client_portal_memberships for select to authenticated using(public.is_platform_superadmin() or (organization_id=public.current_organization_id() and public.current_organization_role()='admin_empresa'));
create policy client_portal_policy_client on public.client_portal_visibility_policies for select to authenticated using(public.client_portal_context_active(organization_id,customer_id));
create policy client_portal_policy_admin on public.client_portal_visibility_policies for all to authenticated using(public.is_platform_superadmin() or (organization_id=public.current_organization_id() and public.current_organization_role()='admin_empresa')) with check(public.is_platform_superadmin() or (organization_id=public.current_organization_id() and public.current_organization_role()='admin_empresa'));
create policy client_portal_branding_client on public.client_portal_branding for select to authenticated using(exists(select 1 from public.client_portal_memberships m where m.user_id=auth.uid() and m.organization_id=client_portal_branding.organization_id and public.client_portal_context_active(m.organization_id,m.customer_id)));
create policy client_portal_branding_admin on public.client_portal_branding for all to authenticated using(public.is_platform_superadmin() or (organization_id=public.current_organization_id() and public.current_organization_role()='admin_empresa')) with check(public.is_platform_superadmin() or (organization_id=public.current_organization_id() and public.current_organization_role()='admin_empresa'));

-- Shared ERP tables deliberately receive no client policy. External users read only
-- sanitized DTOs from the client-portal Edge Function. This avoids column-level
-- leaks (notes, pricing or hidden dates) that row-level policies cannot mask.

revoke all on public.client_portal_memberships,public.client_portal_visibility_policies,public.client_portal_branding from public,anon,authenticated;
grant select on public.client_portal_memberships,public.client_portal_visibility_policies,public.client_portal_branding to authenticated;
grant insert,update on public.client_portal_visibility_policies,public.client_portal_branding to authenticated;
grant all on public.client_portal_memberships,public.client_portal_visibility_policies,public.client_portal_branding to service_role;
revoke all on function public.phase_l_module_enabled(uuid),public.client_portal_context_active(uuid,uuid),public.client_portal_order_access(uuid),public.client_portal_invoice_access(uuid),public.client_portal_policy(uuid),public.client_portal_touch_access() from public,anon;
grant execute on function public.client_portal_context_active(uuid,uuid),public.client_portal_order_access(uuid),public.client_portal_invoice_access(uuid),public.client_portal_policy(uuid),public.client_portal_touch_access() to authenticated;
grant execute on function public.phase_l_module_enabled(uuid) to service_role;

comment on table public.client_portal_memberships is 'External authenticated identities, explicitly bound to one carrier organization and one customer.';
comment on column public.transport_incidents.client_visibility is 'Explicit opt-in visibility; internal is the secure default.';
commit;
