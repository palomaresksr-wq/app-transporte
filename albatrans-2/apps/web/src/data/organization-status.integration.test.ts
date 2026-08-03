import type { OrganizationStatus } from "@albatrans/contracts";
import { createClient, FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "../infrastructure/supabase/database.types";
import { loadOrganizationDetail } from "./organization-detail-repository";
import { loadOrganizations } from "./organization-list-repository";
import { loadPlatformDashboardMetrics } from "./platform-dashboard-repository";

const url: string | undefined = import.meta.env.ALBATRANS_TEST_SUPABASE_URL;
const anonKey: string | undefined = import.meta.env.ALBATRANS_TEST_ANON_KEY;
const organizationId: string | undefined = import.meta.env.ALBATRANS_TEST_STATUS_ORGANIZATION_ID;

describe.skipIf(!url || !anonKey || !organizationId)("Edge Function de estado local", () => {
  it("valida motivos y transiciones, refresca lecturas y archiva sin borrar", async () => {
    if (!url || !anonKey || !organizationId) throw new Error("Entorno de integración incompleto.");
    const client = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await client.auth.signInWithPassword({ email: "superadmin@albatrans.local", password: "AlbatransLocal2026!" });
    if (login.error) throw login.error;
    const metricsInitially = await loadPlatformDashboardMetrics(client);
    expect(await change(client, organizationId, "blocked", "")).toBe("reason_required");
    await expectStatus(client, organizationId, "maintenance", "Ventana técnica");
    const maintenanceDetail = await loadOrganizationDetail(organizationId, client);
    expect(maintenanceDetail?.organization).toMatchObject({ status: "maintenance", statusReason: "Ventana técnica" });
    const maintenanceMetrics = await loadPlatformDashboardMetrics(client);
    expect(maintenanceMetrics.activeOrganizations).toBe(metricsInitially.activeOrganizations - 1);
    await expectStatus(client, organizationId, "active", "");
    await expectStatus(client, organizationId, "blocked", "Incumplimiento operativo");
    await expectStatus(client, organizationId, "active", "");
    await expectStatus(client, organizationId, "suspended", "Revisión contractual");
    await expectStatus(client, organizationId, "active", "");
    await expectStatus(client, organizationId, "archived", "Cierre definitivo");
    expect(await change(client, organizationId, "active", "")).toBe("invalid_transition");
    const detail = await loadOrganizationDetail(organizationId, client);
    expect(detail?.organization.status).toBe("archived");
    expect(detail?.organization.archivedAt).not.toBeNull();
    const list = await loadOrganizations({ search: "STATUSFIX", status: "archived", plan: "all", paymentStatus: "all", page: 1, pageSize: 10 }, client);
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ id: organizationId, status: "archived" });
    const finalMetrics = await loadPlatformDashboardMetrics(client);
    expect(finalMetrics.totalOrganizations).toBe(metricsInitially.totalOrganizations);
    expect(finalMetrics.activeOrganizations).toBe(metricsInitially.activeOrganizations - 1);
    const audits = await client.from("audit_events").select("action,reason,before_data,after_data").eq("organization_id", organizationId).eq("action", "organization.status_changed").order("occurred_at", { ascending: true });
    if (audits.error) throw audits.error;
    expect(audits.data).toHaveLength(7);
    const archivedAudit = audits.data[6];
    expect(archivedAudit?.reason).toBe("Cierre definitivo");
    expect(objectKeys(archivedAudit?.before_data)).toEqual(statusAuditKeys);
    expect(objectKeys(archivedAudit?.after_data)).toEqual(statusAuditKeys);
  });
});

const statusAuditKeys = ["archived_at", "status", "status_changed_at", "status_changed_by", "status_reason"];
async function expectStatus(client: SupabaseClient<Database>, id: string, status: OrganizationStatus, reason: string) { expect(await change(client, id, status, reason)).toBeNull(); }
async function change(client: SupabaseClient<Database>, id: string, status: OrganizationStatus, reason: string): Promise<string | null> {
  const result = await client.functions.invoke("platform-organizations", { body: { action: "change_status", organizationId: id, status, reason } });
  if (!result.error) { expect(result.data).toEqual({ organizationId: id, status }); return null; }
  if (!(result.error instanceof FunctionsHttpError)) throw result.error;
  const body: unknown = await result.error.context.json();
  return commandCode(body);
}
function commandCode(value: unknown): string | null { if (typeof value !== "object" || value === null || !("error" in value)) return null; const error = value.error; if (typeof error !== "object" || error === null || !("code" in error)) return null; return typeof error.code === "string" ? error.code : null; }
function objectKeys(value: unknown): string[] { if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Auditoría de estado sin objeto limitado."); return Object.keys(value).sort(); }
