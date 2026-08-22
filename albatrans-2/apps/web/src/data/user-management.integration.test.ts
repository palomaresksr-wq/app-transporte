import { createClient, FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "../infrastructure/supabase/database.types";

const url: string | undefined = import.meta.env.ALBATRANS_TEST_SUPABASE_URL;
const anonKey: string | undefined = import.meta.env.ALBATRANS_TEST_ANON_KEY;
const serviceKey: string | undefined = import.meta.env.ALBATRANS_TEST_SERVICE_ROLE_KEY;
const initialPassword: string | undefined = import.meta.env.ALBATRANS_TEST_PHASE_K_INITIAL_PASSWORD;
const changedPassword: string | undefined = import.meta.env.ALBATRANS_TEST_PHASE_K_CHANGED_PASSWORD;
const enabled = Boolean(url && anonKey && serviceKey && initialPassword && changedPassword);
const adminEmail = "admin-demo-k@albatrans.local";
const driverEmail = "driver-demo-k@albatrans.local";

describe.skipIf(!enabled)("gestión de usuarios con Auth real local", () => {
  it("crea admin y conductor confirmados sin email y permite login inmediato", async () => {
    if (!url || !anonKey || !serviceKey || !initialPassword || !changedPassword) throw new Error("Entorno local incompleto.");
    const service = createClient<Database>(url, serviceKey, options("phase-k-service"));
    const platform = createClient<Database>(url, anonKey, options("phase-k-platform"));
    const organizationId = await ensureDemoOrganization(service);
    const platformLogin = await platform.auth.signInWithPassword({ email: "superadmin@albatrans.local", password: "AlbatransLocal2026!" });
    if (platformLogin.error) throw platformLogin.error;

    const adminId = await findAuthUser(service, adminEmail);
    if (!adminId) {
      const result = await platform.functions.invoke("user-management", { body: {
        action: "create_user", organizationId, firstName: "Admin", lastName: "Demo K", email: adminEmail,
        password: initialPassword, role: "admin_empresa", mustChangePassword: true,
        idempotencyKey: "6b9e70e1-235a-4a80-9a9a-000000000001"
      } });
      await expectSuccess(result.error);
    }

    const admin = createClient<Database>(url, anonKey, options("phase-k-admin"));
    const adminLogin = await admin.auth.signInWithPassword({ email: adminEmail, password: adminId ? changedPassword : initialPassword });
    if (adminLogin.error) throw adminLogin.error;
    expect(adminLogin.data.user.email_confirmed_at).toBeTruthy();
    if (!adminId) {
      const passwordUpdate = await admin.auth.updateUser({ password: changedPassword });
      if (passwordUpdate.error) throw passwordUpdate.error;
      const confirmation = await admin.functions.invoke("user-management", { body: { action: "confirm_initial_password" } });
      await expectSuccess(confirmation.error);
    }

    if (!(await findAuthUser(service, driverEmail))) {
      const result = await admin.functions.invoke("user-management", { body: {
        action: "create_user", firstName: "Conductor", lastName: "Demo K", email: driverEmail,
        password: initialPassword, role: "conductor", mustChangePassword: false,
        idempotencyKey: "6b9e70e1-235a-4a80-9a9a-000000000002"
      } });
      await expectSuccess(result.error);
    }
    const driver = createClient<Database>(url, anonKey, options("phase-k-driver"));
    const driverLogin = await driver.auth.signInWithPassword({ email: driverEmail, password: initialPassword });
    if (driverLogin.error) throw driverLogin.error;
    expect(driverLogin.data.user.email_confirmed_at).toBeTruthy();
    const membership = await driver.from("organization_memberships").select("role,organization_id,status").single();
    expect(membership.error).toBeNull();
    expect(membership.data).toMatchObject({ role: "conductor", organization_id: organizationId, status: "active" });
    const driverRecord = await driver.from("drivers").select("employment_status").eq("membership_id", membership.data?.organization_id ? (await service.from("organization_memberships").select("id").eq("user_id", driverLogin.data.user.id).single()).data?.id ?? "" : "").single();
    expect(driverRecord.data?.employment_status).toBe("active");
    const portal = await driver.functions.invoke("driver-portal", { body: { action: "list" } });
    await expectSuccess(portal.error);
    expect(Array.isArray(portal.data)).toBe(true);

    const forbidden = await driver.functions.invoke("user-management", { body: { action: "list" } });
    expect(forbidden.error).toBeInstanceOf(FunctionsHttpError);
  }, 30_000);
});

function options(storageKey: string) { return { auth: { persistSession: false, autoRefreshToken: false, storageKey } }; }

async function expectSuccess(error: unknown) {
  if (error instanceof FunctionsHttpError) throw new Error(JSON.stringify(await error.context.json()));
  if (error) throw error;
}

async function findAuthUser(service: SupabaseClient<Database>, email: string): Promise<string | null> {
  for (let page = 1; page <= 10; page += 1) {
    const result = await service.auth.admin.listUsers({ page, perPage: 100 });
    if (result.error) throw result.error;
    const match = result.data.users.find((user) => user.email === email);
    if (match) return match.id;
    if (result.data.users.length < 100) return null;
  }
  return null;
}

async function ensureDemoOrganization(service: SupabaseClient<Database>): Promise<string> {
  const existing = await service.from("organizations").select("id").eq("tax_id", "DEMO-K-LOCAL").maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    await ensureSubscription(service, existing.data.id);
    return existing.data.id;
  }
  const superadminId = await findAuthUser(service, "superadmin@albatrans.local");
  if (!superadminId) throw new Error("Falta el superadmin local.");
  const organizationId = crypto.randomUUID();
  const organization = await service.from("organizations").insert({ id: organizationId, legal_name: "Empresa Demo K", trade_name: "Demo K", tax_id: "DEMO-K-LOCAL", status: "active", created_by: superadminId });
  if (organization.error) throw organization.error;
  await ensureSubscription(service, organizationId);
  return organizationId;
}

async function ensureSubscription(service: SupabaseClient<Database>, organizationId: string): Promise<void> {
  const current = await service.from("organization_subscriptions").select("id").eq("organization_id", organizationId).maybeSingle();
  if (current.error) throw current.error;
  if (current.data) return;
  const plan = await service.from("plans").select("id").eq("code", "starter").single();
  if (plan.error) throw plan.error;
  const subscription = await service.from("organization_subscriptions").insert({ organization_id: organizationId, plan_id: plan.data.id, status: "active", payment_status: "not_required", starts_at: new Date().toISOString() });
  if (subscription.error) throw subscription.error;
}
