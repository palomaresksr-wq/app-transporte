import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
const resources = {
  drivers: {
    module: "transport_management",
    fields: [
      "membership_id",
      "employee_number",
      "internal_reference",
      "first_name",
      "last_name",
      "display_name",
      "email",
      "phone",
      "license_number",
      "license_expires_at",
      "employment_status",
      "active_from",
      "active_until",
      "notes",
    ],
  },
  clients: {
    module: "client_management",
    fields: [
      "legal_name",
      "trade_name",
      "tax_id",
      "email",
      "phone",
      "billing_email",
      "payment_terms_days",
      "status",
      "external_reference",
      "notes",
    ],
  },
  client_contacts: {
    module: "client_management",
    fields: [
      "client_id",
      "name",
      "role",
      "email",
      "phone",
      "is_primary",
      "notes",
    ],
  },
  locations: {
    module: "client_management",
    fields: [
      "client_id",
      "name",
      "address_line_1",
      "address_line_2",
      "postal_code",
      "city",
      "region",
      "country_code",
      "latitude",
      "longitude",
      "instructions",
      "status",
    ],
  },
  vehicles: {
    module: "vehicle_management",
    fields: [
      "registration_plate",
      "internal_code",
      "vehicle_type",
      "brand",
      "model",
      "capacity_kg",
      "capacity_m3",
      "status",
      "inspection_expires_at",
      "insurance_expires_at",
      "notes",
    ],
  },
  trailers: {
    module: "vehicle_management",
    fields: [
      "registration_plate",
      "internal_code",
      "trailer_type",
      "brand",
      "model",
      "capacity_kg",
      "capacity_m3",
      "status",
      "inspection_expires_at",
      "insurance_expires_at",
      "notes",
    ],
  },
  driver_vehicle_assignments: {
    module: "vehicle_management",
    fields: ["driver_id", "vehicle_id", "starts_at", "ends_at", "notes"],
  },
} as const;
type Resource = keyof typeof resources;
type Client = ReturnType<typeof adminClient>;
const adminClient = (url: string, key: string) =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") {
    return reply(405, {
      error: { code: "invalid_request", message: "Método no permitido." },
    });
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
  const db = adminClient(url, key),
    auth = await db.auth.getUser(bearer.slice(7));
  if (auth.error || !auth.data.user) {
    return fail(401, "unauthorized", "Sesión no válida.");
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_request", "JSON inválido.");
  }
  const parsed = parse(body);
  if (!parsed.ok) return fail(400, "invalid_request", parsed.message);
  const access = await authorize(
    db,
    auth.data.user.id,
    parsed.value.organizationId,
    resources[parsed.value.resource].module,
  );
  if (!access.ok) return fail(access.status, access.code, access.message);
  return execute(db, auth.data.user.id, access.scope, request, parsed.value);
});

type Command = {
  action: string;
  resource: Resource;
  organizationId: string;
  entityId?: string;
  values: Record<string, unknown>;
  reason?: string;
};
function parse(
  value: unknown,
): { ok: true; value: Command } | { ok: false; message: string } {
  if (
    !record(value) || typeof value.action !== "string" ||
    typeof value.resource !== "string" ||
    !(value.resource in resources) ||
    typeof value.organizationId !== "string" ||
    ("entityId" in value && typeof value.entityId !== "string") ||
    ("reason" in value && typeof value.reason !== "string") ||
    ("values" in value && !record(value.values))
  ) return { ok: false, message: "Payload inválido." };
  const resource = value.resource as Resource,
    values = record(value.values) ? value.values : {};
  if (
    Object.keys(values).some((k) => !resources[resource].fields.includes(k as never))
  ) {
    return { ok: false, message: "El payload contiene campos no permitidos." };
  }
  return {
    ok: true,
    value: {
      action: value.action,
      resource,
      organizationId: value.organizationId,
      entityId: typeof value.entityId === "string" ? value.entityId : undefined,
      values,
      reason: typeof value.reason === "string" ? value.reason : undefined,
    },
  };
}
async function authorize(
  db: Client,
  userId: string,
  orgId: string,
  module: string,
) {
  const [profile, platform, membership, organization, moduleRow] = await Promise
    .all([
      db.from("profiles").select("status").eq("user_id", userId).maybeSingle(),
      db.from("platform_admins").select("status,role").eq("user_id", userId)
        .maybeSingle(),
      db.from("organization_memberships").select("organization_id,role,status")
        .eq("user_id", userId).maybeSingle(),
      db.from("organizations").select("status").eq("id", orgId).maybeSingle(),
      db.from("modules").select("id").eq("code", module).single(),
    ]);
  if (
    profile.error || platform.error || membership.error || organization.error ||
    moduleRow.error
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
    membership.data?.organization_id !== orgId ||
    membership.data.role !== "admin_empresa" ||
    membership.data.status !== "active"
  ) return denial(403, "forbidden", "Acceso empresarial no autorizado.");
  const [subscription, override] = await Promise.all([
    db.from("organization_subscriptions").select("plan_id").eq(
      "organization_id",
      orgId,
    ).maybeSingle(),
    db.from("organization_module_overrides").select("override_mode").eq(
      "organization_id",
      orgId,
    ).eq(
      "module_id",
      moduleRow.data.id,
    ).maybeSingle(),
  ]);
  if (subscription.error || override.error) {
    return denial(500, "access_check_failed", "No se pudo resolver el módulo.");
  }
  let enabled = override.data?.override_mode === "enabled";
  if (
    override.data?.override_mode !== "enabled" &&
    override.data?.override_mode !== "disabled" && subscription.data
  ) {
    const plan = await db.from("plan_modules").select("enabled").eq(
      "plan_id",
      subscription.data.plan_id,
    ).eq(
      "module_id",
      moduleRow.data.id,
    ).maybeSingle();
    if (plan.error) {
      return denial(500, "access_check_failed", "No se pudo resolver el plan.");
    }
    enabled = plan.data?.enabled === true;
  }
  if (!enabled) {
    return denial(403, "module_disabled", "El módulo está desactivado.");
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
  actorScope: "platform" | "organization",
  request: Request,
  c: Command,
) {
  const table = c.resource;
  if (c.action === "create") {
    const values = normalized(c.values);
    const creationValues = table === "driver_vehicle_assignments"
      ? { ...values, organization_id: c.organizationId, assigned_by: actor }
      : { ...values, organization_id: c.organizationId, created_by: actor };
    const inserted = await db.from(table).insert(creationValues).select("*")
      .single();
    if (inserted.error) return databaseError(inserted.error);
    const event = eventName(table, "created", values);
    if (
      !await audit(
        db,
        actor,
        actorScope,
        request,
        { ...c, entityId: inserted.data.id },
        event,
        null,
        limited(inserted.data),
      )
    ) {
      await db.from(table).delete().eq("id", inserted.data.id);
      return fail(500, "audit_failed", "No se pudo auditar el cambio.");
    }
    return reply(200, {
      resource: table,
      organizationId: c.organizationId,
      entityId: inserted.data.id,
      action: c.action,
    });
  }
  if (!c.entityId) return fail(400, "invalid_request", "Falta entityId.");
  const before = await db.from(table).select("*").eq("id", c.entityId).eq(
    "organization_id",
    c.organizationId,
  )
    .maybeSingle();
  if (before.error) return databaseError(before.error);
  if (!before.data) return fail(404, "not_found", "Registro inexistente.");
  if (
    table === "driver_vehicle_assignments" && c.action !== "end_assignment"
  ) {
    return fail(
      400,
      "invalid_transition",
      "El historial de asignaciones es inmutable.",
    );
  }
  if (
    c.action !== "archive" &&
    (before.data.status === "archived" ||
      before.data.employment_status === "archived")
  ) {
    return fail(409, "archived", "Un registro archivado no puede modificarse.");
  }
  let values = normalized(c.values);
  if (c.action === "archive") {
    values = {
      ...("employment_status" in before.data ? { employment_status: "archived" } : { status: "archived" }),
      archived_at: new Date().toISOString(),
    };
  }
  if (c.action === "end_assignment") {
    if (table !== "driver_vehicle_assignments") {
      return fail(400, "invalid_request", "Acción inválida.");
    }
    values = { ends_at: values.ends_at };
  }
  const updated = await db.from(table).update(values).eq("id", c.entityId).eq(
    "organization_id",
    c.organizationId,
  )
    .select("*").single();
  if (updated.error) return databaseError(updated.error);
  const suffix = c.action === "end_assignment"
    ? "ended"
    : c.action === "archive"
    ? "archived"
    : statusEvent(before.data, updated.data) ?? "updated";
  if (
    !await audit(
      db,
      actor,
      actorScope,
      request,
      c,
      eventName(table, suffix, values),
      limited(before.data),
      limited(updated.data),
    )
  ) {
    await db.from(table).update(limited(before.data)).eq("id", c.entityId);
    return fail(500, "audit_failed", "No se pudo auditar el cambio.");
  }
  return reply(200, {
    resource: table,
    organizationId: c.organizationId,
    entityId: c.entityId,
    action: c.action,
  });
}
function normalized(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).map((
      [k, v],
    ) => [
      k,
      typeof v === "string" ? (v.trim() ? v.trim().replace(/\s+/g, " ") : null) : v,
    ]),
  );
}
function eventName(
  resource: Resource,
  suffix: string,
  values: Record<string, unknown>,
) {
  if (resource === "driver_vehicle_assignments") {
    return `driver_vehicle_assignment.${suffix}`;
  }
  if (resource === "client_contacts") return `client_contact.${suffix}`;
  const singular = resource.endsWith("s") ? resource.slice(0, -1) : resource;
  if (resource === "drivers" && suffix !== "created" && "membership_id" in values) {
    return values.membership_id ? "driver.membership_linked" : "driver.membership_unlinked";
  }
  return `${singular}.${suffix}`;
}
function statusEvent(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  const a = after.employment_status ?? after.status,
    b = before.employment_status ?? before.status;
  return a === b ? null : a === "active" ? "activated" : a === "inactive" ? "deactivated" : null;
}
async function audit(
  db: Client,
  actor: string,
  actorScope: "platform" | "organization",
  request: Request,
  c: Command,
  action: string,
  before: object | null,
  after: object,
) {
  const result = await db.from("audit_events").insert({
    organization_id: c.organizationId,
    actor_user_id: actor,
    actor_scope: actorScope,
    action,
    entity_type: c.resource,
    entity_id: c.entityId ?? null,
    before_data: before,
    after_data: after,
    reason: c.reason?.trim() || null,
    correlation_id: crypto.randomUUID(),
    user_agent: request.headers.get("user-agent"),
  });
  return !result.error;
}
function limited(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !["created_by", "updated_at", "created_at", "archived_at"].includes(key)),
  );
}
function databaseError(error: { code?: string; message: string }) {
  return fail(
    error.code === "23P01" ? 409 : 400,
    error.code === "23P01" ? "assignment_overlap" : "database_rejected",
    error.code === "23P01"
      ? "La asignaciÃ³n se solapa con otra existente."
      : "La base de datos rechazÃ³ la operaciÃ³n.",
  );
}
function record(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function fail(status: number, code: string, message: string) {
  return reply(status, { error: { code, message } });
}
