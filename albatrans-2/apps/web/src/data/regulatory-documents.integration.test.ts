import { createClient, FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../infrastructure/supabase/database.types";

const url: string | undefined = import.meta.env.ALBATRANS_TEST_SUPABASE_URL;
const anonKey: string | undefined = import.meta.env.ALBATRANS_TEST_ANON_KEY;
const serviceKey: string | undefined = import.meta.env.ALBATRANS_TEST_SERVICE_ROLE_KEY;
const organizationId = "e2000000-0000-4000-8000-000000000001";
const clientId = "e4000000-0000-4000-8000-000000000001";
const adminMembershipId = "e3000000-0000-4000-8000-000000000001";
const membershipId = "e3000000-0000-4000-8000-000000000002";
const driverId = "e5000000-0000-4000-8000-000000000001";
const vehicleId = "e6000000-0000-4000-8000-000000000001";
const pickupId = "ea000000-0000-4000-8000-000000000001";
const deliveryId = "ea000000-0000-4000-8000-000000000002";
const orderId = "e7000000-0000-4000-8000-000000000001";
const stopId = "eb000000-0000-4000-8000-000000000001";
const deliveryStopId = "eb000000-0000-4000-8000-000000000002";
const itemId = "ec000000-0000-4000-8000-000000000001";
const email = "phase-j-admin@albatrans.local";
const driverEmail = "phase-j-driver@albatrans.local";
const password = "PhaseJLocal2026!";
let service: SupabaseClient<Database>;
let admin: SupabaseClient<Database>;
let driver: SupabaseClient<Database>;
let adminUserId = "";
let driverUserId = "";
let regulatoryId = "";
let storagePath = "";

describe.skipIf(!url || !anonKey || !serviceKey)("documentos reglamentarios contra Auth, Edge y Storage local", () => {
  beforeAll(async () => {
    if (!url || !anonKey || !serviceKey) throw new Error("Entorno local incompleto.");
    service = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: "phase-j-service" } });
    admin = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: "phase-j-admin" } });
    driver = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: "phase-j-driver" } });
    await cleanup();
    const adminUser = await service.auth.admin.createUser({ email, password, email_confirm: true });
    const driverUser = await service.auth.admin.createUser({ email: driverEmail, password, email_confirm: true });
    if (adminUser.error) throw adminUser.error;
    if (driverUser.error) throw driverUser.error;
    adminUserId = adminUser.data.user.id;
    driverUserId = driverUser.data.user.id;
    await checked(service.from("profiles").insert([
      { user_id: adminUserId, display_name: "Phase J Admin", status: "active" },
      { user_id: driverUserId, display_name: "Phase J Driver", status: "active" },
    ]));
    await checked(service.from("organizations").insert({ id: organizationId, legal_name: "Phase J Regulatory SL", trade_name: "Phase J Regulatory", tax_id: "PHASEJ001", status: "active", created_by: adminUserId }));
    await checked(service.from("organization_memberships").insert([
      { id: adminMembershipId, organization_id: organizationId, user_id: adminUserId, role: "admin_empresa", status: "active", joined_at: new Date().toISOString() },
      { id: membershipId, organization_id: organizationId, user_id: driverUserId, role: "conductor", status: "active", joined_at: new Date().toISOString() },
    ]));
    const modules = await service.from("modules").select("id,code").in("code", ["electronic_delivery_notes", "transport_management", "document_management", "pod_signature"]);
    if (modules.error) throw modules.error;
    await checked(service.from("organization_module_overrides").insert(modules.data.map((module) => ({ organization_id: organizationId, module_id: module.id, override_mode: "enabled" as const, changed_by: adminUserId, reason: "Integración local Fase J" }))));
    await checked(service.from("clients").insert({ id: clientId, organization_id: organizationId, legal_name: "Cliente Reglamentario SL", trade_name: "Cliente Reglamentario", tax_id: "PHASEJC01", created_by: adminUserId }));
    await checked(service.from("drivers").insert({ id: driverId, organization_id: organizationId, membership_id: membershipId, first_name: "Conductor", last_name: "Fase J", display_name: "Conductor Fase J", employment_status: "active", created_by: adminUserId }));
    await checked(service.from("vehicles").insert({ id: vehicleId, organization_id: organizationId, registration_plate: "J0001REG", vehicle_type: "truck", status: "active", created_by: adminUserId }));
    await checked(service.from("locations").insert([
      { id: pickupId, organization_id: organizationId, name: "Origen Fase J", address_line_1: "Calle Origen 1", postal_code: "28001", city: "Madrid", country_code: "ES", created_by: adminUserId },
      { id: deliveryId, organization_id: organizationId, name: "Destino Fase J", address_line_1: "Calle Destino 1", postal_code: "08001", city: "Barcelona", country_code: "ES", created_by: adminUserId },
    ]));
    await checked(service.from("transport_orders").insert({ id: orderId, organization_id: organizationId, order_number: "TR-PHASE-J-001", customer_id: clientId, transport_type: "general", assigned_driver_id: driverId, assigned_vehicle_id: vehicleId, created_by: adminUserId }));
    await checked(service.from("transport_stops").insert([
      { id: stopId, organization_id: organizationId, transport_order_id: orderId, position: 1, stop_type: "pickup", location_id: pickupId, created_by: adminUserId },
      { id: deliveryStopId, organization_id: organizationId, transport_order_id: orderId, position: 2, stop_type: "delivery", location_id: deliveryId, created_by: adminUserId },
    ]));
    await checked(service.from("transport_items").insert({ id: itemId, organization_id: organizationId, transport_order_id: orderId, stop_id: stopId, description: "Mercancía reglamentaria", pallets: 10, packages: 10, weight_kg: 2500, created_by: adminUserId }));
    const adminLogin = await admin.auth.signInWithPassword({ email, password });
    const driverLogin = await driver.auth.signInWithPassword({ email: driverEmail, password });
    if (adminLogin.error) throw adminLogin.error;
    if (driverLogin.error) throw driverLogin.error;
  }, 30_000);

  afterAll(async () => {
    await admin?.auth.signOut();
    await driver?.auth.signOut();
    await cleanup();
  });

  it("emite, genera PDF privado, firma y revisa sin duplicar efectos", async () => {
    const createKey = crypto.randomUUID();
    const created = await invoke(admin, { action: "create_draft", organizationId, transportOrderId: orderId, documentType: "control_document", idempotencyKey: createKey });
    regulatoryId = required(created.documentId);
    const retried = await invoke(admin, { action: "create_draft", organizationId, transportOrderId: orderId, documentType: "control_document", idempotencyKey: createKey });
    expect(retried.documentId).toBe(regulatoryId);
    const issued = await invoke(admin, { action: "issue", organizationId, regulatoryDocumentId: regulatoryId, idempotencyKey: crypto.randomUUID() });
    expect(required(issued.documentNumber)).toMatch(/^DC-\d{4}-\d{6}$/);
    expect(required(issued.contentHash)).toMatch(/^[0-9a-f]{64}$/);
    const pdfKey = crypto.randomUUID();
    const pdf = await invoke(admin, { action: "generate_pdf", organizationId, regulatoryDocumentId: regulatoryId, idempotencyKey: pdfKey });
    await invoke(admin, { action: "generate_pdf", organizationId, regulatoryDocumentId: regulatoryId, idempotencyKey: pdfKey });
    const version = await service.from("document_versions").select("storage_path,sha256").eq("id", required(pdf.versionId)).single();
    if (version.error) throw version.error;
    storagePath = version.data.storage_path;
    expect(version.data.sha256).toMatch(/^[0-9a-f]{64}$/);
    const download = await invoke(driver, { action: "download_pdf", organizationId, regulatoryDocumentId: regulatoryId, idempotencyKey: crypto.randomUUID() });
    const file = await fetch(required(download.signedUrl));
    expect(file.ok).toBe(true);
    expect(file.headers.get("content-type")).toContain("application/pdf");
    const signKey = crypto.randomUUID();
    const signature = { action: "sign", organizationId, regulatoryDocumentId: regulatoryId, signatureValue: "firma-dibujada-fase-j", signerName: "Receptor Local", signerRole: "receiver", signatureType: "drawn", idempotencyKey: signKey };
    await invoke(driver, signature);
    await invoke(driver, signature);
    const signatures = await service.from("document_signatures").select("id").eq("organization_id", organizationId);
    const signedEvents = await service.from("transport_events").select("id").eq("organization_id", organizationId).eq("event_type", "regulatory_document.signed");
    expect(signatures.data).toHaveLength(1);
    expect(signedEvents.data).toHaveLength(1);
    const exported = await invoke(driver, { action: "export", organizationId, regulatoryDocumentId: regulatoryId, idempotencyKey: crypto.randomUUID() });
    expect(exported.format).toBe("albatrans.regulatory.v1");
    const revision = await invoke(admin, { action: "create_revision", organizationId, regulatoryDocumentId: regulatoryId, reason: "Cambio controlado de datos", idempotencyKey: crypto.randomUUID() });
    expect(revision.revisionNumber).toBe(2);
    const rows = await service.from("transport_regulatory_revisions").select("revision_number,content_hash").eq("regulatory_document_id", regulatoryId).order("revision_number");
    expect(rows.data).toHaveLength(2);
    expect(rows.data?.[0]?.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows.data?.[1]?.content_hash).toBeNull();
  }, 30_000);

  it("aplica IDOR y pierde acceso en cuanto se desasigna", async () => {
    const visible = await invokeList(driver, { action: "list", organizationId, transportOrderId: orderId, idempotencyKey: crypto.randomUUID() });
    expect(visible).toHaveLength(1);
    await service.from("transport_orders").update({ assigned_driver_id: null, assigned_vehicle_id: null }).eq("id", orderId);
    await expect(invoke(driver, { action: "detail", organizationId, regulatoryDocumentId: regulatoryId, idempotencyKey: crypto.randomUUID() })).rejects.toThrow(/Documento no disponible/);
    await service.from("transport_orders").update({ assigned_driver_id: driverId, assigned_vehicle_id: vehicleId }).eq("id", orderId);
  });
});

async function rawInvoke(client: SupabaseClient<Database>, body: Record<string, unknown>): Promise<unknown> {
  const result = await client.functions.invoke("regulatory-documents", { body });
  if (result.error) {
    if (result.error instanceof FunctionsHttpError) {
      const payload: unknown = await result.error.context.json();
      if (record(payload) && record(payload.error) && typeof payload.error.message === "string") throw new Error(payload.error.message);
    }
    throw result.error;
  }
  return result.data;
}

async function invoke(client: SupabaseClient<Database>, body: Record<string, unknown>) {
  const result = await rawInvoke(client, body);
  if (!record(result)) throw new Error("Respuesta Edge de objeto inválida.");
  return result;
}

async function invokeList(client: SupabaseClient<Database>, body: Record<string, unknown>) {
  const result = await rawInvoke(client, body);
  if (!Array.isArray(result)) throw new Error("Respuesta Edge de lista inválida.");
  return result;
}

async function checked(operation: PromiseLike<{ error: { message: string } | null }>) {
  const result = await operation;
  if (result.error) throw result.error;
}

async function cleanup() {
  if (!service) return;
  if (storagePath) await service.storage.from("albatrans-documents").remove([storagePath]);
  const tables = ["regulatory_document_outbox", "transport_regulatory_evidence", "regulatory_command_idempotency", "transport_regulatory_revisions", "transport_regulatory_documents", "document_command_idempotency", "document_signatures", "transport_events", "audit_events", "document_versions", "documents", "transport_items", "transport_stops", "transport_orders", "locations", "vehicles", "drivers", "clients", "organization_module_overrides", "organization_memberships"] as const;
  await service.from("documents").update({ current_version_id: null }).eq("organization_id", organizationId);
  for (const table of tables) await service.from(table).delete().eq("organization_id", organizationId);
  await service.from("organizations").delete().eq("id", organizationId);
  const listed = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const fixtureUserIds = listed.error
    ? [adminUserId, driverUserId]
    : listed.data.users.filter((user) => user.email === email || user.email === driverEmail).map((user) => user.id);
  for (const userId of fixtureUserIds) {
    if (!userId) continue;
    await service.from("profiles").delete().eq("user_id", userId);
    await service.auth.admin.deleteUser(userId);
  }
}

function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function required(value: unknown) { if (typeof value !== "string" || !value) throw new Error("Campo Edge requerido ausente."); return value; }
