import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "../infrastructure/supabase/database.types";
import { loadOrganizationDetail } from "./organization-detail-repository";

const url: string | undefined = import.meta.env.ALBATRANS_TEST_SUPABASE_URL;
const anonKey: string | undefined = import.meta.env.ALBATRANS_TEST_ANON_KEY;
const organizationId: string | undefined = import.meta.env.ALBATRANS_TEST_DETAIL_ORGANIZATION_ID;
const isolatedOrganizationId: string | undefined = import.meta.env.ALBATRANS_TEST_ISOLATED_ORGANIZATION_ID;
describe.skipIf(!url || !anonKey || !organizationId || !isolatedOrganizationId)("repositorio de detalle local", () => {
  it("compone el detalle efectivo bajo RLS de superadmin", async () => {
    if (!url || !anonKey || !organizationId || !isolatedOrganizationId) throw new Error("Entorno de integración incompleto.");
    const client = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await client.auth.signInWithPassword({ email: "superadmin@albatrans.local", password: "AlbatransLocal2026!" }); if (login.error) throw login.error;
    const result = await loadOrganizationDetail(organizationId, client);
    expect(result?.organization.legalName).toContain("DETAILFIX Principal");
    expect(result?.subscription).toMatchObject({ planCode: "professional", paymentStatus: "paid" });
    expect(result?.activeAdminCount).toBe(1); expect(result?.activeDriverCount).toBe(1);
    expect(result?.modules.find((module) => module.code === "billing")).toMatchObject({ enabled: false, source: "override_disabled" });
    expect(result?.limits.find((limit) => limit.code === "max_admins")).toMatchObject({ usage: 1, limit: 3, source: "organization_override" });
    expect(result?.limits.find((limit) => limit.code === "max_ocr_monthly")?.usage).toBe(7);
    expect(result?.audit.some((event) => event.action === "organization.created")).toBe(true);
    await expect(loadOrganizationDetail("00000000-0000-0000-0000-000000000000", client)).resolves.toBeNull();
    const isolated = await loadOrganizationDetail(isolatedOrganizationId, client);
    expect(isolated?.members).toHaveLength(0); expect(isolated?.audit).toHaveLength(0);
  });
});
