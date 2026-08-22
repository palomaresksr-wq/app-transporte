create function public.bootstrap_organization_onboarding()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if exists (
    select 1
    from public.organization_memberships membership
    where membership.user_id = new.user_id
      and membership.organization_id = new.organization_id
      and membership.role = 'admin_empresa'
  ) then
    insert into public.organization_onboarding (organization_id)
    values (new.organization_id)
    on conflict (organization_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger company_user_lifecycle_bootstrap_onboarding
after insert on public.company_user_lifecycle
for each row execute function public.bootstrap_organization_onboarding();

revoke all on function public.bootstrap_organization_onboarding() from public, anon, authenticated;
grant execute on function public.bootstrap_organization_onboarding() to service_role;
