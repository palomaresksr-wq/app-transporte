import type { ManageOrganizationSubscriptionInput } from "@albatrans/contracts";
import { createClient, FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "../infrastructure/supabase/database.types";
import { loadOrganizationDetail } from "./organization-detail-repository";
import { loadOrganizations } from "./organization-list-repository";
import { loadPlatformDashboardMetrics } from "./platform-dashboard-repository";

const url: string | undefined = import.meta.env.ALBATRANS_TEST_SUPABASE_URL;
const anonKey: string | undefined = import.meta.env.ALBATRANS_TEST_ANON_KEY;
const newOrganizationId: string | undefined = import.meta.env.ALBATRANS_TEST_SUBSCRIPTION_NEW_ORGANIZATION_ID;
const existingOrganizationId: string | undefined = import.meta.env.ALBATRANS_TEST_SUBSCRIPTION_EXISTING_ORGANIZATION_ID;

describe.skipIf(!url || !anonKey || !newOrganizationId || !existingOrganizationId)("Edge Function comercial local", () => {
  it("crea y actualiza suscripciones conservando overrides y auditando cada categoría", async () => {
    if (!url || !anonKey || !newOrganizationId || !existingOrganizationId) throw new Error("Entorno de integración incompleto.");
    const client = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await client.auth.signInWithPassword({ email: "superadmin@albatrans.local", password: "AlbatransLocal2026!" });
    if (login.error) throw login.error;
    const metricsBefore = await loadPlatformDashboardMetrics(client);
    const invalid = await invoke(client, existingOrganizationId, { ...commercialInput("professional"), paymentStatus: "overdue", reason: "", organizationStatus: "suspended" });
    expect(invalid.code).toBe("invalid_request");
    const missingReason = await invoke(client, existingOrganizationId, { ...commercialInput("professional"), paymentStatus: "overdue", reason: "" });
    expect(missingReason.code).toBe("reason_required");
    const created = await invoke(client, newOrganizationId, { ...commercialInput("starter"), status: "trial", paymentStatus: "pending" });
    expect(created.data).toMatchObject({ organizationId: newOrganizationId, created: true });
    const duplicateSafe = await client.from("organization_subscriptions").select("id", { count: "exact" }).eq("organization_id", newOrganizationId);
    expect(duplicateSafe.count).toBe(1);
    const moduleBefore = await client.from("organization_module_overrides").select("module_id,override_mode").eq("organization_id", existingOrganizationId);
    const limitBefore = await client.from("organization_limit_overrides").select("limit_definition_id,override_mode,limit_value").eq("organization_id", existingOrganizationId);
    if (moduleBefore.error || limitBefore.error) throw moduleBefore.error ?? limitBefore.error;
    const updated = await invoke(client, existingOrganizationId, { ...commercialInput("professional"), paymentStatus: "overdue", reason: "Impago vencido", currentPeriodEndsAt: "2026-09-30T23:59:59Z", paidThrough: "2026-08-31T23:59:59Z", gracePeriodEndsAt: "2026-10-05T00:00:00Z", cancelAtPeriodEnd: true });
    expect(updated.data).toMatchObject({ organizationId: existingOrganizationId, created: false });
    const moduleAfter = await client.from("organization_module_overrides").select("module_id,override_mode").eq("organization_id", existingOrganizationId);
    const limitAfter = await client.from("organization_limit_overrides").select("limit_definition_id,override_mode,limit_value").eq("organization_id", existingOrganizationId);
    expect(moduleAfter.data).toEqual(moduleBefore.data);
    expect(limitAfter.data).toEqual(limitBefore.data);
    const detail = await loadOrganizationDetail(existingOrganizationId, client);
    expect(detail?.subscription).toMatchObject({ planCode: "professional", paymentStatus: "overdue", cancelAtPeriodEnd: true });
    expect(detail?.modules.find((module) => module.code === "billing")).toMatchObject({ source: "override_disabled", enabled: false });
    expect(detail?.limits.find((limit) => limit.code === "max_admins")).toMatchObject({ source: "organization_override", limit: 3 });
    const list = await loadOrganizations({ search: "SUBFIX EXISTING", status: "all", plan: "professional", paymentStatus: "overdue", page: 1, pageSize: 10 }, client);
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ id: existingOrganizationId, planCode: "professional", paymentStatus: "overdue" });
    await expect(loadPlatformDashboardMetrics(client)).resolves.toEqual(metricsBefore);
    const audits = await client.from("audit_events").select("action,reason,before_data,after_data,organization_id").in("organization_id", [newOrganizationId, existingOrganizationId]).order("occurred_at", { ascending: true });
    if (audits.error) throw audits.error;
    expect(audits.data.some((event) => event.organization_id === newOrganizationId && event.action === "subscription.created")).toBe(true);
    for (const action of ["subscription.plan_changed", "subscription.payment_changed", "subscription.expiry_changed"]) expect(audits.data.some((event) => event.organization_id === existingOrganizationId && event.action === action)).toBe(true);
    const paymentAudit = audits.data.find((event) => event.action === "subscription.payment_changed");
    expect(paymentAudit?.reason).toBe("Impago vencido");
    expect(objectKeys(paymentAudit?.before_data)).toEqual(commercialKeys);
    expect(objectKeys(paymentAudit?.after_data)).toEqual(commercialKeys);
  });
});

const commercialKeys = ["cancel_at_period_end", "current_period_ends_at", "current_period_starts_at", "grace_period_ends_at", "notes", "paid_through", "payment_status", "plan_id", "starts_at", "status"];
function commercialInput(planCode: ManageOrganizationSubscriptionInput["planCode"]): ManageOrganizationSubscriptionInput { return { planCode, status: "active", paymentStatus: "paid", startsAt: "2026-01-01T00:00:00Z", currentPeriodStartsAt: "2026-09-01T00:00:00Z", currentPeriodEndsAt: "2026-09-30T23:59:59Z", paidThrough: "2026-09-30T23:59:59Z", gracePeriodEndsAt: "2026-10-05T00:00:00Z", cancelAtPeriodEnd: false, notes: "SUBFIX comercial", reason: "" }; }
async function invoke(client: SupabaseClient<Database>, organizationId: string, subscription: ManageOrganizationSubscriptionInput | (ManageOrganizationSubscriptionInput & { organizationStatus: string })) { const result = await client.functions.invoke("platform-organizations", { body: { action: "manage_subscription", organizationId, subscription } }); if (!result.error) return { data: result.data, code: null }; if (!(result.error instanceof FunctionsHttpError)) throw result.error; const body: unknown = await result.error.context.json(); return { data: null, code: commandCode(body) }; }
function commandCode(value: unknown): string | null { if (typeof value !== "object" || value === null || !("error" in value)) return null; const error = value.error; if (typeof error !== "object" || error === null || !("code" in error)) return null; return typeof error.code === "string" ? error.code : null; }
function objectKeys(value: unknown): string[] { if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Auditoría comercial sin objeto limitado."); return Object.keys(value).sort(); }
