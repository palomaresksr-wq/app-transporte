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
type Target = {
  id: string;
  status: string;
  joined_at: string | null;
  suspended_at: string | null;
  invited_by: string | null;
  invited_at: string | null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return respond(405, fail("invalid_request", "Método no permitido."));
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return respond(401, fail("unauthorized", "Sesión requerida."));
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return respond(500, fail("update_failed", "API no configurada."));
  const admin = createAdminClient(url, key);
  const auth = await admin.auth.getUser(authorization.slice(7));
  if (auth.error || !auth.data.user) return respond(401, fail("unauthorized", "Sesión no válida."));
  const [profile, platform] = await Promise.all([
    admin.from("profiles").select("status").eq("user_id", auth.data.user.id).maybeSingle(),
    admin.from("platform_admins").select("role,status").eq("user_id", auth.data.user.id).maybeSingle(),
  ]);
  if (profile.error || platform.error) return respond(500, fail("update_failed", "No se pudo verificar el acceso."));
  if (profile.data?.status !== "active" || platform.data?.role !== "superadmin" || platform.data.status !== "active") {
    return respond(403, fail("forbidden", "Acceso exclusivo de superadministración."));
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond(400, fail("invalid_request", "JSON inválido."));
  }
  if (!record(body) || typeof body.action !== "string") {
    return respond(400, fail("invalid_request", "Solicitud inválida."));
  }
  if (body.action === "list") return list(admin, body);
  if (body.action === "create") return create(admin, auth.data.user.id, request, body);
  if (body.action === "update") return update(admin, auth.data.user.id, request, body);
  if (["activate", "deactivate", "reset_password", "resend_invitation", "delete"].includes(body.action)) {
    return action(admin, auth.data.user.id, request, body);
  }
  return respond(400, fail("invalid_request", "Acción no permitida."));
});

async function list(admin: Client, body: Record<string, unknown>) {
  const organizationId = organization(body, ["action", "organizationId"]);
  if (!organizationId.ok) return organizationId.response;
  const memberships = await admin.from("organization_memberships").select("id,user_id,status,invited_by,created_at").eq(
    "organization_id",
    organizationId.value,
  ).eq("role", "conductor").neq("status", "revoked").order("created_at");
  if (memberships.error) return respond(500, fail("update_failed", "No se pudieron cargar los conductores."));
  const ids = memberships.data.map((row) => row.user_id);
  const inviters = memberships.data.flatMap((row) => row.invited_by ? [row.invited_by] : []);
  const profileIds = [...new Set([...ids, ...inviters])];
  const profiles = profileIds.length
    ? await admin.from("profiles").select("user_id,display_name,phone,locale,timezone,status").in("user_id", profileIds)
    : { data: [], error: null };
  if (profiles.error) return respond(500, fail("update_failed", "No se pudieron cargar los perfiles."));
  const items = [];
  for (const membership of memberships.data) {
    const user = await admin.auth.admin.getUserById(membership.user_id);
    if (user.error || !user.data.user) {
      return respond(500, fail("update_failed", "No se pudo cargar una identidad Auth."));
    }
    const person = profiles.data.find((row) => row.user_id === membership.user_id);
    if (!person) return respond(500, fail("update_failed", "Conductor sin perfil."));
    const creator = membership.invited_by ? profiles.data.find((row) => row.user_id === membership.invited_by) : null;
    items.push({
      membershipId: membership.id,
      userId: membership.user_id,
      organizationId: organizationId.value,
      email: user.data.user.email ?? "",
      displayName: person.display_name,
      phone: person.phone ?? "",
      locale: person.locale,
      timezone: person.timezone,
      profileStatus: person.status,
      membershipStatus: membership.status,
      accessActive: person.status === "active" && membership.status === "active",
      invitationPending: membership.status === "invited" && !user.data.user.email_confirmed_at,
      lastAccessAt: user.data.user.last_sign_in_at ?? null,
      createdAt: user.data.user.created_at,
      createdByUserId: membership.invited_by,
      createdByDisplayName: creator?.display_name ?? null,
    });
  }
  const limit = await driverLimit(admin, organizationId.value);
  if (!limit.ok) return limit.response;
  return respond(200, { items, assignedCount: memberships.data.length, effectiveLimit: limit.value });
}

async function create(admin: Client, actor: string, request: Request, body: Record<string, unknown>) {
  if (
    !exact(body, ["action", "organizationId", "driver"]) || typeof body.organizationId !== "string" ||
    !uuid(body.organizationId) || !record(body.driver)
  ) return respond(400, fail("invalid_request", "Solicitud de alta inválida."));
  const identity = parseIdentity(body.driver);
  if (!identity.ok) return respond(400, fail("invalid_request", identity.message));
  const organizationResult = await admin.from("organizations").select("id").eq("id", body.organizationId).maybeSingle();
  if (organizationResult.error) return respond(500, fail("update_failed", "No se pudo consultar la empresa."));
  if (!organizationResult.data) return respond(404, fail("not_found", "La empresa no existe."));
  const [limit, assigned] = await Promise.all([
    driverLimit(admin, body.organizationId),
    admin.from("organization_memberships").select("id", { count: "exact", head: true }).eq(
      "organization_id",
      body.organizationId,
    ).eq("role", "conductor").neq("status", "revoked"),
  ]);
  if (!limit.ok) return limit.response;
  if (assigned.error || assigned.count === null) {
    return respond(500, fail("update_failed", "No se pudo comprobar el límite."));
  }
  if (limit.value === null || assigned.count >= limit.value) {
    return respond(
      409,
      fail(
        "driver_limit_reached",
        limit.value === null
          ? "La empresa no tiene configurado un límite de conductores."
          : `Se ha alcanzado el límite de ${limit.value} conductores.`,
      ),
    );
  }
  const invited = await admin.auth.admin.inviteUserByEmail(identity.value.email, {
    data: { display_name: identity.value.displayName },
    redirectTo: `${Deno.env.get("SITE_URL") ?? "http://localhost:5173"}/restablecer-contrasena`,
  });
  if (invited.error || !invited.data.user) {
    return respond(409, fail("driver_conflict", invited.error?.message ?? "No se pudo invitar al conductor."));
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
    return respond(400, fail("update_failed", "No se pudo crear el perfil."));
  }
  const membership = await admin.from("organization_memberships").insert({
    organization_id: body.organizationId,
    user_id: userId,
    role: "conductor",
    status: "invited",
    invited_by: actor,
    invited_at: now,
  }).select("id").single();
  if (membership.error) {
    await admin.from("profiles").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
    return respond(400, fail("update_failed", "No se pudo asignar la empresa."));
  }
  const invitedAudit = await audit(admin, {
    organizationId: body.organizationId,
    actor,
    request,
    action: "organization.driver_invited",
    userId,
    before: null,
    after: identityAudit(identity.value, "invited"),
  });
  if (!invitedAudit.ok) {
    await rollbackCreated(admin, membership.data.id, userId);
    return invitedAudit.response;
  }
  const createdAudit = await audit(admin, {
    organizationId: body.organizationId,
    actor,
    request,
    action: "organization.driver_created",
    userId,
    before: null,
    after: identityAudit(identity.value, "invited"),
  });
  if (!createdAudit.ok) {
    await admin.from("audit_events").delete().eq("id", invitedAudit.id);
    await rollbackCreated(admin, membership.data.id, userId);
    return createdAudit.response;
  }
  return respond(201, { userId });
}

async function update(admin: Client, actor: string, request: Request, body: Record<string, unknown>) {
  if (
    !exact(body, ["action", "organizationId", "userId", "driver"]) || typeof body.organizationId !== "string" ||
    !uuid(body.organizationId) || typeof body.userId !== "string" || !uuid(body.userId) || !record(body.driver)
  ) return respond(400, fail("invalid_request", "Solicitud de edición inválida."));
  const identity = parseIdentity(body.driver);
  if (!identity.ok) return respond(400, fail("invalid_request", identity.message));
  const target = await targetDriver(admin, body.organizationId, body.userId);
  if (!target.ok) return target.response;
  const user = await admin.auth.admin.getUserById(body.userId);
  if (user.error || !user.data.user?.email) return respond(404, fail("not_found", "No existe la identidad Auth."));
  const oldProfile = await admin.from("profiles").select("display_name,phone,locale,timezone,status").eq(
    "user_id",
    body.userId,
  ).single();
  if (oldProfile.error) return respond(500, fail("update_failed", "No se pudo cargar el perfil."));
  const authUpdate = await admin.auth.admin.updateUserById(body.userId, {
    email: identity.value.email,
    user_metadata: { ...user.data.user.user_metadata, display_name: identity.value.displayName },
  });
  if (authUpdate.error) return respond(409, fail("driver_conflict", authUpdate.error.message));
  const profileUpdate = await admin.from("profiles").update({
    display_name: identity.value.displayName,
    phone: nullable(identity.value.phone),
    locale: identity.value.locale,
    timezone: identity.value.timezone,
  }).eq("user_id", body.userId);
  if (profileUpdate.error) {
    await admin.auth.admin.updateUserById(body.userId, { email: user.data.user.email });
    return respond(400, fail("update_failed", "No se pudo actualizar el perfil."));
  }
  const event = await audit(admin, {
    organizationId: body.organizationId,
    actor,
    request,
    action: "organization.driver_updated",
    userId: body.userId,
    before: {
      email: user.data.user.email,
      display_name: oldProfile.data.display_name,
      phone: oldProfile.data.phone,
      locale: oldProfile.data.locale,
      timezone: oldProfile.data.timezone,
      membership_status: target.data.status,
    },
    after: identityAudit(identity.value, target.data.status),
  });
  if (!event.ok) {
    await admin.from("profiles").update(oldProfile.data).eq("user_id", body.userId);
    await admin.auth.admin.updateUserById(body.userId, { email: user.data.user.email });
    return event.response;
  }
  return respond(200, { userId: body.userId });
}

async function action(admin: Client, actor: string, request: Request, body: Record<string, unknown>) {
  if (
    !exact(body, ["action", "organizationId", "userId"]) || typeof body.organizationId !== "string" ||
    !uuid(body.organizationId) || typeof body.userId !== "string" || !uuid(body.userId)
  ) return respond(400, fail("invalid_request", "Solicitud de conductor inválida."));
  const target = await targetDriver(admin, body.organizationId, body.userId);
  if (!target.ok) return target.response;
  if (body.action === "activate" || body.action === "deactivate") {
    return changeStatus(admin, actor, request, body.organizationId, body.userId, target.data, body.action);
  }
  const user = await admin.auth.admin.getUserById(body.userId);
  if (user.error || !user.data.user?.email) return respond(404, fail("not_found", "No existe la identidad Auth."));
  if (body.action === "reset_password" || body.action === "resend_invitation") {
    if (body.action === "resend_invitation" && target.data.status !== "invited") {
      return respond(409, fail("invalid_transition", "Solo se puede reenviar una invitación pendiente."));
    }
    const eventAction = body.action === "reset_password"
      ? "organization.driver_password_reset_requested"
      : "organization.driver_invitation_resent";
    const event = await audit(admin, {
      organizationId: body.organizationId,
      actor,
      request,
      action: eventAction,
      userId: body.userId,
      before: { email: user.data.user.email, membership_status: target.data.status },
      after: { email: user.data.user.email, membership_status: target.data.status },
    });
    if (!event.ok) return event.response;
    const delivery = body.action === "reset_password"
      ? await admin.auth.resetPasswordForEmail(user.data.user.email, {
        redirectTo: `${Deno.env.get("SITE_URL") ?? "http://localhost:5173"}/restablecer-contrasena`,
      })
      : await admin.auth.resend({
        type: "signup",
        email: user.data.user.email,
        options: { emailRedirectTo: `${Deno.env.get("SITE_URL") ?? "http://localhost:5173"}/restablecer-contrasena` },
      });
    if (delivery.error) {
      await admin.from("audit_events").delete().eq("id", event.id);
      return respond(502, fail("delivery_failed", delivery.error.message));
    }
    return respond(200, { userId: body.userId });
  }
  return deleteDriver(admin, actor, request, body.organizationId, body.userId, target.data, user.data.user.email);
}

async function changeStatus(
  admin: Client,
  actor: string,
  request: Request,
  organizationId: string,
  userId: string,
  target: Target,
  requested: string,
) {
  const status = requested === "activate" ? "active" : "blocked";
  if (target.status === status) return respond(409, fail("invalid_transition", `El conductor ya está ${status}.`));
  const now = new Date().toISOString();
  const values = { status, joined_at: target.joined_at ?? now, suspended_at: null };
  const changed = await admin.from("organization_memberships").update(values).eq("id", target.id);
  if (changed.error) return respond(400, fail("update_failed", "No se pudo cambiar el estado."));
  const event = await audit(admin, {
    organizationId,
    actor,
    request,
    action: status === "active" ? "organization.driver_activated" : "organization.driver_deactivated",
    userId,
    before: { membership_status: target.status },
    after: { membership_status: status },
  });
  if (!event.ok) {
    await restoreMembership(admin, organizationId, userId, target);
    return event.response;
  }
  return respond(200, { userId });
}

async function deleteDriver(
  admin: Client,
  actor: string,
  request: Request,
  organizationId: string,
  userId: string,
  target: Target,
  email: string,
) {
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
    if (check.error) return respond(500, fail("update_failed", "No se pudieron comprobar las dependencias."));
  }
  if (checks.some((check) => (check.count ?? 0) > 0)) {
    if (target.status !== "blocked") {
      const changed = await admin.from("organization_memberships").update({
        status: "blocked",
        joined_at: target.joined_at ?? new Date().toISOString(),
        suspended_at: null,
      }).eq("id", target.id);
      if (changed.error) return respond(500, fail("update_failed", "No se pudo desactivar el conductor."));
    }
    const rejected = await audit(admin, {
      organizationId,
      actor,
      request,
      action: "organization.driver_delete_rejected",
      userId,
      before: { email, membership_status: target.status },
      after: { email, membership_status: "blocked" },
    });
    if (!rejected.ok) {
      await restoreMembership(admin, organizationId, userId, target);
      return rejected.response;
    }
    return respond(
      409,
      fail("driver_dependencies", "El conductor tiene dependencias, se ha desactivado y no puede eliminarse."),
    );
  }
  const profile = await admin.from("profiles").select("display_name,phone,locale,timezone,status").eq("user_id", userId)
    .single();
  if (profile.error) return respond(500, fail("update_failed", "No se pudo cargar el perfil."));
  const event = await audit(admin, {
    organizationId,
    actor,
    request,
    action: "organization.driver_deleted",
    userId,
    before: { email, display_name: profile.data.display_name, membership_status: target.status },
    after: null,
  });
  if (!event.ok) return event.response;
  const removed = await admin.from("organization_memberships").delete().eq("id", target.id);
  if (removed.error) {
    await admin.from("audit_events").delete().eq("id", event.id);
    return respond(400, fail("update_failed", "No se pudo eliminar la asignación."));
  }
  const authDelete = await admin.auth.admin.deleteUser(userId);
  if (authDelete.error) {
    await restoreMembership(admin, organizationId, userId, target);
    await admin.from("audit_events").delete().eq("id", event.id);
    return respond(400, fail("update_failed", "No se pudo eliminar la identidad Auth."));
  }
  return respond(200, { userId });
}

async function targetDriver(admin: Client, organizationId: string, userId: string) {
  const result = await admin.from("organization_memberships").select(
    "id,status,joined_at,suspended_at,invited_by,invited_at",
  ).eq("organization_id", organizationId).eq("user_id", userId).eq("role", "conductor").maybeSingle();
  if (result.error) {
    return { ok: false as const, response: respond(500, fail("update_failed", "No se pudo consultar el conductor.")) };
  }
  if (!result.data) {
    return { ok: false as const, response: respond(404, fail("not_found", "El conductor no pertenece a la empresa.")) };
  }
  return { ok: true as const, data: result.data };
}
async function driverLimit(admin: Client, organizationId: string) {
  const definition = await admin.from("limit_definitions").select("id").eq("code", "max_drivers").single();
  if (definition.error) {
    return { ok: false as const, response: respond(500, fail("update_failed", "No se pudo cargar el límite.")) };
  }
  const [subscription, override] = await Promise.all([
    admin.from("organization_subscriptions").select("plan_id").eq("organization_id", organizationId).maybeSingle(),
    admin.from("organization_limit_overrides").select("override_mode,limit_value").eq("organization_id", organizationId)
      .eq("limit_definition_id", definition.data.id).maybeSingle(),
  ]);
  if (subscription.error || override.error) {
    return { ok: false as const, response: respond(500, fail("update_failed", "No se pudo resolver el límite.")) };
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
      response: respond(500, fail("update_failed", "No se pudo resolver el límite del plan.")),
    };
  }
  return { ok: true as const, value: plan.data?.limit_value ?? null };
}
async function audit(
  admin: Client,
  input: {
    organizationId: string;
    actor: string;
    request: Request;
    action: string;
    userId: string;
    before: object | null;
    after: object | null;
  },
) {
  const result = await admin.from("audit_events").insert({
    organization_id: input.organizationId,
    actor_user_id: input.actor,
    actor_scope: "platform",
    action: input.action,
    entity_type: "organization_driver",
    entity_id: input.userId,
    before_data: input.before,
    after_data: input.after,
    reason: null,
    correlation_id: crypto.randomUUID(),
    user_agent: input.request.headers.get("user-agent"),
  }).select("id").single();
  if (result.error) {
    return {
      ok: false as const,
      response: respond(500, fail("audit_failed", "No se pudo registrar la acción de forma auditable.")),
    };
  }
  return { ok: true as const, id: result.data.id };
}
async function rollbackCreated(admin: Client, membershipId: string, userId: string) {
  await admin.from("organization_memberships").delete().eq("id", membershipId);
  await admin.from("profiles").delete().eq("user_id", userId);
  await admin.auth.admin.deleteUser(userId);
}
async function restoreMembership(admin: Client, organizationId: string, userId: string, target: Target) {
  await admin.from("organization_memberships").upsert({
    id: target.id,
    organization_id: organizationId,
    user_id: userId,
    role: "conductor",
    status: target.status,
    joined_at: target.joined_at,
    suspended_at: target.suspended_at,
    invited_by: target.invited_by,
    invited_at: target.invited_at,
  });
}
function organization(body: Record<string, unknown>, keys: readonly string[]) {
  if (!exact(body, keys) || typeof body.organizationId !== "string" || !uuid(body.organizationId)) {
    return { ok: false as const, response: respond(400, fail("invalid_request", "organizationId no es válido.")) };
  }
  return { ok: true as const, value: body.organizationId };
}
function parseIdentity(value: Record<string, unknown>): { ok: true; value: Identity } | { ok: false; message: string } {
  const keys = ["email", "displayName", "phone", "locale", "timezone"] as const;
  if (!exact(value, keys) || keys.some((key) => typeof value[key] !== "string")) {
    return { ok: false, message: "Los datos del conductor no son válidos." };
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
  ) return { ok: false, message: "Los datos del conductor no son válidos." };
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
function fail(code: string, message: string) {
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
function exact(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
}
