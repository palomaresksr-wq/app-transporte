import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "../infrastructure/supabase/database.types";
import { loadOrganizations } from "./organization-list-repository";

const url = import.meta.env.ALBATRANS_TEST_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.ALBATRANS_TEST_ANON_KEY as string | undefined;
describe.skipIf(!url || !anonKey)("repositorio de listado local", () => {
  it("pagina y filtra bajo RLS de superadmin", async () => {
    const client = createClient<Database>(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await client.auth.signInWithPassword({ email: "superadmin@albatrans.local", password: "AlbatransLocal2026!" });
    if (login.error) throw login.error;
    const base = { search: "", status: "all" as const, plan: "all" as const, paymentStatus: "all" as const, page: 1, pageSize: 2 };
    const result = await loadOrganizations({ ...base, search: "LISTFIX" }, client);
    expect(result.total).toBe(3);
    expect(result.items.length).toBe(2);
    const alba = await loadOrganizations({ ...base, search: "Lista Alba", pageSize: 10 }, client);
    expect(alba.items[0]).toMatchObject({ planCode: "professional", paymentStatus: "paid", activeAdminCount: 1, activeDriverCount: 1 });
    await expect(loadOrganizations({ ...base, status: "blocked", pageSize: 10 }, client)).resolves.toMatchObject({ items: [expect.objectContaining({ legalName: expect.stringContaining("LISTFIX Beta") })] });
    await expect(loadOrganizations({ ...base, plan: "starter", paymentStatus: "overdue", pageSize: 10 }, client)).resolves.toMatchObject({ total: 1 });
    await expect(loadOrganizations({ ...base, search: "resultado-imposible-local" }, client)).resolves.toMatchObject({ items: [] });
  });
});
