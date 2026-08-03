import { createClient, FunctionsHttpError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "../infrastructure/supabase/database.types";
import { loadOrganizationDetail } from "./organization-detail-repository";
import { loadOrganizations } from "./organization-list-repository";
import { loadPlatformDashboardMetrics } from "./platform-dashboard-repository";

const url: string | undefined = import.meta.env.ALBATRANS_TEST_SUPABASE_URL;
const anonKey: string | undefined = import.meta.env.ALBATRANS_TEST_ANON_KEY;
const organizationId: string | undefined = import.meta.env.ALBATRANS_TEST_UPDATE_ORGANIZATION_ID;
const conflictTaxId: string | undefined = import.meta.env.ALBATRANS_TEST_UPDATE_CONFLICT_TAX_ID;

describe.skipIf(!url || !anonKey || !organizationId || !conflictTaxId)("Edge Function de edición local", () => {
  it("actualiza solo datos generales, audita y rechaza campos o NIF duplicado", async () => {
    if (!url || !anonKey || !organizationId || !conflictTaxId) throw new Error("Entorno de integración incompleto.");
    const client = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await client.auth.signInWithPassword({ email: "superadmin@albatrans.local", password: "AlbatransLocal2026!" });
    if (login.error) throw login.error;
    const metricsBefore = await loadPlatformDashboardMetrics(client);
    const original = await client.from("organizations").select("status,legal_name,tax_id").eq("id", organizationId).single();
    if (original.error) throw original.error;
    const forbidden = await client.functions.invoke("platform-organizations", { body: { action: "update", organizationId, organization: { ...payload("EDITFIX-UPDATED"), status: "blocked" } } });
    expect(await errorCode(forbidden.error)).toBe("invalid_request");
    const unchanged = await client.from("organizations").select("status,legal_name").eq("id", organizationId).single();
    expect(unchanged.data).toEqual({ status: original.data.status, legal_name: original.data.legal_name });
    const conflict = await client.functions.invoke("platform-organizations", { body: { action: "update", organizationId, organization: payload(conflictTaxId) } });
    expect(await errorCode(conflict.error)).toBe("tax_id_conflict");
    const updated = await client.functions.invoke("platform-organizations", { body: { action: "update", organizationId, organization: payload("EDITFIX-UPDATED") } });
    if (updated.error) throw updated.error;
    expect(updated.data).toEqual({ organizationId });
    const organization = await client.from("organizations").select("legal_name,trade_name,tax_id,email,phone,country_code,timezone,currency_code,internal_notes,status").eq("id", organizationId).single();
    if (organization.error) throw organization.error;
    expect(organization.data).toMatchObject({ legal_name: "Empresa Editada SL", trade_name: "Empresa Editada", tax_id: "EDITFIX-UPDATED", status: original.data.status });
    const audit = await client.from("audit_events").select("action,before_data,after_data").eq("organization_id", organizationId).eq("action", "organization.updated").order("occurred_at", { ascending: false }).limit(1).single();
    if (audit.error) throw audit.error;
    expect(audit.data.action).toBe("organization.updated");
    expect(objectKeys(audit.data.before_data)).toEqual(editableDatabaseKeys);
    expect(objectKeys(audit.data.after_data)).toEqual(editableDatabaseKeys);
    const detail = await loadOrganizationDetail(organizationId, client);
    expect(detail?.organization).toMatchObject({ legalName: "Empresa Editada SL", tradeName: "Empresa Editada", taxId: "EDITFIX-UPDATED" });
    const list = await loadOrganizations({ search: "EDITFIX-UPDATED", status: "all", plan: "all", paymentStatus: "all", page: 1, pageSize: 10 }, client);
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ id: organizationId, legalName: "Empresa Editada SL", taxId: "EDITFIX-UPDATED" });
    await expect(loadPlatformDashboardMetrics(client)).resolves.toEqual(metricsBefore);
  });
});

const editableDatabaseKeys = ["country_code", "currency_code", "email", "internal_notes", "legal_name", "phone", "tax_id", "timezone", "trade_name"];
function payload(taxId: string) { return { legalName: "Empresa Editada SL", tradeName: "Empresa Editada", taxId, email: "editada@local.test", phone: "+34 911", countryCode: "ES", timezone: "Europe/Madrid", currencyCode: "EUR", internalNotes: "EDITFIX audit" }; }
async function errorCode(error: Error | null): Promise<string | null> { if (!(error instanceof FunctionsHttpError)) return null; const body: unknown = await error.context.json(); return commandCode(body); }
function commandCode(value: unknown): string | null { if (typeof value !== "object" || value === null || !("error" in value)) return null; const error = value.error; if (typeof error !== "object" || error === null || !("code" in error)) return null; return typeof error.code === "string" ? error.code : null; }
function objectKeys(value: unknown): string[] { if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Auditoría sin objeto limitado."); return Object.keys(value).sort(); }
