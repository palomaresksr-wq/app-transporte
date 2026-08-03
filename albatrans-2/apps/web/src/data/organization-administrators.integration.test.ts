import type { Database } from "../infrastructure/supabase/database.types";
import { createClient, FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url: string | undefined = import.meta.env.ALBATRANS_TEST_SUPABASE_URL;
const anonKey: string | undefined = import.meta.env.ALBATRANS_TEST_ANON_KEY;
const serviceKey: string | undefined = import.meta.env.ALBATRANS_TEST_SERVICE_ROLE_KEY;
const organizationId = "ad000000-0000-4000-8000-000000000001";
const dependencyMembershipId = "ad000000-0000-4000-8000-000000000002";
const createdEmail = "adminfix-created@albatrans.local";
const updatedEmail = "adminfix-updated@albatrans.local";
const dependencyEmail = "adminfix-dependent@albatrans.local";
let dependencyUserId = "";
let createdUserId = "";
let service: SupabaseClient<Database>;

describe.skipIf(!url || !anonKey || !serviceKey)("Edge Function local de administradores", () => {
  beforeAll(async () => {
    if (!url || !serviceKey) throw new Error("Entorno local incompleto.");
    service = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: "adminfix-service" } });
    await cleanupFixtures();
    const superadmin = await findAuthUser("superadmin@albatrans.local");
    if (!superadmin) throw new Error("No existe el superadmin local preparado.");
    const createdDependency = await service.auth.admin.createUser({ email: dependencyEmail, password: "AdminFixLocal2026!", email_confirm: true });
    if (createdDependency.error) throw createdDependency.error; dependencyUserId = createdDependency.data.user.id;
    const organization: Database["public"]["Tables"]["organizations"]["Insert"] = { id: organizationId, legal_name: "ADMINFIX Empresa SL", trade_name: "ADMINFIX Empresa", tax_id: "ADMINFIX001", created_by: superadmin.id, status: "active" };
    const profile: Database["public"]["Tables"]["profiles"]["Insert"] = { user_id: dependencyUserId, display_name: "Admin con dependencia", status: "active" };
    const membership: Database["public"]["Tables"]["organization_memberships"]["Insert"] = { id: dependencyMembershipId, organization_id: organizationId, user_id: dependencyUserId, role: "admin_empresa", status: "active", invited_by: superadmin.id, invited_at: new Date().toISOString(), joined_at: new Date().toISOString() };
    const subscription: Database["public"]["Tables"]["organization_subscriptions"]["Insert"] = { organization_id: organizationId, plan_id: "10000000-0000-4000-8000-000000000003", status: "active", payment_status: "paid", starts_at: new Date().toISOString() };
    const limit: Database["public"]["Tables"]["organization_limit_overrides"]["Insert"] = { organization_id: organizationId, limit_definition_id: "30000000-0000-4000-8000-000000000001", override_mode: "custom", limit_value: 2, reason: "Fixture de integración", changed_by: superadmin.id };
    const legacy: Database["public"]["Tables"]["legacy_identity_links"]["Insert"] = { organization_id: organizationId, membership_id: dependencyMembershipId, legacy_entity_type: "admin_empresa", legacy_table: "admins_empresa", legacy_id_text: "ADMINFIX-DEPENDENCY", migration_status: "activated" };
    for (const operation of [service.from("organizations").insert(organization), service.from("profiles").insert(profile), service.from("organization_memberships").insert(membership), service.from("organization_subscriptions").insert(subscription), service.from("organization_limit_overrides").insert(limit), service.from("legacy_identity_links").insert(legacy)]) { const result = await operation; if (result.error) throw result.error; }
  });

  afterAll(async () => { if (service) await cleanupFixtures(); });

  it("gestiona Auth, límite, estados, dependencias y auditoría sin elevar privilegios", async () => {
    if (!url || !anonKey) throw new Error("Entorno local incompleto.");
    const platform = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: "adminfix-platform" } });
    const login = await platform.auth.signInWithPassword({ email: "superadmin@albatrans.local", password: "AlbatransLocal2026!" }); if (login.error) throw login.error;
    const initial = await invoke(platform, { action: "list", organizationId }); expect(initial.data).toMatchObject({ assignedCount: 1, effectiveLimit: 2 });
    const created = await invoke(platform, { action: "create", organizationId, administrator: { email: createdEmail, displayName: "Admin Fixture", phone: "", locale: "es", timezone: "Europe/Madrid" } }); expect(created.code).toBeNull();
    createdUserId = userId(created.data);
    expect((await invoke(platform, { action: "create", organizationId, administrator: { email: "adminfix-limit@albatrans.local", displayName: "Supera límite", phone: "", locale: "es", timezone: "Europe/Madrid" } })).code).toBe("administrator_limit_reached");
    const listed = await invoke(platform, { action: "list", organizationId }); expect(listed.data).toMatchObject({ assignedCount: 2, effectiveLimit: 2 }); expect(JSON.stringify(listed.data)).toContain("Admin Fixture"); expect(JSON.stringify(listed.data)).toContain("Superadmin Local");
    expect((await invoke(platform, { action: "update", organizationId, userId: createdUserId, administrator: { email: updatedEmail, displayName: "Admin Actualizada", phone: "+34910000000", locale: "es", timezone: "Europe/Madrid" } })).code).toBeNull();
    expect((await invoke(platform, { action: "resend_invitation", organizationId, userId: createdUserId })).code).toBeNull();
    expect((await invoke(platform, { action: "activate", organizationId, userId: createdUserId })).code).toBeNull();
    expect((await invoke(platform, { action: "reset_password", organizationId, userId: createdUserId })).code).toBeNull();
    expect((await invoke(platform, { action: "deactivate", organizationId, userId: createdUserId })).code).toBeNull();
    expect((await invoke(platform, { action: "delete", organizationId, userId: dependencyUserId })).code).toBe("administrator_dependencies");
    expect((await invoke(platform, { action: "delete", organizationId, userId: createdUserId })).code).toBeNull();
    expect(await findAuthUser(updatedEmail)).toBeNull();
    const platformRole = await service.from("platform_admins").select("user_id").eq("user_id", dependencyUserId); if (platformRole.error) throw platformRole.error; expect(platformRole.data).toEqual([]);
    const audits = await service.from("audit_events").select("action,before_data,after_data").eq("organization_id", organizationId).like("action", "organization.admin_%"); if (audits.error) throw audits.error;
    for (const action of ["organization.admin_created", "organization.admin_updated", "organization.admin_invitation_resent", "organization.admin_activated", "organization.admin_password_reset_requested", "organization.admin_deactivated", "organization.admin_deleted"]) expect(audits.data.some((event) => event.action === action)).toBe(true);
  }, 45_000);
});

async function invoke(client: SupabaseClient<Database>, body: object): Promise<{ data: unknown; code: string | null }> { const result = await client.functions.invoke("platform-organization-admins", { body }); if (!result.error) return { data: result.data, code: null }; if (!(result.error instanceof FunctionsHttpError)) throw result.error; const value: unknown = await result.error.context.json(); return { data: null, code: commandCode(value) }; }
function commandCode(value: unknown): string | null { if (!record(value) || !record(value.error)) return null; return typeof value.error.code === "string" ? value.error.code : null; }
function userId(value: unknown): string { if (!record(value) || typeof value.userId !== "string") throw new Error("La función no devolvió userId."); return value.userId; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
async function findAuthUser(email: string) { const result = await service.auth.admin.listUsers({ page: 1, perPage: 1000 }); if (result.error) throw result.error; return result.data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null; }
async function cleanupFixtures() {
  if (!service) return;
  await service.from("audit_events").delete().eq("organization_id", organizationId);
  await service.from("legacy_identity_links").delete().eq("organization_id", organizationId);
  await service.from("organization_limit_overrides").delete().eq("organization_id", organizationId);
  await service.from("organization_memberships").delete().eq("organization_id", organizationId);
  await service.from("organization_subscriptions").delete().eq("organization_id", organizationId);
  await service.from("organizations").delete().eq("id", organizationId);
  for (const email of [createdEmail, updatedEmail, dependencyEmail, "adminfix-limit@albatrans.local"]) { const user = await findAuthUser(email); if (user) { const removed = await service.auth.admin.deleteUser(user.id); if (removed.error) throw removed.error; } }
  dependencyUserId = ""; createdUserId = "";
}
