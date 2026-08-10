import { createClient } from "npm:@supabase/supabase-js@2.55.0";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const respond = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
const fail = (status: number, code: string, message: string) => respond(status, { error: { code, message } });
const tables = {
  order: "transport_orders",
  stop: "transport_stops",
  item: "transport_items",
  assignment: "transport_assignments",
} as const;
const fields = {
  order: [
    "customer_id",
    "priority",
    "transport_type",
    "billable_km",
    "planned_pickup_at",
    "planned_delivery_at",
    "requested_pickup_at",
    "requested_delivery_at",
    "notes",
  ],
  stop: [
    "position",
    "stop_type",
    "location_id",
    "customer_id",
    "window_starts_at",
    "window_ends_at",
    "status",
    "notes",
  ],
  item: [
    "stop_id",
    "description",
    "reference",
    "pallets",
    "packages",
    "weight_kg",
    "volume_m3",
    "is_adr",
    "temperature_min_c",
    "temperature_max_c",
    "notes",
  ],
  assignment: ["driver_id", "vehicle_id", "starts_at", "ends_at", "notes"],
} as const;
type Resource = keyof typeof tables;
type Client = ReturnType<typeof makeClient>;
type Command = {
  action: string;
  resource: Resource;
  organizationId: string;
  orderId?: string;
  entityId?: string;
  targetStatus?: string;
  values: Record<string, unknown>;
  reason?: string;
};
const makeClient = (url: string, key: string) =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") {
    return fail(405, "invalid_request", "Método no permitido.");
  }
  const bearer = request.headers.get("Authorization");
  if (!bearer?.startsWith("Bearer ")) {
    return fail(401, "unauthorized", "Sesión requerida.");
  }
  const url = Deno.env.get("SUPABASE_URL"),
    key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return fail(500, "configuration_error", "Servicio no configurado.");
  }
  const db = makeClient(url, key),
    auth = await db.auth.getUser(bearer.slice(7));
  if (auth.error || !auth.data.user) {
    return fail(401, "unauthorized", "Sesión no válida.");
  }
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return fail(400, "invalid_request", "JSON inválido.");
  }
  const parsed = parse(input);
  if (!parsed.ok) return fail(400, "invalid_request", parsed.message);
  const access = await authorize(
    db,
    auth.data.user.id,
    parsed.value.organizationId,
  );
  if (!access.ok) return fail(access.status, access.code, access.message);
  return execute(db, auth.data.user.id, access.scope, request, parsed.value);
});
function parse(
  value: unknown,
): { ok: true; value: Command } | { ok: false; message: string } {
  if (
    !record(value) || typeof value.action !== "string" ||
    typeof value.resource !== "string" || !(value.resource in tables) ||
    typeof value.organizationId !== "string" ||
    ("orderId" in value && typeof value.orderId !== "string") ||
    ("entityId" in value && typeof value.entityId !== "string") ||
    ("targetStatus" in value && typeof value.targetStatus !== "string") ||
    ("values" in value && !record(value.values)) ||
    ("reason" in value && typeof value.reason !== "string")
  ) return { ok: false, message: "Payload inválido." };
  const resource = value.resource as Resource,
    values = record(value.values) ? value.values : {};
  if (
    Object.keys(values).some((key) => !fields[resource].includes(key as never))
  ) return { ok: false, message: "El payload contiene campos no permitidos." };
  return {
    ok: true,
    value: {
      action: value.action,
      resource,
      organizationId: value.organizationId,
      orderId: typeof value.orderId === "string" ? value.orderId : undefined,
      entityId: typeof value.entityId === "string" ? value.entityId : undefined,
      targetStatus: typeof value.targetStatus === "string" ? value.targetStatus : undefined,
      values,
      reason: typeof value.reason === "string" ? value.reason : undefined,
    },
  };
}
async function authorize(db: Client, userId: string, organizationId: string) {
  const [profile, platform, membership, organization, module] = await Promise
    .all([
      db.from("profiles").select("status").eq("user_id", userId).maybeSingle(),
      db.from("platform_admins").select("role,status").eq("user_id", userId)
        .maybeSingle(),
      db.from("organization_memberships").select("organization_id,role,status")
        .eq("user_id", userId).maybeSingle(),
      db.from("organizations").select("status").eq("id", organizationId)
        .maybeSingle(),
      db.from("modules").select("id").eq("code", "transport_management")
        .single(),
    ]);
  if (
    profile.error || platform.error || membership.error || organization.error ||
    module.error
  ) {
    return denial(
      500,
      "access_check_failed",
      "No se pudo verificar el acceso.",
    );
  }
  if (profile.data?.status !== "active") {
    return denial(403, "forbidden", "Perfil inactivo.");
  }
  if (
    platform.data?.role === "superadmin" && platform.data.status === "active"
  ) return { ok: true as const, scope: "platform" as const };
  if (
    organization.data?.status !== "active" ||
    membership.data?.organization_id !== organizationId ||
    membership.data.role !== "admin_empresa" ||
    membership.data.status !== "active"
  ) return denial(403, "forbidden", "Acceso empresarial no autorizado.");
  const [subscription, override] = await Promise.all([
    db.from("organization_subscriptions").select("plan_id").eq(
      "organization_id",
      organizationId,
    ).maybeSingle(),
    db.from("organization_module_overrides").select("override_mode").eq(
      "organization_id",
      organizationId,
    ).eq("module_id", module.data.id).maybeSingle(),
  ]);
  if (subscription.error || override.error) {
    return denial(500, "access_check_failed", "No se pudo resolver el módulo.");
  }
  let enabled = override.data?.override_mode === "enabled";
  if (!override.data && subscription.data) {
    const plan = await db.from("plan_modules").select("enabled").eq(
      "plan_id",
      subscription.data.plan_id,
    ).eq("module_id", module.data.id).maybeSingle();
    if (plan.error) {
      return denial(500, "access_check_failed", "No se pudo resolver el plan.");
    }
    enabled = plan.data?.enabled === true;
  }
  if (override.data?.override_mode === "disabled" || !enabled) {
    return denial(
      403,
      "module_disabled",
      "El módulo de transportes está desactivado.",
    );
  }
  return { ok: true as const, scope: "organization" as const };
}
const denial = (status: number, code: string, message: string) => ({
  ok: false as const,
  status,
  code,
  message,
});
async function execute(
  db: Client,
  actor: string,
  scope: "platform" | "organization",
  request: Request,
  c: Command,
) {
  if (c.resource === "order" && c.action === "transition") {
    return transition(db, actor, scope, request, c);
  }
  if (c.resource === "assignment" && c.action === "assign") {
    return assign(db, actor, scope, request, c);
  }
  if (c.resource === "assignment" && c.action === "unassign") {
    return unassign(db, actor, scope, request, c);
  }
  if (!["create", "update"].includes(c.action)) {
    return fail(400, "invalid_request", "Acción no permitida.");
  }
  const table = tables[c.resource], values = normalize(c.values);
  let orderId = c.resource === "order" ? c.entityId ?? c.orderId : c.orderId;
  if (c.action === "create") {
    const insertValues = c.resource === "order"
      ? {
        ...values,
        organization_id: c.organizationId,
        order_number: "",
        created_by: actor,
      }
      : {
        ...values,
        organization_id: c.organizationId,
        transport_order_id: orderId,
        created_by: actor,
      };
    const inserted = await db.from(table).insert(insertValues).select("*")
      .single();
    if (inserted.error) return databaseError(inserted.error);
    orderId = c.resource === "order" ? inserted.data.id : orderId;
    if (!orderId) {
      await db.from(table).delete().eq("id", inserted.data.id);
      return fail(400, "invalid_request", "Falta orderId.");
    }
    const eventType = `${c.resource === "order" ? "transport" : c.resource}.created`;
    const recorded = await recordChange(
      db,
      actor,
      scope,
      request,
      c,
      orderId,
      inserted.data.id,
      eventType,
      null,
      safe(inserted.data),
    );
    if (!recorded) {
      await db.from(table).delete().eq("id", inserted.data.id);
      return fail(500, "audit_failed", "No se pudo registrar el evento.");
    }
    return success(c, orderId, inserted.data.id, eventType);
  }
  if (!c.entityId || !orderId) {
    return fail(400, "invalid_request", "Faltan identificadores.");
  }
  const before = await db.from(table).select("*").eq("id", c.entityId).eq(
    "organization_id",
    c.organizationId,
  ).maybeSingle();
  if (before.error) return databaseError(before.error);
  if (!before.data) return fail(404, "not_found", "Registro inexistente.");
  const order = await db.from("transport_orders").select("status").eq(
    "id",
    orderId,
  ).single();
  if (order.error) return databaseError(order.error);
  if (["completed", "cancelled", "archived"].includes(order.data.status)) {
    return fail(
      409,
      "terminal_order",
      "La orden terminal no puede modificarse.",
    );
  }
  const updated = await db.from(table).update(values).eq("id", c.entityId)
    .select("*").single();
  if (updated.error) return databaseError(updated.error);
  const eventType = `${c.resource === "order" ? "transport" : c.resource}.updated`;
  if (
    !await recordChange(
      db,
      actor,
      scope,
      request,
      c,
      orderId,
      c.entityId,
      eventType,
      safe(before.data),
      safe(updated.data),
    )
  ) {
    await db.from(table).update(safe(before.data)).eq("id", c.entityId);
    return fail(500, "audit_failed", "No se pudo registrar el evento.");
  }
  return success(c, orderId, c.entityId, eventType);
}
async function transition(
  db: Client,
  actor: string,
  scope: "platform" | "organization",
  request: Request,
  c: Command,
) {
  if (!c.entityId || !c.targetStatus) {
    return fail(400, "invalid_request", "Faltan orden o estado.");
  }
  const before = await db.from("transport_orders").select("*").eq(
    "id",
    c.entityId,
  ).eq("organization_id", c.organizationId).maybeSingle();
  if (before.error) return databaseError(before.error);
  if (!before.data) return fail(404, "not_found", "Orden inexistente.");
  const updated = await db.from("transport_orders").update({
    status: c.targetStatus,
  }).eq("id", c.entityId).select("*").single();
  if (updated.error) return databaseError(updated.error);
  const eventType = statusEvent(c.targetStatus);
  if (
    !await recordChange(
      db,
      actor,
      scope,
      request,
      c,
      c.entityId,
      c.entityId,
      eventType,
      safe(before.data),
      safe(updated.data),
    )
  ) {
    await db.from("transport_orders").update({
      status: before.data.status,
      archived_at: before.data.archived_at,
    }).eq("id", c.entityId);
    return fail(500, "audit_failed", "No se pudo registrar la transición.");
  }
  return success(c, c.entityId, c.entityId, eventType);
}
async function assign(
  db: Client,
  actor: string,
  scope: "platform" | "organization",
  request: Request,
  c: Command,
) {
  if (!c.orderId) return fail(400, "invalid_request", "Falta orderId.");
  const values = normalize(c.values),
    order = await db.from("transport_orders").select("*").eq("id", c.orderId)
      .eq("organization_id", c.organizationId).maybeSingle();
  if (order.error) return databaseError(order.error);
  if (!order.data) return fail(404, "not_found", "Orden inexistente.");
  if (order.data.status !== "planned") {
    return fail(
      409,
      "invalid_transition",
      "Solo puede asignarse una orden planificada.",
    );
  }
  const assignment = await db.from("transport_assignments").insert({
    ...values,
    organization_id: c.organizationId,
    transport_order_id: c.orderId,
    assigned_by: actor,
  }).select("*").single();
  if (assignment.error) return databaseError(assignment.error);
  const updated = await db.from("transport_orders").update({
    assigned_driver_id: values.driver_id,
    assigned_vehicle_id: values.vehicle_id,
    status: "assigned",
  }).eq("id", c.orderId).select("*").single();
  if (updated.error) {
    await db.from("transport_assignments").delete().eq(
      "id",
      assignment.data.id,
    );
    return databaseError(updated.error);
  }
  if (
    !await recordChange(
      db,
      actor,
      scope,
      request,
      c,
      c.orderId,
      assignment.data.id,
      "transport.assigned",
      safe(order.data),
      safe(updated.data),
    )
  ) {
    await db.from("transport_orders").update({
      assigned_driver_id: null,
      assigned_vehicle_id: null,
      status: "planned",
    }).eq("id", c.orderId);
    await db.from("transport_assignments").delete().eq(
      "id",
      assignment.data.id,
    );
    return fail(500, "audit_failed", "No se pudo auditar la asignación.");
  }
  return success(c, c.orderId, assignment.data.id, "transport.assigned");
}
async function unassign(
  db: Client,
  actor: string,
  scope: "platform" | "organization",
  request: Request,
  c: Command,
) {
  if (!c.orderId || !c.entityId) {
    return fail(400, "invalid_request", "Faltan identificadores.");
  }
  const order = await db.from("transport_orders").select("*").eq(
    "id",
    c.orderId,
  ).single();
  if (order.error) return databaseError(order.error);
  if (order.data.status !== "assigned") {
    return fail(
      409,
      "invalid_transition",
      "Solo puede retirarse una asignación antes de cargar.",
    );
  }
  const ended = await db.from("transport_assignments").update({
    unassigned_at: new Date().toISOString(),
  }).eq("id", c.entityId).eq("transport_order_id", c.orderId).is(
    "unassigned_at",
    null,
  ).select("*").single();
  if (ended.error) return databaseError(ended.error);
  const updated = await db.from("transport_orders").update({
    assigned_driver_id: null,
    assigned_vehicle_id: null,
    status: "planned",
  }).eq("id", c.orderId).select("*").single();
  if (updated.error) return databaseError(updated.error);
  if (
    !await recordChange(
      db,
      actor,
      scope,
      request,
      c,
      c.orderId,
      c.entityId,
      "transport.unassigned",
      safe(order.data),
      safe(updated.data),
    )
  ) {
    await db.from("transport_assignments").update({ unassigned_at: null }).eq(
      "id",
      c.entityId,
    );
    await db.from("transport_orders").update({
      assigned_driver_id: ended.data.driver_id,
      assigned_vehicle_id: ended.data.vehicle_id,
      status: "assigned",
    }).eq("id", c.orderId);
    return fail(500, "audit_failed", "No se pudo auditar la retirada.");
  }
  return success(c, c.orderId, c.entityId, "transport.unassigned");
}
async function recordChange(
  db: Client,
  actor: string,
  scope: "platform" | "organization",
  request: Request,
  c: Command,
  orderId: string,
  entityId: string,
  eventType: string,
  before: object | null,
  after: object,
) {
  const correlation = crypto.randomUUID();
  const audit = await db.from("audit_events").insert({
    organization_id: c.organizationId,
    actor_user_id: actor,
    actor_scope: scope,
    action: eventType,
    entity_type: `transport_${c.resource}`,
    entity_id: entityId,
    before_data: before,
    after_data: after,
    reason: c.reason?.trim() || null,
    correlation_id: correlation,
    user_agent: request.headers.get("user-agent"),
  });
  if (audit.error) return false;
  const event = await db.from("transport_events").insert({
    organization_id: c.organizationId,
    transport_order_id: orderId,
    event_type: eventType,
    actor_user_id: actor,
    entity_type: c.resource,
    entity_id: entityId,
    payload: { before, after, reason: c.reason?.trim() || null },
    correlation_id: correlation,
  });
  if (event.error) {
    await db.from("audit_events").delete().eq("correlation_id", correlation);
    return false;
  }
  return true;
}
const success = (
  c: Command,
  orderId: string,
  entityId: string,
  eventType: string,
) =>
  respond(200, {
    organizationId: c.organizationId,
    orderId,
    entityId,
    action: c.action,
    eventType,
  });
function statusEvent(status: string) {
  return ({
    planned: "transport.planned",
    assigned: "transport.assigned",
    loading: "transport.loading_started",
    in_transit: "transport.departed",
    unloading: "transport.unloading_started",
    completed: "transport.completed",
    cancelled: "transport.cancelled",
    archived: "transport.archived",
  } as Record<string, string>)[status] ?? "transport.updated";
}
function normalize(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      typeof value === "string" ? (value.trim() ? value.trim().replace(/\s+/g, " ") : null) : value,
    ]),
  );
}
function safe(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) =>
      !["created_by", "assigned_by", "updated_at", "created_at", "archived_at"]
        .includes(key)
    ),
  );
}
function databaseError(error: { code?: string }) {
  const conflict = error.code === "23P01";
  return fail(
    conflict ? 409 : 400,
    conflict ? "assignment_conflict" : "database_rejected",
    conflict ? "El conductor o vehículo ya está asignado en ese periodo." : "La base de datos rechazó la operación.",
  );
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
