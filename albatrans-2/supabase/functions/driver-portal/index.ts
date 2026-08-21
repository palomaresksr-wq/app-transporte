import { createClient } from "npm:@supabase/supabase-js@2.55.0";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const out = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
const fail = (status: number, message: string) => out(status, { error: { message } });
const makeClient = (url: string, key: string) => createClient(url, key, { auth: { persistSession: false } });
type Db = ReturnType<typeof makeClient>;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return fail(405, "Método no permitido.");
  const bearer = req.headers.get("Authorization");
  if (!bearer?.startsWith("Bearer ")) return fail(401, "Sesión requerida.");
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return fail(500, "Servicio no configurado.");
  const db = makeClient(url, key), auth = await db.auth.getUser(bearer.slice(7));
  if (auth.error || !auth.data.user) return fail(401, "Sesión no válida.");
  const commandDb = createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { Authorization: bearer } },
  });
  let body: Record<string, unknown>;
  try {
    const value: unknown = await req.json();
    if (!record(value)) throw new Error();
    body = value;
  } catch {
    return fail(400, "JSON inválido.");
  }
  const access = await driverAccess(db, auth.data.user.id);
  if (!access.ok) return fail(access.status, access.message);
  const action = body.action;
  if (action === "list") return list(db, access.organizationId, access.driverId);
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  if (!uuid(orderId)) return fail(400, "orderId inválido.");
  if (!await assigned(db, orderId, access.organizationId, access.driverId)) {
    return fail(404, "Transporte no disponible.");
  }
  if (action === "detail") return detail(db, orderId, access.organizationId);
  if (action === "command") {
    if (!record(body.command)) return fail(400, "Comando inválido.");
    const command = body.command;
    const resource = String(command.resource),
      target = typeof command.targetStatus === "string" ? command.targetStatus : null,
      keyValue = String(command.idempotencyKey ?? "");
    if (!["execution", "incident", "note"].includes(resource) || !uuid(keyValue) || !record(command.values ?? {})) {
      return fail(400, "Comando inválido.");
    }
    const result = await commandDb.rpc("execute_driver_transport_operation", {
      p_actor: auth.data.user.id,
      p_org: access.organizationId,
      p_order: orderId,
      p_resource: resource,
      p_target: target,
      p_values: command.values ?? {},
      p_correlation: crypto.randomUUID(),
      p_key: keyValue,
    });
    if (result.error) {
      return fail(
        result.error.code === "42501" ? 403 : result.error.code === "23505" ? 409 : 400,
        result.error.message,
      );
    }
    return out(200, result.data);
  }
  return fail(400, "Acción no soportada.");
});
async function driverAccess(db: Db, userId: string) {
  const [p, m] = await Promise.all([
    db.from("profiles").select("status").eq("user_id", userId).maybeSingle(),
    db.from("organization_memberships").select("id,organization_id,role,status").eq("user_id", userId).maybeSingle(),
  ]);
  if (p.error || m.error) return { ok: false as const, status: 500, message: "No se pudo verificar el acceso." };
  if (p.data?.status !== "active" || m.data?.role !== "conductor" || m.data.status !== "active") {
    return { ok: false as const, status: 403, message: "Acceso de conductor inactivo." };
  }
  const [org, driver] = await Promise.all([
    db.from("organizations").select("status").eq("id", m.data.organization_id).single(),
    db.from("drivers").select("id,employment_status,archived_at").eq("membership_id", m.data.id).eq(
      "organization_id",
      m.data.organization_id,
    ).maybeSingle(),
  ]);
  if (org.data?.status !== "active" || driver.data?.employment_status !== "active" || driver.data.archived_at) {
    return { ok: false as const, status: 403, message: "Conductor u organización inactivos." };
  }
  for (const module of ["transport_management", "transport_execution"]) {
    if (!await moduleEnabled(db, m.data.organization_id, module)) {
      return { ok: false as const, status: 403, message: `Módulo ${module} desactivado.` };
    }
  }
  return { ok: true as const, organizationId: m.data.organization_id, driverId: driver.data.id };
}
async function moduleEnabled(db: Db, org: string, code: string) {
  const module = await db.from("modules").select("id").eq("code", code).single();
  if (!module.data) return false;
  const override = await db.from("organization_module_overrides").select("override_mode").eq("organization_id", org).eq(
    "module_id",
    module.data.id,
  ).maybeSingle();
  if (override.data) return override.data.override_mode === "enabled";
  const subscription = await db.from("organization_subscriptions").select("plan_id").eq("organization_id", org)
    .maybeSingle();
  if (!subscription.data) return false;
  const plan = await db.from("plan_modules").select("enabled").eq("plan_id", subscription.data.plan_id).eq(
    "module_id",
    module.data.id,
  ).maybeSingle();
  return plan.data?.enabled === true;
}
async function assigned(db: Db, order: string, org: string, driver: string) {
  const value = await db.from("transport_orders").select("id").eq("id", order).eq("organization_id", org).eq(
    "assigned_driver_id",
    driver,
  ).is("archived_at", null).maybeSingle();
  return Boolean(value.data);
}
async function list(db: Db, org: string, driver: string) {
  const orders = await db.from("transport_orders").select(
    "id,organization_id,order_number,priority,planned_pickup_at,planned_delivery_at",
  ).eq("organization_id", org).eq("assigned_driver_id", driver).is("archived_at", null).order("planned_pickup_at")
    .limit(30);
  if (orders.error) return fail(500, "No se pudieron cargar los transportes.");
  const ids = orders.data.map((x) => x.id);
  if (!ids.length) return out(200, []);
  const [executions, stops, items, incidents] = await Promise.all([
    db.from("transport_executions").select("transport_order_id,status").in("transport_order_id", ids),
    db.from("transport_stops").select("transport_order_id,position,location_id").in("transport_order_id", ids).order(
      "position",
    ),
    db.from("transport_items").select("transport_order_id,packages,weight_kg").in("transport_order_id", ids),
    db.from("transport_incidents").select("transport_order_id").in("transport_order_id", ids).in("status", [
      "open",
      "in_progress",
    ]),
  ]);
  const locationIds = [...new Set((stops.data ?? []).map((x) => x.location_id))];
  const locations = locationIds.length
    ? await db.from("locations").select("id,name,city").in("id", locationIds)
    : { data: [] };
  return out(
    200,
    orders.data.map((o) => {
      const ownStops = (stops.data ?? []).filter((s) => s.transport_order_id === o.id),
        ownItems = (items.data ?? []).filter((i) => i.transport_order_id === o.id),
        place = (id?: string) => {
          const l = (locations.data ?? []).find((x) => x.id === id);
          return l ? `${l.name} · ${l.city}` : "Sin dirección";
        };
      return {
        id: o.id,
        organizationId: o.organization_id,
        orderNumber: o.order_number,
        status: (executions.data ?? []).find((e) => e.transport_order_id === o.id)?.status ?? "pending",
        priority: o.priority,
        plannedPickupAt: o.planned_pickup_at,
        plannedDeliveryAt: o.planned_delivery_at,
        origin: place(ownStops[0]?.location_id),
        destination: place(ownStops.at(-1)?.location_id),
        packages: ownItems.reduce((n, i) => n + i.packages, 0),
        weightKg: ownItems.reduce((n, i) => n + Number(i.weight_kg ?? 0), 0),
        hasOpenIncident: (incidents.data ?? []).some((i) => i.transport_order_id === o.id),
      };
    }),
  );
}
async function detail(db: Db, orderId: string, org: string) {
  const regulatoryEnabled = await moduleEnabled(db, org, "electronic_delivery_notes");
  const [order, execution, stops, items, incidents, notes, policy, pods, signatures, regulatory] = await Promise.all([
    db.from("transport_orders").select(
      "id,organization_id,order_number,priority,planned_pickup_at,planned_delivery_at,assigned_vehicle_id,notes",
    ).eq("id", orderId).single(),
    db.from("transport_executions").select("*").eq("transport_order_id", orderId).single(),
    db.from("transport_stops").select("*").eq("transport_order_id", orderId).order("position"),
    db.from("transport_items").select("*").eq("transport_order_id", orderId),
    db.from("transport_incidents").select("*").eq("transport_order_id", orderId).order("reported_at", {
      ascending: false,
    }),
    db.from("transport_notes").select("*").eq("transport_order_id", orderId).eq("visible_driver", true).is(
      "archived_at",
      null,
    ),
    db.from("driver_completion_policies").select("require_pod,require_signature,require_document").eq(
      "organization_id",
      org,
    ).maybeSingle(),
    db.from("proofs_of_delivery").select("id,status").eq("transport_order_id", orderId),
    db.from("documents").select("id,current_version_id").eq("transport_order_id", orderId).eq("status", "available"),
    db.from("transport_regulatory_documents").select(
      "id,document_type,document_number,status,revision_number,document_id",
    ).eq("transport_order_id", orderId).eq("organization_id", org).order("created_at", { ascending: false }),
  ]);
  if (order.error || execution.error) return fail(500, "No se pudo cargar el transporte.");
  const locationIds = (stops.data ?? []).map((s) => s.location_id),
    locations = locationIds.length
      ? await db.from("locations").select("id,name,address_line_1,address_line_2,postal_code,city,latitude,longitude")
        .in("id", locationIds)
      : { data: [] };
  const vehicle = order.data.assigned_vehicle_id
    ? await db.from("vehicles").select("registration_plate").eq("id", order.data.assigned_vehicle_id).maybeSingle()
    : { data: null };
  const documentIds = (signatures.data ?? []).map((d) => d.id),
    signature = documentIds.length
      ? await db.from("document_signatures").select("id").in("document_id", documentIds).is("revoked_at", null).limit(1)
      : { data: [] };
  return out(200, {
    order: order.data,
    execution: execution.data,
    stops: (stops.data ?? []).map((s) => ({
      ...s,
      location: (locations.data ?? []).find((l) => l.id === s.location_id),
    })),
    items: items.data ?? [],
    incidents: incidents.data ?? [],
    notes: notes.data ?? [],
    vehiclePlate: vehicle.data?.registration_plate ?? null,
    policy: {
      requirePod: policy.data?.require_pod ?? false,
      requireSignature: policy.data?.require_signature ?? false,
      requireDocument: policy.data?.require_document ?? false,
    },
    facts: {
      hasPod: (pods.data ?? []).some((p) => ["captured", "confirmed"].includes(p.status)),
      hasSignature: Boolean(signature.data?.length),
      hasDocument: Boolean(signatures.data?.length),
      hasOpenCriticalIncident: (incidents.data ?? []).some((i) =>
        i.severity === "critical" && ["open", "in_progress"].includes(i.status)
      ),
    },
    regulatoryDocuments: regulatoryEnabled ? regulatory.data ?? [] : [],
  });
}
function record(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function uuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
