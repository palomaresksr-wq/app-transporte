import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../infrastructure/supabase/database.types";
import { loadExecution } from "./execution-repository";
const url: string | undefined = import.meta.env.ALBATRANS_TEST_SUPABASE_URL;
const anonKey: string | undefined = import.meta.env.ALBATRANS_TEST_ANON_KEY;
const serviceKey: string | undefined = import.meta.env.ALBATRANS_TEST_SERVICE_ROLE_KEY;
const organizationId = "3c000000-0000-4000-8000-000000000001", clientId = "3c000000-0000-4000-8000-000000000002", orderId = "3c000000-0000-4000-8000-000000000003";
let service: SupabaseClient<Database>, platform: SupabaseClient<Database>;
describe.skipIf(!url || !anonKey || !serviceKey)("ejecución de transporte contra Supabase local", () => {
  beforeAll(async () => {
    if (!url || !anonKey || !serviceKey) throw new Error("Entorno incompleto.");
    service = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: "phase-c-service" } });
    platform = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: "phase-c-platform" } });
    const users = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (users.error) throw users.error;
    const actor = users.data.users.find((user) => user.email === "superadmin@albatrans.local");
    if (!actor) throw new Error("Falta el superadmin local.");
    for (const operation of [service.from("organizations").insert({ id: organizationId, legal_name: "PHASEC Empresa", trade_name: "PHASEC", tax_id: "PHASEC001", status: "active", created_by: actor.id }), service.from("clients").insert({ id: clientId, organization_id: organizationId, legal_name: "PHASEC Cliente", trade_name: "PHASEC Cliente", created_by: actor.id }), service.from("transport_orders").insert({ id: orderId, organization_id: organizationId, order_number: "PHASEC-1", customer_id: clientId, transport_type: "Operativo", created_by: actor.id })]) { const result = await operation; if (result.error) throw result.error; }
    const login = await platform.auth.signInWithPassword({ email: "superadmin@albatrans.local", password: "AlbatransLocal2026!" });
    if (login.error) throw login.error;
  });
  it("completa el flujo, calcula tiempos y registra timeline, auditoría y notificaciones", async () => {
    expect((await command({ resource: "execution", action: "start", values: {} })).eventType).toBe("execution.started");
    for (const targetStatus of ["heading_to_pickup", "arrived_pickup", "loading", "loaded", "departed_pickup", "in_transit", "arrived_delivery", "unloading", "delivered", "completed"]) await command({ resource: "execution", action: "transition", targetStatus, values: {} });
    await command({ resource: "incident", action: "create", values: { severity: "high", category: "delay", title: "Retraso", description: "Tráfico intenso" } });
    await command({ resource: "note", action: "create", values: { note_type: "operational", body: "Llegada confirmada", visible_driver: false, visible_customer: false, visible_admin: true } });
    const detail = await loadExecution(organizationId, orderId, platform);
    expect(detail.execution?.status).toBe("completed"); expect(detail.incidents).toHaveLength(1); expect(detail.notes).toHaveLength(1); expect(detail.waiting?.total_seconds).not.toBeNull();
    expect(detail.timeline.some((event) => event.event_type === "execution.completed")).toBe(true);
    const audits = await service.from("audit_events").select("action").eq("organization_id", organizationId).in("action", ["execution.completed", "incident.created", "note.created"]); if (audits.error) throw audits.error; expect(audits.data).toHaveLength(3);
    const notifications = await service.from("internal_notifications").select("event_type").eq("organization_id", organizationId); if (notifications.error) throw notifications.error; expect(notifications.data.map((item) => item.event_type)).toEqual(expect.arrayContaining(["execution.completed", "incident.created", "note.created"]));
  }, 30_000);
  it("rechaza un salto operativo imposible", async () => {
    const secondOrder = await service.from("transport_orders").insert({ organization_id: organizationId, order_number: "PHASEC-2", customer_id: clientId, transport_type: "Operativo", created_by: (await service.auth.admin.listUsers()).data.users.find((user) => user.email === "superadmin@albatrans.local")?.id ?? "" }).select("id").single(); if (secondOrder.error) throw secondOrder.error;
    await command({ resource: "execution", action: "start", values: {} }, secondOrder.data.id);
    await expect(command({ resource: "execution", action: "transition", targetStatus: "loading", values: {} }, secondOrder.data.id)).rejects.toBeDefined();
  });
  it("serializa comandos concurrentes e impide reutilizar una key con otro payload", async () => {
    const users = await service.auth.admin.listUsers(); if (users.error) throw users.error; const actor = users.data.users.find((user) => user.email === "superadmin@albatrans.local"); if (!actor) throw new Error("Falta superadmin.");
    const created = await service.from("transport_orders").insert({ organization_id: organizationId, order_number: "PHASEC-3", customer_id: clientId, transport_type: "Operativo", created_by: actor.id }).select("id").single(); if (created.error) throw created.error;
    const idempotencyKey = "3c000000-0000-4000-8000-000000000010";
    const repeated = await Promise.all([command({ resource: "execution", action: "start", values: {}, idempotencyKey }, created.data.id), command({ resource: "execution", action: "start", values: {}, idempotencyKey }, created.data.id)]);
    expect(repeated[0]).toEqual(repeated[1]);
    const startEvents = await service.from("transport_events").select("id", { count: "exact", head: true }).eq("transport_order_id", created.data.id).eq("event_type", "execution.started"); if (startEvents.error) throw startEvents.error; expect(startEvents.count).toBe(1);
    await expect(command({ resource: "execution", action: "transition", targetStatus: "cancelled", values: {}, idempotencyKey }, created.data.id)).rejects.toBeDefined();
    for (const targetStatus of ["heading_to_pickup", "arrived_pickup", "loading"]) await command({ resource: "execution", action: "transition", targetStatus, values: {} }, created.data.id);
    const parallel = await Promise.allSettled([command({ resource: "execution", action: "transition", targetStatus: "loaded", values: {}, idempotencyKey: "3c000000-0000-4000-8000-000000000011" }, created.data.id), command({ resource: "execution", action: "transition", targetStatus: "arrived_delivery", values: {}, idempotencyKey: "3c000000-0000-4000-8000-000000000012" }, created.data.id)]);
    expect(parallel.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    const execution = await service.from("transport_executions").select("status").eq("transport_order_id", created.data.id).single(); if (execution.error) throw execution.error; expect(execution.data.status).toBe("loaded");
  }, 30_000);
});
async function command(body: Record<string, unknown>, targetOrderId = orderId) { const result = await platform.functions.invoke("transport-execution", { body: { organizationId, transportOrderId: targetOrderId, ...body } }); if (result.error) throw result.error; if (!record(result.data) || typeof result.data.entityId !== "string" || typeof result.data.executionId !== "string" || typeof result.data.eventType !== "string") throw new Error("Respuesta operativa inválida."); return { entityId: result.data.entityId, executionId: result.data.executionId, eventType: result.data.eventType }; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
