import { createClient } from "npm:@supabase/supabase-js@2.55.0";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
  "Content-Type": "application/json",
};
const respond = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
const fail = (status: number, code: string, message: string) => respond(status, { error: { code, message } });
const makeClient = (url: string, key: string) =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
type Client = ReturnType<typeof makeClient>;
type Scope = "platform" | "organization";
type Command = {
  organizationId: string;
  transportOrderId: string;
  resource: "execution" | "incident" | "note";
  action: "start" | "transition" | "create" | "update" | "archive";
  entityId?: string;
  targetStatus?: string;
  values: Record<string, string | boolean | null>;
  reason?: string;
  idempotencyKey: string;
};
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return fail(405, "invalid_request", "Método no permitido.");
  const bearer = request.headers.get("Authorization");
  if (!bearer?.startsWith("Bearer ")) return fail(401, "unauthorized", "Sesión requerida.");
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return fail(500, "configuration_error", "Servicio no configurado.");
  const db = makeClient(url, key), auth = await db.auth.getUser(bearer.slice(7));
  if (auth.error || !auth.data.user) return fail(401, "unauthorized", "Sesión no válida.");
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return fail(400, "invalid_request", "JSON inválido.");
  }
  const parsed = parse(input, request.headers.get("idempotency-key"));
  if (!parsed.ok) return fail(400, "invalid_request", parsed.message);
  const access = await authorize(db, auth.data.user.id, parsed.value.organizationId);
  if (!access.ok) return fail(access.status, access.code, access.message);
  const correlationId = crypto.randomUUID();
  const result = await db.rpc("execute_transport_operation", {
    p_actor_user_id: auth.data.user.id,
    p_actor_scope: access.scope,
    p_organization_id: parsed.value.organizationId,
    p_transport_order_id: parsed.value.transportOrderId,
    p_resource: parsed.value.resource,
    p_action: parsed.value.action,
    p_entity_id: parsed.value.entityId ?? null,
    p_target_status: parsed.value.targetStatus ?? null,
    p_values: parsed.value.values,
    p_reason: parsed.value.reason ?? null,
    p_correlation_id: correlationId,
    p_idempotency_key: parsed.value.idempotencyKey,
  });
  if (result.error) return databaseError(result.error.code, result.error.message);
  if (!record(result.data)) return fail(500, "invalid_result", "El comando no devolvió un resultado válido.");
  return respond(200, result.data);
});
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function uuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function parse(
  value: unknown,
  headerKey: string | null,
): { ok: true; value: Command } | { ok: false; message: string } {
  if (
    !record(value) || typeof value.organizationId !== "string" || typeof value.transportOrderId !== "string" ||
    !uuid(value.organizationId) || !uuid(value.transportOrderId) ||
    !["execution", "incident", "note"].includes(String(value.resource)) ||
    !["start", "transition", "create", "update", "archive"].includes(String(value.action)) ||
    (value.entityId !== undefined && (typeof value.entityId !== "string" || !uuid(value.entityId))) ||
    (value.targetStatus !== undefined && typeof value.targetStatus !== "string") ||
    (value.reason !== undefined && typeof value.reason !== "string") ||
    (value.values !== undefined && !record(value.values))
  ) return { ok: false, message: "Payload inválido." };
  const suppliedKey = typeof value.idempotencyKey === "string"
    ? value.idempotencyKey
    : headerKey ?? crypto.randomUUID();
  if (!uuid(suppliedKey)) return { ok: false, message: "idempotency_key debe ser un UUID válido." };
  const values = record(value.values) ? value.values : {};
  if (Object.values(values).some((item) => item !== null && typeof item !== "string" && typeof item !== "boolean")) {
    return { ok: false, message: "Valores inválidos." };
  }
  const resource = value.resource === "execution" ? "execution" : value.resource === "incident" ? "incident" : "note";
  const action =
    value.action === "start" || value.action === "transition" || value.action === "create" || value.action === "update"
      ? value.action
      : "archive";
  const allowed = resource === "incident"
    ? ["severity", "category", "status", "title", "description", "resolution_notes"]
    : resource === "note"
    ? ["note_type", "body", "visible_driver", "visible_customer", "visible_admin"]
    : [];
  if (Object.keys(values).some((field) => !allowed.includes(field))) {
    return { ok: false, message: "El payload contiene campos no permitidos." };
  }
  return {
    ok: true,
    value: {
      organizationId: value.organizationId,
      transportOrderId: value.transportOrderId,
      resource,
      action,
      entityId: typeof value.entityId === "string" ? value.entityId : undefined,
      targetStatus: typeof value.targetStatus === "string" ? value.targetStatus : undefined,
      values: values as Record<string, string | boolean | null>,
      reason: typeof value.reason === "string" ? value.reason.trim() : undefined,
      idempotencyKey: suppliedKey,
    },
  };
}
async function authorize(db: Client, userId: string, organizationId: string) {
  const [profile, platform, membership, organization, module] = await Promise.all([
    db.from("profiles").select("status").eq("user_id", userId).maybeSingle(),
    db.from("platform_admins").select("role,status").eq("user_id", userId).maybeSingle(),
    db.from("organization_memberships").select("organization_id,role,status").eq("user_id", userId).maybeSingle(),
    db.from("organizations").select("status").eq("id", organizationId).maybeSingle(),
    db.from("modules").select("id").eq("code", "transport_execution").single(),
  ]);
  if (profile.error || platform.error || membership.error || organization.error || module.error) {
    return deny(500, "access_check_failed", "No se pudo verificar el acceso.");
  }
  if (profile.data?.status !== "active") return deny(403, "forbidden", "Perfil inactivo.");
  if (platform.data?.role === "superadmin" && platform.data.status === "active") {
    return { ok: true as const, scope: "platform" as Scope };
  }
  if (
    organization.data?.status !== "active" || membership.data?.organization_id !== organizationId ||
    membership.data.role !== "admin_empresa" || membership.data.status !== "active"
  ) return deny(403, "forbidden", "Acceso empresarial no autorizado.");
  const [subscription, override] = await Promise.all([
    db.from("organization_subscriptions").select("plan_id").eq("organization_id", organizationId).maybeSingle(),
    db.from("organization_module_overrides").select("override_mode").eq("organization_id", organizationId).eq(
      "module_id",
      module.data.id,
    ).maybeSingle(),
  ]);
  if (subscription.error || override.error) return deny(500, "access_check_failed", "No se pudo resolver el módulo.");
  let enabled = override.data?.override_mode === "enabled";
  if (!override.data && subscription.data) {
    const plan = await db.from("plan_modules").select("enabled").eq("plan_id", subscription.data.plan_id).eq(
      "module_id",
      module.data.id,
    ).maybeSingle();
    if (plan.error) return deny(500, "access_check_failed", "No se pudo resolver el plan.");
    enabled = plan.data?.enabled === true;
  }
  if (override.data?.override_mode === "disabled" || !enabled) {
    return deny(403, "module_disabled", "Ejecución de transporte está desactivada.");
  }
  return { ok: true as const, scope: "organization" as Scope };
}
const deny = (status: number, code: string, message: string) => ({ ok: false as const, status, code, message });
function databaseError(code: string | undefined, message: string) {
  if (code === "23505") return fail(409, "idempotency_conflict", message);
  if (code === "P0002") return fail(404, "not_found", message);
  if (code === "42501") return fail(403, "forbidden", message);
  if (code === "23514" || code === "22P02" || code === "22023") return fail(409, "operation_rejected", message);
  return fail(500, "command_failed", "No se pudo ejecutar el comando atómico.");
}
