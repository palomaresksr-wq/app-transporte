import { FunctionsHttpError, createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../infrastructure/supabase/database.types";
import { loadAssignments, loadMasterData } from "./master-data-repository";

const url: string | undefined = import.meta.env.ALBATRANS_TEST_SUPABASE_URL;
const anonKey: string | undefined = import.meta.env.ALBATRANS_TEST_ANON_KEY;
const serviceKey: string | undefined = import.meta.env.ALBATRANS_TEST_SERVICE_ROLE_KEY;
const organizationId = "1a200000-0000-4000-8000-000000000001";
let service: SupabaseClient<Database>;
let platform: SupabaseClient<Database>;

describe.skipIf(!url || !anonKey || !serviceKey)("Datos Maestros contra Supabase local", () => {
  beforeAll(async () => {
    if (!url || !anonKey || !serviceKey) throw new Error("Entorno local incompleto.");
    service = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: "phase-a-service" } });
    platform = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: "phase-a-platform" } });
    await cleanup();
    const superadmin = await findAuthUser("superadmin@albatrans.local");
    if (!superadmin) throw new Error("No existe el superadmin local permanente.");
    const organization: Database["public"]["Tables"]["organizations"]["Insert"] = { id: organizationId, legal_name: "PHASEA Empresa", trade_name: "PHASEA", tax_id: "PHASEA001", created_by: superadmin.id, status: "active" };
    const inserted = await service.from("organizations").insert(organization);
    if (inserted.error) throw inserted.error;
    const login = await platform.auth.signInWithPassword({ email: "superadmin@albatrans.local", password: "AlbatransLocal2026!" });
    if (login.error) throw login.error;
  });
  afterAll(async () => { if (service) await cleanup(); });

  it("crea todas las entidades, impide solapamientos y conserva historial", async () => {
    const client = await command("clients", { legal_name: "Cliente Uno SL", trade_name: "Cliente Uno", status: "active" });
    await command("client_contacts", { client_id: client.entityId, name: "Laura Contacto", is_primary: true });
    await command("locations", { client_id: client.entityId, name: "Almacén", address_line_1: "Calle Mayor 1", postal_code: "28001", city: "Madrid", country_code: "ES", status: "active" });
    const driver = await command("drivers", { first_name: "Ana", last_name: "Ruta", display_name: "Ana Ruta", employment_status: "active" });
    const vehicle = await command("vehicles", { registration_plate: "1234ABC", vehicle_type: "Camión rígido", status: "active" });
    await command("trailers", { registration_plate: "R1234BC", trailer_type: "Semirremolque", status: "active" });
    const assignment = await command("driver_vehicle_assignments", { driver_id: driver.entityId, vehicle_id: vehicle.entityId, starts_at: "2026-08-04T08:00:00Z", ends_at: null });
    const listedDrivers = await loadMasterData({ organizationId, resource: "drivers", search: "Ana", status: "active", page: 1, pageSize: 20 }, platform);
    expect(listedDrivers).toMatchObject({ total: 1, items: [expect.objectContaining({ id: driver.entityId, title: "Ana Ruta" })] });
    const listedAssignments = await loadAssignments(organizationId, 1, 20, platform);
    expect(listedAssignments).toMatchObject({ total: 1, items: [expect.objectContaining({ id: assignment.entityId, driverName: "Ana Ruta", vehiclePlate: "1234ABC" })] });
    const overlap = await invoke("driver_vehicle_assignments", { driver_id: driver.entityId, vehicle_id: vehicle.entityId, starts_at: "2026-08-04T09:00:00Z", ends_at: "2026-08-04T10:00:00Z" });
    expect(overlap.code).toBe("assignment_overlap");
    const ended = await platform.functions.invoke("master-data", { body: { action: "end_assignment", resource: "driver_vehicle_assignments", organizationId, entityId: assignment.entityId, values: { ends_at: "2026-08-04T12:00:00Z" } } });
    if (ended.error) throw ended.error;
    const history = await service.from("driver_vehicle_assignments").select("ends_at").eq("id", assignment.entityId).single();
    if (history.error) throw history.error;
    expect(history.data.ends_at).toBe("2026-08-04T12:00:00+00:00");
    const audits = await service.from("audit_events").select("action,actor_scope").eq("organization_id", organizationId);
    if (audits.error) throw audits.error;
    expect(audits.data.map((event) => event.action)).toEqual(expect.arrayContaining(["client.created", "client_contact.created", "location.created", "driver.created", "vehicle.created", "trailer.created", "driver_vehicle_assignment.created", "driver_vehicle_assignment.ended"]));
    expect(audits.data.every((event) => event.actor_scope === "platform")).toBe(true);
  }, 30_000);

  it("rechaza payloads extra y no permite editar el historial", async () => {
    const payload = await invoke("vehicles", { registration_plate: "0000BAD", vehicle_type: "Furgón", status: "active", plan_id: "forbidden" });
    expect(payload.code).toBe("invalid_request");
    const assignment = await service.from("driver_vehicle_assignments").select("id").eq("organization_id", organizationId).limit(1).single();
    if (assignment.error) throw assignment.error;
    const mutation = await invokeRaw({ action: "update", resource: "driver_vehicle_assignments", organizationId, entityId: assignment.data.id, values: { notes: "alterado" } });
    expect(mutation.code).toBe("invalid_transition");
  });
});

async function command(resource: string, values: Record<string, string | boolean | null>) {
  const result = await platform.functions.invoke("master-data", { body: { action: "create", resource, organizationId, values } });
  if (result.error) throw result.error;
  if (!record(result.data) || typeof result.data.entityId !== "string") throw new Error("Respuesta inválida.");
  return { entityId: result.data.entityId };
}
async function invoke(resource: string, values: Record<string, string | boolean | null>) { return invokeRaw({ action: "create", resource, organizationId, values }); }
async function invokeRaw(body: object) {
  const result = await platform.functions.invoke("master-data", { body });
  if (!result.error) return { code: null };
  if (!(result.error instanceof FunctionsHttpError)) throw result.error;
  const data: unknown = await result.error.context.json();
  return { code: record(data) && record(data.error) && typeof data.error.code === "string" ? data.error.code : null };
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
async function findAuthUser(email: string) { const result = await service.auth.admin.listUsers({ page: 1, perPage: 1000 }); if (result.error) throw result.error; return result.data.users.find((user) => user.email === email) ?? null; }
async function cleanup() {
  if (!service) return;
  await service.from("audit_events").delete().eq("organization_id", organizationId);
  await service.from("driver_vehicle_assignments").delete().eq("organization_id", organizationId);
  await service.from("client_contacts").delete().eq("organization_id", organizationId);
  await service.from("locations").delete().eq("organization_id", organizationId);
  await service.from("drivers").delete().eq("organization_id", organizationId);
  await service.from("vehicles").delete().eq("organization_id", organizationId);
  await service.from("trailers").delete().eq("organization_id", organizationId);
  await service.from("clients").delete().eq("organization_id", organizationId);
  await service.from("organizations").delete().eq("id", organizationId);
}
