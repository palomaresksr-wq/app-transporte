import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const respond = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: cors });
const createAdminClient = (url: string, key: string) =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
type Client = ReturnType<typeof createAdminClient>;
type Identity = { email: string; displayName: string; phone: string; locale: string; timezone: string };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return respond(405, failure("invalid_request", "Método no permitido."));
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return respond(401, failure("unauthorized", "Sesión requerida."));
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return respond(500, failure("update_failed", "API no configurada."));
  const admin = createAdminClient(url, serviceKey);
  const user = await admin.auth.getUser(authorization.slice(7));
  if (user.error || !user.data.user) return respond(401, failure("unauthorized", "Sesión no válida."));
  const [profile, platform] = await Promise.all([
    admin.from("profiles").select("status").eq("user_id", user.data.user.id).maybeSingle(),
    admin.from("platform_admins").select("role,status").eq("user_id", user.data.user.id).maybeSingle(),
  ]);
  if (profile.error || platform.error) return respond(500, failure("update_failed", "No se pudo verificar el acceso."));
  if (profile.data?.status !== "active" || platform.data?.role !== "superadmin" || platform.data.status !== "active") {
    return respond(403, failure("forbidden", "Acceso exclusivo de superadministración."));
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond(400, failure("invalid_request", "JSON inválido."));
  }
  if (!record(body) || typeof body.action !== "string") {
    return respond(400, failure("invalid_request", "Solicitud inválida."));
  }
  if (body.action === "list") return listAdministrators(admin, body);
  if (body.action === "create") return createAdministrator(admin, user.data.user.id, request, body);
  if (body.action === "update") return updateAdministrator(admin, user.data.user.id, request, body);
  if (["activate", "deactivate", "reset_password", "resend_invitation", "delete"].includes(body.action)) {
    return administratorAction(admin, user.data.user.id, request, body);
  }
  return respond(400, failure("invalid_request", "Acción no permitida."));
});

async function listAdministrators(admin: Client, body: Record<string, unknown>): Promise<Response> {
  const organizationId = organizationRequest(body, ["action", "organizationId"]);
  if (!organizationId.ok) return organizationId.response;
  const memberships = await admin.from("organization_memberships").select("id,user_id,status,invited_by,created_at").eq(
    "organization_id",
    organizationId.value,
  ).eq("role", "admin_empresa").neq("status", "revoked").order("created_at");
  if (memberships.error) return respond(500, failure("update_failed", "No se pudieron cargar los administradores."));
  const ids = memberships.data.map((row) => row.user_id);
  const inviterIds = memberships.data.flatMap((row) => row.invited_by ? [row.invited_by] : []);
  const profileIds = [...new Set([...ids, ...inviterIds])];
  const profiles = profileIds.length
    ? await admin.from("profiles").select("user_id,display_name,phone,locale,timezone,status").in("user_id", profileIds)
    : { data: [], error: null };
  if (profiles.error) return respond(500, failure("update_failed", "No se pudieron cargar los perfiles."));
  const items = [];
  for (const membership of memberships.data) {
    const auth = await admin.auth.admin.getUserById(membership.user_id);
    if (auth.error || !auth.data.user) {
      return respond(500, failure("update_failed", "No se pudo cargar una identidad Auth."));
    }
    const person = profiles.data.find((row) => row.user_id === membership.user_id);
    if (!person) return respond(500, failure("update_failed", "Administrador sin perfil."));
    const creator = membership.invited_by ? profiles.data.find((row) => row.user_id === membership.invited_by) : null;
    items.push({
      membershipId: membership.id,
      userId: membership.user_id,
      organizationId: organizationId.value,
      email: auth.data.user.email ?? "",
      displayName: person.display_name,
      phone: person.phone ?? "",
      locale: person.locale,
      timezone: person.timezone,
      profileStatus: person.status,
      membershipStatus: membership.status,
      lastAccessAt: auth.data.user.last_sign_in_at ?? null,
      createdAt: auth.data.user.created_at,
      createdByUserId: membership.invited_by,
      createdByDisplayName: creator?.display_name ?? null,
    });
  }
  const limit = await administratorLimit(admin, organizationId.value);
  if (!limit.ok) return limit.response;
  return respond(200, { items, assignedCount: memberships.data.length, effectiveLimit: limit.value });
}

async function createAdministrator(
  admin: Client,
  actor: string,
  request: Request,
  body: Record<string, unknown>,
): Promise<Response> {
  if (
    !exactKeys(body, ["action", "organizationId", "administrator"]) || typeof body.organizationId !== "string" ||
    !uuid(body.organizationId) || !record(body.administrator)
  ) return respond(400, failure("invalid_request", "Solicitud de alta inválida."));
  const identity = parseIdentity(body.administrator);
  if (!identity.ok) return respond(400, failure("invalid_request", identity.message));
  const organization = await admin.from("organizations").select("id").eq("id", body.organizationId).maybeSingle();
  if (organization.error) return respond(500, failure("update_failed", "No se pudo consultar la empresa."));
  if (!organization.data) return respond(404, failure("not_found", "La empresa no existe."));
  const [limit, assigned] = await Promise.all([
    administratorLimit(admin, body.organizationId),
    admin.from("organization_memberships").select("id", { count: "exact", head: true }).eq(
      "organization_id",
      body.organizationId,
    ).eq("role", "admin_empresa").neq("status", "revoked"),
  ]);
  if (!limit.ok) return limit.response;
  if (assigned.error || assigned.count === null) {
    return respond(500, failure("update_failed", "No se pudo comprobar el límite."));
  }
  if (limit.value === null || assigned.count >= limit.value) {
    return respond(
      409,
      failure(
        "administrator_limit_reached",
        limit.value === null
          ? "La empresa no tiene configurado un límite de administradores."
          : `Se ha alcanzado el límite de ${limit.value} administradores.`,
      ),
    );
  }
  const invited = await admin.auth.admin.inviteUserByEmail(identity.value.email, {
    data: { display_name: identity.value.displayName },
    redirectTo: `${Deno.env.get("SITE_URL") ?? "http://localhost:5173"}/restablecer-contrasena`,
  });
  if (invited.error || !invited.data.user) {
    return respond(
      409,
      failure("administrator_conflict", invited.error?.message ?? "No se pudo invitar al administrador."),
    );
  }
  const userId = invited.data.user.id;
  const now = new Date().toISOString();
  const profile = await admin.from("profiles").insert({
    user_id: userId,
    display_name: identity.value.displayName,
    phone: nullable(identity.value.phone),
    locale: identity.value.locale,
    timezone: identity.value.timezone,
    status: "active",
  });
  if (profile.error) {
    await admin.auth.admin.deleteUser(userId);
    return respond(400, failure("update_failed", "No se pudo crear el perfil."));
  }
  const membership = await admin.from("organization_memberships").insert({
    organization_id: body.organizationId,
    user_id: userId,
    role: "admin_empresa",
    status: "invited",
    invited_by: actor,
    invited_at: now,
  }).select("id").single();
  if (membership.error) {
    await admin.from("profiles").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
    return respond(400, failure("update_failed", "No se pudo asignar la empresa."));
  }
  const audit = await insertAudit(admin, {
    organizationId: body.organizationId,
    actor,
    request,
    action: "organization.admin_created",
    userId,
    before: null,
    after: identityAudit(identity.value, "invited"),
    reason: null,
  });
  if (!audit.ok) {
    await admin.from("organization_memberships").delete().eq("id", membership.data.id);
    await admin.from("profiles").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
    return audit.response;
  }
  return respond(201, { userId });
}

async function updateAdministrator(
  admin: Client,
  actor: string,
  request: Request,
  body: Record<string, unknown>,
): Promise<Response> {
  if (
    !exactKeys(body, ["action", "organizationId", "userId", "administrator"]) ||
    typeof body.organizationId !== "string" || !uuid(body.organizationId) || typeof body.userId !== "string" ||
    !uuid(body.userId) || !record(body.administrator)
  ) return respond(400, failure("invalid_request", "Solicitud de edición inválida."));
  const identity = parseIdentity(body.administrator);
  if (!identity.ok) return respond(400, failure("invalid_request", identity.message));
  const target = await administratorTarget(admin, body.organizationId, body.userId);
  if (!target.ok) return target.response;
  const auth = await admin.auth.admin.getUserById(body.userId);
  if (auth.error || !auth.data.user?.email) return respond(404, failure("not_found", "No existe la identidad Auth."));
  const oldProfile = await admin.from("profiles").select("display_name,phone,locale,timezone,status").eq(
    "user_id",
    body.userId,
  ).single();
  if (oldProfile.error) return respond(500, failure("update_failed", "No se pudo cargar el perfil."));
  const authUpdate = await admin.auth.admin.updateUserById(body.userId, {
    email: identity.value.email,
    user_metadata: { ...auth.data.user.user_metadata, display_name: identity.value.displayName },
  });
  if (authUpdate.error) return respond(409, failure("administrator_conflict", authUpdate.error.message));
  const profileUpdate = await admin.from("profiles").update({
    display_name: identity.value.displayName,
    phone: nullable(identity.value.phone),
    locale: identity.value.locale,
    timezone: identity.value.timezone,
  }).eq("user_id", body.userId);
  if (profileUpdate.error) {
    await admin.auth.admin.updateUserById(body.userId, { email: auth.data.user.email });
    return respond(400, failure("update_failed", "No se pudo actualizar el perfil."));
  }
  const before = {
    email: auth.data.user.email,
    display_name: oldProfile.data.display_name,
    phone: oldProfile.data.phone,
    locale: oldProfile.data.locale,
    timezone: oldProfile.data.timezone,
    membership_status: target.data.status,
  };
  const after = identityAudit(identity.value, target.data.status);
  const audit = await insertAudit(admin, {
    organizationId: body.organizationId,
    actor,
    request,
    action: "organization.admin_updated",
    userId: body.userId,
    before,
    after,
    reason: null,
  });
  if (!audit.ok) {
    await admin.from("profiles").update(oldProfile.data).eq("user_id", body.userId);
    await admin.auth.admin.updateUserById(body.userId, { email: auth.data.user.email });
    return audit.response;
  }
  return respond(200, { userId: body.userId });
}

async function administratorAction(
  admin: Client,
  actor: string,
  request: Request,
  body: Record<string, unknown>,
): Promise<Response> {
  if (
    !exactKeys(body, ["action", "organizationId", "userId"]) || typeof body.organizationId !== "string" ||
    !uuid(body.organizationId) || typeof body.userId !== "string" || !uuid(body.userId)
  ) return respond(400, failure("invalid_request", "Solicitud de administrador inválida."));
  const target = await administratorTarget(admin, body.organizationId, body.userId);
  if (!target.ok) return target.response;
  if (body.action === "activate" || body.action === "deactivate") {
    return changeAdministratorStatus(admin, actor, request, body.organizationId, body.userId, target.data, body.action);
  }
  const auth = await admin.auth.admin.getUserById(body.userId);
  if (auth.error || !auth.data.user?.email) return respond(404, failure("not_found", "No existe la identidad Auth."));
  if (body.action === "reset_password" || body.action === "resend_invitation") {
    if (body.action === "resend_invitation" && target.data.status !== "invited") {
      return respond(409, failure("invalid_transition", "Solo se puede reenviar una invitación pendiente."));
    }
    const action = body.action === "reset_password"
      ? "organization.admin_password_reset_requested"
      : "organization.admin_invitation_resent";
    const audit = await insertAudit(admin, {
      organizationId: body.organizationId,
      actor,
      request,
      action,
      userId: body.userId,
      before: { email: auth.data.user.email, membership_status: target.data.status },
      after: { email: auth.data.user.email, membership_status: target.data.status },
      reason: null,
    });
    if (!audit.ok) return audit.response;
    const delivery = body.action === "reset_password"
      ? await admin.auth.resetPasswordForEmail(auth.data.user.email, {
        redirectTo: `${Deno.env.get("SITE_URL") ?? "http://localhost:5173"}/restablecer-contrasena`,
      })
      : await admin.auth.resend({
        type: "signup",
        email: auth.data.user.email,
        options: { emailRedirectTo: `${Deno.env.get("SITE_URL") ?? "http://localhost:5173"}/restablecer-contrasena` },
      });
    if (delivery.error) {
      await admin.from("audit_events").delete().eq("id", audit.id);
      return respond(502, failure("delivery_failed", delivery.error.message));
    }
    return respond(200, { userId: body.userId });
  }
  return deleteAdministrator(
    admin,
    actor,
    request,
    body.organizationId,
    body.userId,
    target.data,
    auth.data.user.email,
  );
}

async function changeAdministratorStatus(
  admin: Client,
  actor: string,
  request: Request,
  organizationId: string,
  userId: string,
  target: { id: string; status: string; joined_at: string | null; suspended_at: string | null },
  action: string,
): Promise<Response> {
  const status = action === "activate" ? "active" : "blocked";
  if (target.status === status) {
    return respond(409, failure("invalid_transition", `El administrador ya está ${status}.`));
  }
  const now = new Date().toISOString();
  const values = status === "active"
    ? { status, joined_at: target.joined_at ?? now, suspended_at: null }
    : { status, joined_at: target.joined_at ?? now, suspended_at: null };
  const updated = await admin.from("organization_memberships").update(values).eq("id", target.id);
  if (updated.error) return respond(400, failure("update_failed", "No se pudo cambiar el estado."));
  const audit = await insertAudit(admin, {
    organizationId,
    actor,
    request,
    action: status === "active" ? "organization.admin_activated" : "organization.admin_deactivated",
    userId,
    before: { membership_status: target.status },
    after: { membership_status: status },
    reason: null,
  });
  if (!audit.ok) {
    await admin.from("organization_memberships").update({
      status: target.status,
      joined_at: target.joined_at,
      suspended_at: target.suspended_at,
    }).eq("id", target.id);
    return audit.response;
  }
  return respond(200, { userId });
}

async function deleteAdministrator(
  admin: Client,
  actor: string,
  request: Request,
  organizationId: string,
  userId: string,
  target: { id: string; status: string; joined_at: string | null; suspended_at: string | null },
  email: string,
): Promise<Response> {
  const checks = await Promise.all([
    admin.from("legacy_identity_links").select("id", { count: "exact", head: true }).eq("membership_id", target.id),
    admin.from("organizations").select("id", { count: "exact", head: true }).or(
      `created_by.eq.${userId},status_changed_by.eq.${userId}`,
    ),
    admin.from("organization_memberships").select("id", { count: "exact", head: true }).eq("invited_by", userId).neq(
      "user_id",
      userId,
    ),
    admin.from("organization_module_overrides").select("module_id", { count: "exact", head: true }).eq(
      "changed_by",
      userId,
    ),
    admin.from("organization_limit_overrides").select("limit_definition_id", { count: "exact", head: true }).eq(
      "changed_by",
      userId,
    ),
    admin.from("platform_admins").select("user_id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  for (const check of checks) {
    if (check.error) return respond(500, failure("update_failed", "No se pudieron comprobar las dependencias."));
  }
  if (checks.some((check) => (check.count ?? 0) > 0)) {
    return respond(
      409,
      failure("administrator_dependencies", "El administrador tiene dependencias y no puede eliminarse."),
    );
  }
  const profile = await admin.from("profiles").select("display_name,phone,locale,timezone,status").eq("user_id", userId)
    .single();
  if (profile.error) return respond(500, failure("update_failed", "No se pudo cargar el perfil."));
  const audit = await insertAudit(admin, {
    organizationId,
    actor,
    request,
    action: "organization.admin_deleted",
    userId,
    before: { email, display_name: profile.data.display_name, membership_status: target.status },
    after: null,
    reason: null,
  });
  if (!audit.ok) return audit.response;
  const membershipDelete = await admin.from("organization_memberships").delete().eq("id", target.id);
  if (membershipDelete.error) {
    await admin.from("audit_events").delete().eq("id", audit.id);
    return respond(400, failure("update_failed", "No se pudo eliminar la asignación."));
  }
  const authDelete = await admin.auth.admin.deleteUser(userId);
  if (authDelete.error) {
    await admin.from("organization_memberships").insert({
      id: target.id,
      organization_id: organizationId,
      user_id: userId,
      role: "admin_empresa",
      status: target.status,
      joined_at: target.joined_at,
      suspended_at: target.suspended_at,
    });
    await admin.from("audit_events").delete().eq("id", audit.id);
    return respond(400, failure("update_failed", "No se pudo eliminar la identidad Auth."));
  }
  return respond(200, { userId });
}

async function administratorTarget(admin: Client, organizationId: string, userId: string) {
  const result = await admin.from("organization_memberships").select("id,status,joined_at,suspended_at").eq(
    "organization_id",
    organizationId,
  ).eq("user_id", userId).eq("role", "admin_empresa").maybeSingle();
  if (result.error) {
    return {
      ok: false as const,
      response: respond(500, failure("update_failed", "No se pudo consultar el administrador.")),
    };
  }
  if (!result.data) {
    return {
      ok: false as const,
      response: respond(404, failure("not_found", "El administrador no pertenece a la empresa.")),
    };
  }
  return { ok: true as const, data: result.data };
}
async function administratorLimit(admin: Client, organizationId: string) {
  const definition = await admin.from("limit_definitions").select("id").eq("code", "max_admins").single();
  if (definition.error) {
    return { ok: false as const, response: respond(500, failure("update_failed", "No se pudo cargar el límite.")) };
  }
  const [subscription, override] = await Promise.all([
    admin.from("organization_subscriptions").select("plan_id").eq("organization_id", organizationId).maybeSingle(),
    admin.from("organization_limit_overrides").select("override_mode,limit_value").eq("organization_id", organizationId)
      .eq("limit_definition_id", definition.data.id).maybeSingle(),
  ]);
  if (subscription.error || override.error) {
    return { ok: false as const, response: respond(500, failure("update_failed", "No se pudo resolver el límite.")) };
  }
  if (override.data?.override_mode === "custom") return { ok: true as const, value: override.data.limit_value };
  if (!subscription.data) return { ok: true as const, value: null };
  const plan = await admin.from("plan_limits").select("limit_value").eq("plan_id", subscription.data.plan_id).eq(
    "limit_definition_id",
    definition.data.id,
  ).maybeSingle();
  if (plan.error) {
    return {
      ok: false as const,
      response: respond(500, failure("update_failed", "No se pudo resolver el límite del plan.")),
    };
  }
  return { ok: true as const, value: plan.data?.limit_value ?? null };
}
async function insertAudit(
  admin: Client,
  input: {
    organizationId: string;
    actor: string;
    request: Request;
    action: string;
    userId: string;
    before: object | null;
    after: object | null;
    reason: string | null;
  },
) {
  const audit = await admin.from("audit_events").insert({
    organization_id: input.organizationId,
    actor_user_id: input.actor,
    actor_scope: "platform",
    action: input.action,
    entity_type: "organization_administrator",
    entity_id: input.userId,
    before_data: input.before,
    after_data: input.after,
    reason: input.reason,
    correlation_id: crypto.randomUUID(),
    user_agent: input.request.headers.get("user-agent"),
  }).select("id").single();
  if (audit.error) {
    return {
      ok: false as const,
      response: respond(500, failure("audit_failed", "No se pudo registrar la acción de forma auditable.")),
    };
  }
  return { ok: true as const, id: audit.data.id };
}
function organizationRequest(body: Record<string, unknown>, keys: readonly string[]) {
  if (!exactKeys(body, keys) || typeof body.organizationId !== "string" || !uuid(body.organizationId)) {
    return { ok: false as const, response: respond(400, failure("invalid_request", "organizationId no es válido.")) };
  }
  return { ok: true as const, value: body.organizationId };
}
function parseIdentity(value: Record<string, unknown>): { ok: true; value: Identity } | { ok: false; message: string } {
  const keys = ["email", "displayName", "phone", "locale", "timezone"] as const;
  if (!exactKeys(value, keys) || keys.some((key) => typeof value[key] !== "string")) {
    return { ok: false, message: "Los datos del administrador no son válidos." };
  }
  const identity = {
    email: text(value.email).toLowerCase(),
    displayName: text(value.displayName),
    phone: text(value.phone),
    locale: text(value.locale).toLowerCase(),
    timezone: text(value.timezone),
  };
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email) || !identity.displayName || !identity.locale ||
    !identity.timezone || identity.email.length > 254 || identity.displayName.length > 160 || identity.phone.length > 32
  ) return { ok: false, message: "Los datos del administrador no son válidos." };
  return { ok: true, value: identity };
}
function identityAudit(value: Identity, status: string) {
  return {
    email: value.email,
    display_name: value.displayName,
    phone: nullable(value.phone),
    locale: value.locale,
    timezone: value.timezone,
    membership_status: status,
  };
}
function failure(code: string, message: string) {
  return { error: { code, message } };
}
function nullable(value: string): string | null {
  return value || null;
}
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function uuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
}
