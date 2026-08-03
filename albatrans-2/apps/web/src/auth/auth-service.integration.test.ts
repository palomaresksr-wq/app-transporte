import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AccessDeniedError,
  loadAccessContext
} from "./auth-service";
import type { Database } from "../infrastructure/supabase/database.types";
import { loadPlatformDashboardMetrics } from "../data/platform-dashboard-repository";

type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
type MembershipInsert =
  Database["public"]["Tables"]["organization_memberships"]["Insert"];
type OrganizationInsert =
  Database["public"]["Tables"]["organizations"]["Insert"];

const url = import.meta.env.ALBATRANS_TEST_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.ALBATRANS_TEST_ANON_KEY as string | undefined;
const serviceRoleKey = import.meta.env
  .ALBATRANS_TEST_SERVICE_ROLE_KEY as string | undefined;
const integrationEnabled = Boolean(url && anonKey && serviceRoleKey);

const PASSWORD = "Albatrans-local-test-2026!";
const LOCAL_SUPERADMIN_EMAIL = "superadmin@albatrans.local";
const LOCAL_SUPERADMIN_PASSWORD = "AlbatransLocal2026!";
const runId = crypto.randomUUID();

type FixtureName =
  | "superadmin"
  | "admin"
  | "conductor"
  | "sin_membership"
  | "perfil_bloqueado"
  | "membership_bloqueada"
  | "membership_suspendida"
  | "empresa_bloqueada"
  | "empresa_suspendida"
  | "empresa_mantenimiento"
  | "empresa_archivada";

const temporaryNames: Exclude<FixtureName, "superadmin">[] = [
  "admin",
  "conductor",
  "sin_membership",
  "perfil_bloqueado",
  "membership_bloqueada",
  "membership_suspendida",
  "empresa_bloqueada",
  "empresa_suspendida",
  "empresa_mantenimiento",
  "empresa_archivada"
];

interface Fixture {
  id: string;
  email: string;
  organizationId?: string;
}

describe.skipIf(!integrationEnabled)("autenticación contra Supabase local", () => {
  let admin: SupabaseClient<Database>;
  let baselineMetrics: Awaited<ReturnType<typeof loadPlatformDashboardMetrics>>;
  const fixtures = new Map<FixtureName, Fixture>();

  beforeAll(async () => {
    admin = createClient<Database>(url!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    baselineMetrics = await loadPlatformDashboardMetrics(admin);

    const platformAdminResult = await admin
      .from("platform_admins")
      .select("user_id")
      .eq("role", "superadmin")
      .eq("status", "active")
      .single();
    if (platformAdminResult.error || !platformAdminResult.data) {
      throw platformAdminResult.error ?? new Error("No existe el superadmin local activo.");
    }
    const localUserResult = await admin.auth.admin.getUserById(
      platformAdminResult.data.user_id
    );
    if (localUserResult.error || !localUserResult.data.user) {
      throw localUserResult.error ?? new Error("No existe el usuario del superadmin local.");
    }
    if (localUserResult.data.user.email !== LOCAL_SUPERADMIN_EMAIL) {
      throw new Error("El singleton activo no corresponde al superadmin local preparado.");
    }
    fixtures.set("superadmin", {
      id: localUserResult.data.user.id,
      email: LOCAL_SUPERADMIN_EMAIL
    });

    for (const name of temporaryNames) {
      const email = `auth-${name}-${runId}@albatrans.local`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true
      });
      if (error || !data.user) throw error ?? new Error(`No se creó ${name}.`);
      fixtures.set(name, { id: data.user.id, email });
    }

    const profileRows: ProfileInsert[] = temporaryNames.map(
      (name): ProfileInsert => ({
        user_id: fixture(name).id,
        display_name: `Prueba ${name}`,
        status: name === "perfil_bloqueado" ? "blocked" : "active"
      })
    );
    assertNoError(await admin.from("profiles").insert(profileRows));

    const organizationFixtures = temporaryNames.filter(
      (name) =>
        !["sin_membership", "perfil_bloqueado"].includes(name)
    );
    for (const name of organizationFixtures) {
      const status =
        name === "empresa_bloqueada"
          ? "blocked"
          : name === "empresa_suspendida"
            ? "suspended"
            : name === "empresa_mantenimiento"
              ? "maintenance"
              : name === "empresa_archivada"
                ? "archived"
                : "active";
      const organizationRow: OrganizationInsert = {
        legal_name: `Empresa ${name} ${runId}`,
        status,
        status_reason:
          status === "blocked" || status === "suspended"
            ? "Prueba de acceso"
            : null,
        archived_at: status === "archived" ? new Date().toISOString() : null,
        created_by: fixture(name).id
      };
      const { data, error } = await admin
        .from("organizations")
        .insert(organizationRow)
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error(`No se creó empresa ${name}.`);
      fixtures.set(name, { ...fixture(name), organizationId: String(data.id) });
    }

    const membershipNames = organizationFixtures;
    const membershipRows: MembershipInsert[] = membershipNames.map(
      (name): MembershipInsert => ({
        organization_id: fixture(name).organizationId!,
        user_id: fixture(name).id,
        role: name === "conductor" ? "conductor" : "admin_empresa",
        status:
          name === "membership_bloqueada"
            ? "blocked"
            : name === "membership_suspendida"
              ? "suspended"
              : "active",
        joined_at: new Date().toISOString(),
        suspended_at:
          name === "membership_suspendida" ? new Date().toISOString() : null
      })
    );
    assertNoError(
      await admin.from("organization_memberships").insert(membershipRows)
    );
  }, 30_000);

  afterAll(async () => {
    if (!admin) return;
    const userIds = temporaryNames.map((name) => fixture(name).id);
    const organizationIds = [...fixtures.values()]
      .flatMap(({ organizationId }) => (organizationId ? [organizationId] : []));

    await admin.from("organization_memberships").delete().in("user_id", userIds);
    await admin.from("platform_admins").delete().in("user_id", userIds);
    if (organizationIds.length > 0) {
      await admin.from("organizations").delete().in("id", organizationIds);
    }
    await admin.from("profiles").delete().in("user_id", userIds);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  }, 30_000);

  it("inicia sesión como superadmin", async () => {
    const access = await authenticate("superadmin");
    expect(access.effectiveRole).toBe("superadmin");
    expect(access.platformAdmin?.status).toBe("active");
    expect(access.membership).toBeNull();
  });

  it("carga métricas reales como superadmin", async () => {
    const client = await signInClient("superadmin");
    await expect(loadPlatformDashboardMetrics(client)).resolves.toEqual({
      totalOrganizations: baselineMetrics.totalOrganizations + 8,
      activeOrganizations: baselineMetrics.activeOrganizations + 4,
      restrictedOrganizations: baselineMetrics.restrictedOrganizations + 2,
      totalUsers: baselineMetrics.totalUsers + 10,
      organizationAdmins: baselineMetrics.organizationAdmins + 7,
      drivers: baselineMetrics.drivers + 1
    });
  });

  it("inicia sesión como admin_empresa", async () => {
    const access = await authenticate("admin");
    expect(access.effectiveRole).toBe("admin_empresa");
    expect(access.organization?.status).toBe("active");
  });

  it("inicia sesión como conductor", async () => {
    const access = await authenticate("conductor");
    expect(access.effectiveRole).toBe("conductor");
    expect(access.organization?.status).toBe("active");
  });

  it("rechaza un usuario sin membership ni rol de plataforma", async () => {
    await expectDenied("sin_membership", "access_assignment_missing");
  });

  it("rechaza un perfil bloqueado", async () => {
    await expectDenied("perfil_bloqueado", "profile_inactive");
  });

  it.each([
    ["membership_bloqueada", "membership_inactive"],
    ["membership_suspendida", "membership_inactive"],
    ["empresa_bloqueada", "organization_inactive"],
    ["empresa_suspendida", "organization_inactive"],
    ["empresa_mantenimiento", "organization_inactive"],
    ["empresa_archivada", "organization_inactive"]
  ] as const)("rechaza %s", async (name, reason) => {
    await expectDenied(name, reason);
  });

  async function authenticate(name: FixtureName) {
    const client = await signInClient(name);
    return loadAccessContext(fixture(name).id, client);
  }

  async function signInClient(name: FixtureName) {
    const client = createClient<Database>(url!, anonKey!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const target = fixture(name);
    const { data, error } = await client.auth.signInWithPassword({
      email: target.email,
      password:
        name === "superadmin" ? LOCAL_SUPERADMIN_PASSWORD : PASSWORD
    });
    if (error || !data.user) throw error ?? new Error("Login sin usuario.");
    return client;
  }

  async function expectDenied(
    name: FixtureName,
    reason: AccessDeniedError["reason"]
  ) {
    try {
      await authenticate(name);
      throw new Error(`Se permitió el acceso de ${name}.`);
    } catch (caught) {
      expect(caught).toBeInstanceOf(AccessDeniedError);
      expect((caught as AccessDeniedError).reason).toBe(reason);
    }
  }

  function fixture(name: FixtureName): Fixture {
    const value = fixtures.get(name);
    if (!value) throw new Error(`Fixture no disponible: ${name}.`);
    return value;
  }
});

function assertNoError(result: { error: unknown }): void {
  if (result.error) throw result.error;
}
