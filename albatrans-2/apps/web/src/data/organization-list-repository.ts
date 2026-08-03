import type { OrganizationListFilters, OrganizationListItem, OrganizationListPage } from "@albatrans/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../infrastructure/supabase/client";
import type { Database } from "../infrastructure/supabase/database.types";

export async function loadOrganizations(filters: OrganizationListFilters, client: SupabaseClient<Database> = requireClient()): Promise<OrganizationListPage> {
  let eligibleIds: readonly string[] | null = null;
  if (filters.plan !== "all" || filters.paymentStatus !== "all") {
    let planId: string | null = null;
    if (filters.plan !== "all") {
      const planResult = await client.from("plans").select("id").eq("code", filters.plan).maybeSingle();
      if (planResult.error) throw new Error(`No se pudo aplicar el filtro de plan: ${planResult.error.message}`);
      if (!planResult.data) return emptyPage(filters);
      planId = planResult.data.id;
    }
    let subscriptionQuery = client.from("organization_subscriptions").select("organization_id");
    if (planId) subscriptionQuery = subscriptionQuery.eq("plan_id", planId);
    if (filters.paymentStatus !== "all") subscriptionQuery = subscriptionQuery.eq("payment_status", filters.paymentStatus);
    const subscriptions = await subscriptionQuery;
    if (subscriptions.error) throw new Error(`No se pudieron aplicar los filtros de suscripción: ${subscriptions.error.message}`);
    eligibleIds = subscriptions.data.map((row) => row.organization_id);
    if (eligibleIds.length === 0) return emptyPage(filters);
  }

  let organizationsQuery = client.from("organizations").select("id,legal_name,trade_name,tax_id,status,created_at,updated_at", { count: "exact" });
  const search = filters.search.trim().replace(/[,%_]/g, "");
  if (search) organizationsQuery = organizationsQuery.or(`legal_name.ilike.%${search}%,trade_name.ilike.%${search}%,tax_id.ilike.%${search}%`);
  if (filters.status !== "all") organizationsQuery = organizationsQuery.eq("status", filters.status);
  if (eligibleIds) organizationsQuery = organizationsQuery.in("id", eligibleIds);
  const from = (filters.page - 1) * filters.pageSize;
  const organizations = await organizationsQuery.order("created_at", { ascending: false }).range(from, from + filters.pageSize - 1);
  if (organizations.error) throw new Error(`No se pudieron cargar las empresas: ${organizations.error.message}`);
  if (organizations.count === null) throw new Error("Supabase no devolvió el total de empresas.");
  if (organizations.data.length === 0) return { ...emptyPage(filters), total: organizations.count };

  const ids = organizations.data.map((row) => row.id);
  const [subscriptionResult, membershipResult] = await Promise.all([
    client.from("organization_subscriptions").select("organization_id,payment_status,plans(code,name)").in("organization_id", ids),
    client.from("organization_memberships").select("organization_id,role").in("organization_id", ids).eq("status", "active")
  ]);
  if (subscriptionResult.error) throw new Error(`No se pudieron cargar los planes: ${subscriptionResult.error.message}`);
  if (membershipResult.error) throw new Error(`No se pudieron cargar los usuarios: ${membershipResult.error.message}`);

  const items: OrganizationListItem[] = organizations.data.map((organization) => {
    const subscription = subscriptionResult.data.find((row) => row.organization_id === organization.id);
    const members = membershipResult.data.filter((row) => row.organization_id === organization.id);
    return {
      id: organization.id, legalName: organization.legal_name, tradeName: organization.trade_name, taxId: organization.tax_id,
      status: organization.status, planCode: subscription?.plans?.code ?? null, planName: subscription?.plans?.name ?? null,
      paymentStatus: subscription?.payment_status ?? null,
      activeAdminCount: members.filter((row) => row.role === "admin_empresa").length,
      activeDriverCount: members.filter((row) => row.role === "conductor").length,
      createdAt: organization.created_at, updatedAt: organization.updated_at
    };
  });
  return { items, total: organizations.count, page: filters.page, pageSize: filters.pageSize };
}

function emptyPage(filters: OrganizationListFilters): OrganizationListPage { return { items: [], total: 0, page: filters.page, pageSize: filters.pageSize }; }
function requireClient(): SupabaseClient<Database> { const client = getSupabaseClient(); if (!client) throw new Error("Supabase no está configurado."); return client; }
