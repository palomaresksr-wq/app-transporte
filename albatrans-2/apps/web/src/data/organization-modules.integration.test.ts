import type { ModuleCode, ModuleOverrideMode } from "@albatrans/contracts";
import { createClient, FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { loadAccessContext } from "../auth/auth-service";
import type { Database } from "../infrastructure/supabase/database.types";
import { loadOrganizationDetail } from "./organization-detail-repository";

const url: string | undefined = import.meta.env.ALBATRANS_TEST_SUPABASE_URL;
const anonKey: string | undefined = import.meta.env.ALBATRANS_TEST_ANON_KEY;
const organizationId: string | undefined = import.meta.env.ALBATRANS_TEST_MODULE_ORGANIZATION_ID;
const adminEmail: string | undefined = import.meta.env.ALBATRANS_TEST_MODULE_ADMIN_EMAIL;
const adminPassword: string | undefined = import.meta.env.ALBATRANS_TEST_MODULE_ADMIN_PASSWORD;

describe.skipIf(!url || !anonKey || !organizationId || !adminEmail || !adminPassword)("Edge Function de módulos local", () => {
  it("resuelve plan y overrides sin elevar permisos ni borrar configuración", async () => {
    if (!url || !anonKey || !organizationId || !adminEmail || !adminPassword) throw new Error("Entorno de integración incompleto.");
    const platform = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await platform.auth.signInWithPassword({ email: "superadmin@albatrans.local", password: "AlbatransLocal2026!" }); if (login.error) throw login.error;
    expect((await change(platform, organizationId, "api_access", "enabled", "")).code).toBe("reason_required");
    expect((await change(platform, organizationId, "api_access", "enabled", "Integración externa")).data).toMatchObject({ effectiveEnabled: true });
    expect((await change(platform, organizationId, "transport_management", "disabled", "Pausa operativa")).data).toMatchObject({ effectiveEnabled: false });
    expect((await change(platform, organizationId, "transport_management", "inherit", "")).data).toMatchObject({ effectiveEnabled: true });
    await change(platform, organizationId, "transport_management", "disabled", "Se conserva al cambiar plan");
    await manageEnterprise(platform, organizationId);
    await change(platform, organizationId, "audit_access", "enabled", "Preparación futura");
    await change(platform, organizationId, "support_access", "disabled", "Soporte empresarial desactivado");
    const detail = await loadOrganizationDetail(organizationId, platform);
    expect(detail?.modules).toHaveLength(14);
    expect(detail?.modules.find((module) => module.code === "api_access")).toMatchObject({ planIncluded: true, overrideMode: "enabled", enabled: true, overrideReason: "Integración externa" });
    expect(detail?.modules.find((module) => module.code === "transport_management")).toMatchObject({ planIncluded: true, overrideMode: "disabled", enabled: false });
    expect(detail?.modules.find((module) => module.code === "support_access")).toMatchObject({ overrideMode: "disabled", enabled: false });
    expect(detail?.modules.find((module) => module.code === "audit_access")).toMatchObject({ overrideMode: "enabled", enabled: true });
    const platformAccess = await loadAccessContext(login.data.user.id, platform);
    expect(platformAccess.effectiveRole).toBe("superadmin");
    const company = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const companyLogin = await company.auth.signInWithPassword({ email: adminEmail, password: adminPassword }); if (companyLogin.error) throw companyLogin.error;
    const companyAccess = await loadAccessContext(companyLogin.data.user.id, company);
    expect(companyAccess.effectiveRole).toBe("admin_empresa");
    expect(companyAccess.enabledModules).toEqual([]);
    const companyAudit = await company.from("audit_events").select("id").eq("organization_id", organizationId);
    expect(companyAudit.error).toBeNull(); expect(companyAudit.data).toEqual([]);
    const audits = await platform.from("audit_events").select("action,before_data,after_data,reason").eq("organization_id", organizationId).like("action", "organization.module_%"); if (audits.error) throw audits.error;
    for (const action of ["organization.module_enabled", "organization.module_disabled", "organization.module_inherited"]) expect(audits.data.some((event) => event.action === action)).toBe(true);
    for (const event of audits.data) { expect(objectKeys(event.before_data)).toEqual(moduleAuditKeys); expect(objectKeys(event.after_data)).toEqual(moduleAuditKeys); }
  }, 30_000);
});

const moduleAuditKeys = ["effective_enabled", "module_code", "override_mode", "plan_enabled"];
async function change(client: SupabaseClient<Database>, id: string, moduleCode: ModuleCode, overrideMode: ModuleOverrideMode, reason: string) { const result = await client.functions.invoke("platform-organizations", { body: { action: "change_module", organizationId: id, moduleCode, overrideMode, reason } }); if (!result.error) return { data: result.data, code: null }; if (!(result.error instanceof FunctionsHttpError)) throw result.error; const body: unknown = await result.error.context.json(); return { data: null, code: commandCode(body) }; }
async function manageEnterprise(client: SupabaseClient<Database>, id: string) { const result = await client.functions.invoke("platform-organizations", { body: { action: "manage_subscription", organizationId: id, subscription: { planCode: "enterprise", status: "active", paymentStatus: "paid", startsAt: "2026-01-01T00:00:00Z", currentPeriodStartsAt: "2026-08-01T00:00:00Z", currentPeriodEndsAt: "2026-08-31T23:59:59Z", paidThrough: "2026-08-31T23:59:59Z", gracePeriodEndsAt: "2026-09-05T00:00:00Z", cancelAtPeriodEnd: false, notes: "MODULEFIX", reason: "Cambio de plan" } } }); if (result.error) throw result.error; }
function commandCode(value: unknown): string | null { if (typeof value !== "object" || value === null || !("error" in value)) return null; const error = value.error; if (typeof error !== "object" || error === null || !("code" in error)) return null; return typeof error.code === "string" ? error.code : null; }
function objectKeys(value: unknown): string[] { if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Auditoría de módulo inválida."); return Object.keys(value).sort(); }
