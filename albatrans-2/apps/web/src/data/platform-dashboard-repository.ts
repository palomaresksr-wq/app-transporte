import type { PlatformDashboardMetrics } from "@albatrans/contracts";
import { validatePlatformDashboardMetrics } from "@albatrans/domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../infrastructure/supabase/client";
import type { Database } from "../infrastructure/supabase/database.types";

export async function loadPlatformDashboardMetrics(
  client: SupabaseClient<Database> = requireSupabase()
): Promise<PlatformDashboardMetrics> {
  const totalOrganizationsQuery = await client
    .from("organizations")
    .select("id", { count: "exact", head: true });
  if (totalOrganizationsQuery.error) {
    throw new Error(
      `No se pudo contar organizations: ${totalOrganizationsQuery.error.message}`
    );
  }

  const activeOrganizationsQuery = await client
    .from("organizations")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  if (activeOrganizationsQuery.error) {
    throw new Error(
      `No se pudieron contar las organizaciones activas: ${activeOrganizationsQuery.error.message}`
    );
  }

  const restrictedOrganizationsQuery = await client
    .from("organizations")
    .select("id", { count: "exact", head: true })
    .in("status", ["blocked", "suspended"]);
  if (restrictedOrganizationsQuery.error) {
    throw new Error(
      `No se pudieron contar las organizaciones restringidas: ${restrictedOrganizationsQuery.error.message}`
    );
  }

  const totalUsersQuery = await client
    .from("profiles")
    .select("user_id", { count: "exact", head: true });
  if (totalUsersQuery.error) {
    throw new Error(
      `No se pudo contar profiles: ${totalUsersQuery.error.message}`
    );
  }

  const organizationAdminsQuery = await client
    .from("organization_memberships")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin_empresa");
  if (organizationAdminsQuery.error) {
    throw new Error(
      `No se pudieron contar los administradores: ${organizationAdminsQuery.error.message}`
    );
  }

  const driversQuery = await client
    .from("organization_memberships")
    .select("id", { count: "exact", head: true })
    .eq("role", "conductor");
  if (driversQuery.error) {
    throw new Error(
      `No se pudieron contar los conductores: ${driversQuery.error.message}`
    );
  }

  return validatePlatformDashboardMetrics({
    totalOrganizations: requireCount(
      totalOrganizationsQuery.count,
      "organizations"
    ),
    activeOrganizations: requireCount(
      activeOrganizationsQuery.count,
      "organizaciones activas"
    ),
    restrictedOrganizations: requireCount(
      restrictedOrganizationsQuery.count,
      "organizaciones restringidas"
    ),
    totalUsers: requireCount(totalUsersQuery.count, "profiles"),
    organizationAdmins: requireCount(
      organizationAdminsQuery.count,
      "administradores"
    ),
    drivers: requireCount(driversQuery.count, "conductores")
  });
}

function requireCount(count: number | null, label: string): number {
  if (count === null) {
    throw new Error(`Supabase no devolvió el total de ${label}.`);
  }
  return count;
}

function requireSupabase(): SupabaseClient<Database> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no está configurado.");
  return client;
}
