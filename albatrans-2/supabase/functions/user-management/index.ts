import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type,idempotency-key",
  "Content-Type": "application/json",
};
const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
const fail = (status: number, code: string, message: string) => reply(status, { error: { code, message } });
const makeClient = (url: string, key: string) =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
type Db = ReturnType<typeof makeClient>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return fail(405, "method", "Método no permitido.");
  const bearer = req.headers.get("Authorization");
  if (!bearer?.startsWith("Bearer ")) return fail(401, "unauthorized", "Sesión requerida.");
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return fail(500, "config", "Servicio no configurado.");
  const db = makeClient(url, key), auth = await db.auth.getUser(bearer.slice(7));
  if (auth.error || !auth.data.user) return fail(401, "unauthorized", "Sesión no válida.");
  let body: Record<string, unknown>;
  try {
    const raw: unknown = await req.json();
    if (!record(raw)) throw new Error();
    body = raw;
  } catch {
    return fail(400, "payload", "JSON inválido.");
  }
  const actor = auth.data.user.id,
    action = text(body.action),
    access = await authorize(db, actor, typeof body.organizationId === "string" ? body.organizationId : null);
  if (!access.ok) return fail(access.status, "forbidden", access.message);
  try {
    if (action === "list") return listUsers(db, access.organizationId);
    if (action === "create_user") return createUser(db, actor, access.organizationId, body);
    if (action === "update_user") return updateUser(db, actor, access.organizationId, requiredUuid(body.userId), body);
    if (["block_user", "reactivate_user", "deactivate_user"].includes(action)) {
      return changeStatus(db, actor, access.organizationId, action, requiredUuid(body.userId));
    }
    if (action === "reset_password") {
      return resetPassword(db, actor, access.organizationId, requiredUuid(body.userId), body);
    }
    if (action === "confirm_initial_password") return confirmInitialPassword(db, actor, access.organizationId);
    return fail(400, "action", "Acción no soportada.");
  } catch (error) {
    return fail(400, "request", error instanceof Error ? error.message : "Operación inválida.");
  }
});

async function authorize(db: Db, actor: string, requestedOrg: string | null) {
  const [profile, platform, membership] = await Promise.all([
    db.from("profiles").select("status").eq("user_id", actor).maybeSingle(),
    db.from("platform_admins").select("role,status").eq("user_id", actor).maybeSingle(),
    db.from("organization_memberships").select("organization_id,role,status").eq("user_id", actor).maybeSingle(),
  ]);
  if (profile.data?.status !== "active") return { ok: false as const, status: 403, message: "Perfil bloqueado." };
  if (platform.data?.role === "superadmin" && platform.data.status === "active") {
    if (!requestedOrg || !uuid(requestedOrg)) return { ok: false as const, status: 400, message: "Empresa requerida." };
    const org = await db.from("organizations").select("status").eq("id", requestedOrg).maybeSingle();
    if (!org.data) return { ok: false as const, status: 404, message: "Empresa inexistente." };
    if (org.data.status !== "active") return { ok: false as const, status: 403, message: "Empresa inactiva." };
    return { ok: true as const, organizationId: requestedOrg, scope: "platform" as const };
  }
  if (!membership.data || membership.data.role !== "admin_empresa" || membership.data.status !== "active") {
    return { ok: false as const, status: 403, message: "Acceso exclusivo de administración." };
  }
  if (requestedOrg && requestedOrg !== membership.data.organization_id) {
    return { ok: false as const, status: 403, message: "No puedes administrar otra empresa." };
  }
  const org = await db.from("organizations").select("status").eq("id", membership.data.organization_id).single();
  if (org.data?.status !== "active") return { ok: false as const, status: 403, message: "Empresa inactiva." };
  return { ok: true as const, organizationId: membership.data.organization_id, scope: "organization" as const };
}

async function listUsers(db: Db, org: string) {
  const lifecycle = await db.from("company_user_lifecycle").select("*").eq("organization_id", org).order("created_at");
  if (lifecycle.error) return database(lifecycle.error);
  const ids = lifecycle.data.map((row) => row.user_id),
    memberships = ids.length
      ? await db.from("organization_memberships").select("user_id,role,status").in("user_id", ids)
      : { data: [], error: null },
    profiles = ids.length
      ? await db.from("profiles").select("user_id,display_name,phone,status").in("user_id", ids)
      : { data: [], error: null };
  if (memberships.error || profiles.error) return database(memberships.error || profiles.error!);
  const items = [];
  for (const row of lifecycle.data) {
    const identity = await db.auth.admin.getUserById(row.user_id);
    if (identity.error || !identity.data.user) continue;
    const membership = memberships.data.find((value) => value.user_id === row.user_id),
      profile = profiles.data.find((value) => value.user_id === row.user_id);
    items.push({
      userId: row.user_id,
      organizationId: org,
      firstName: row.first_name,
      lastName: row.last_name,
      displayName: profile?.display_name ?? `${row.first_name} ${row.last_name}`,
      email: identity.data.user.email ?? "",
      phone: profile?.phone ?? null,
      role: membership?.role,
      profileStatus: profile?.status,
      membershipStatus: membership?.status,
      lifecycleStatus: row.status,
      mustChangePassword: row.must_change_password,
      lastAccessAt: identity.data.user.last_sign_in_at ?? null,
      createdAt: row.created_at,
    });
  }
  return reply(200, { items });
}

async function createUser(db: Db, actor: string, org: string, body: Record<string, unknown>) {
  const first = requiredText(body.firstName),
    last = requiredText(body.lastName),
    email = requiredEmail(body.email),
    phone = typeof body.phone === "string" ? body.phone.trim() : "",
    password = requiredPassword(body.password),
    role = body.role === "admin_empresa" ? "admin_empresa" : body.role === "conductor" ? "conductor" : "";
  if (!role) throw new Error("Rol empresarial no permitido.");
  const idempotencyKey = requiredUuid(body.idempotencyKey),
    passwordDigest = await sha(password),
    requestHash = await sha(
      JSON.stringify({
        first,
        last,
        email,
        phone,
        role,
        mustChangePassword: body.mustChangePassword !== false,
        passwordDigest,
      }),
    );
  const prepared = await db.rpc("prepare_company_user_command", {
    p_actor: actor,
    p_org: org,
    p_role: role,
    p_key: idempotencyKey,
    p_hash: requestHash,
  });
  if (prepared.error) return database(prepared.error);
  const prep = record(prepared.data) ? prepared.data : {};
  if (record(prep.result)) return reply(200, { ...prep.result, idempotent: true });
  const commandId = requiredUuid(prep.commandId);
  let authUser: string | null = null;
  try {
    const created = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: `${first} ${last}` },
    });
    if (created.error || !created.data.user) throw new Error(created.error?.message ?? "No se pudo crear Auth.");
    authUser = created.data.user.id;
    const completed = await db.rpc("complete_company_user_command", {
      p_actor: actor,
      p_command: commandId,
      p_user: authUser,
      p_first: first,
      p_last: last,
      p_email: email,
      p_phone: phone,
      p_must_change: body.mustChangePassword !== false,
    });
    if (completed.error) throw new Error(completed.error.message);
    return reply(201, record(completed.data) ? completed.data : {});
  } catch (error) {
    if (authUser) {
      const removed = await db.auth.admin.deleteUser(authUser);
      await db.rpc("mark_company_user_command_failure", {
        p_actor: actor,
        p_command: commandId,
        p_status: removed.error ? "reconciliation_required" : "compensated",
        p_code: removed.error ? "auth_compensation_failed" : "database_completion_failed",
      });
    } else {await db.rpc("mark_company_user_command_failure", {
        p_actor: actor,
        p_command: commandId,
        p_status: "compensated",
        p_code: "auth_creation_failed",
      });}
    throw error;
  }
}

async function changeStatus(db: Db, actor: string, org: string, action: string, userId: string) {
  const target = await targetUser(db, org, userId),
    blocked = action !== "reactivate_user",
    deactivated = action === "deactivate_user";
  const auth = await db.auth.admin.updateUserById(userId, { ban_duration: blocked ? "876000h" : "none" });
  if (auth.error) return database(auth.error);
  const lifecycleStatus = deactivated ? "deactivated" : blocked ? "blocked" : "active",
    profileStatus = blocked ? "blocked" : "active",
    membershipStatus = deactivated ? "revoked" : blocked ? "blocked" : "active";
  const updates = await Promise.all([
    db.from("profiles").update({ status: profileStatus }).eq("user_id", userId),
    db.from("organization_memberships").update({ status: membershipStatus, suspended_at: null }).eq("user_id", userId)
      .eq("organization_id", org),
    db.from("company_user_lifecycle").update({
      status: lifecycleStatus,
      deactivated_at: deactivated ? new Date().toISOString() : null,
      deactivated_by: deactivated ? actor : null,
    }).eq("user_id", userId),
    target.role === "conductor"
      ? db.from("drivers").update({ employment_status: blocked ? "inactive" : "active" }).eq(
        "membership_id",
        target.membershipId,
      )
      : Promise.resolve({ error: null }),
  ]);
  if (updates.some((result) => result.error)) {
    return fail(500, "database", "No se pudo completar el cambio; requiere reconciliación.");
  }
  await audit(db, org, actor, `user.${action.replace("_user", "")}`, userId, { status: lifecycleStatus });
  return reply(200, { userId, status: lifecycleStatus });
}

async function updateUser(db: Db, actor: string, org: string, userId: string, body: Record<string, unknown>) {
  const target = await targetUser(db, org, userId),
    first = requiredText(body.firstName),
    last = requiredText(body.lastName),
    phone = typeof body.phone === "string" ? body.phone.trim() : "",
    locale = typeof body.locale === "string" && body.locale.trim() ? body.locale.trim() : "es",
    timezone = typeof body.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : "Europe/Madrid";
  const results = await Promise.all([
    db.from("profiles").update({ display_name: `${first} ${last}`, phone: phone || null, locale, timezone }).eq(
      "user_id",
      userId,
    ),
    db.from("company_user_lifecycle").update({ first_name: first, last_name: last }).eq("user_id", userId).eq(
      "organization_id",
      org,
    ),
    target.role === "conductor"
      ? db.from("drivers").update({
        first_name: first,
        last_name: last,
        display_name: `${first} ${last}`,
        phone: phone || null,
      }).eq("membership_id", target.membershipId)
      : Promise.resolve({ error: null }),
  ]);
  if (results.some((result) => result.error)) {
    return fail(500, "reconciliation_required", "La edición requiere reconciliación.");
  }
  await audit(db, org, actor, "user.updated", userId, {
    firstName: first,
    lastName: last,
    phone: phone || null,
    locale,
    timezone,
  });
  return reply(200, { userId, organizationId: org, role: target.role, status: "active", mustChangePassword: false });
}

async function resetPassword(db: Db, actor: string, org: string, userId: string, body: Record<string, unknown>) {
  await targetUser(db, org, userId);
  const password = requiredPassword(body.password),
    must = body.mustChangePassword !== false,
    updated = await db.auth.admin.updateUserById(userId, { password });
  if (updated.error) return database(updated.error);
  const state = await db.from("company_user_lifecycle").update({
    must_change_password: must,
    initial_password_changed_at: null,
  }).eq("user_id", userId);
  if (state.error) return fail(500, "reconciliation_required", "Auth actualizado; estado pendiente de reconciliación.");
  await audit(db, org, actor, "user.password_reset", userId, { mustChangePassword: must });
  return reply(200, { userId, mustChangePassword: must });
}
async function confirmInitialPassword(db: Db, actor: string, org: string) {
  const state = await db.from("company_user_lifecycle").update({
    must_change_password: false,
    initial_password_changed_at: new Date().toISOString(),
  }).eq("user_id", actor).eq("organization_id", org).eq("must_change_password", true);
  if (state.error) return database(state.error);
  await audit(db, org, actor, "user.password_initial_changed", actor, {});
  return reply(200, { userId: actor, mustChangePassword: false });
}
async function targetUser(db: Db, org: string, userId: string) {
  const membership = await db.from("organization_memberships").select("id,role").eq("organization_id", org).eq(
    "user_id",
    userId,
  ).maybeSingle();
  if (!membership.data) throw new Error("Usuario no encontrado en la empresa.");
  return { membershipId: membership.data.id, role: membership.data.role };
}
async function audit(
  db: Db,
  org: string,
  actor: string,
  action: string,
  target: string,
  after: Record<string, unknown>,
) {
  const result = await db.from("audit_events").insert({
    organization_id: org,
    actor_user_id: actor,
    actor_scope: (await db.from("platform_admins").select("user_id").eq("user_id", actor).maybeSingle()).data
      ? "platform"
      : "organization",
    action,
    entity_type: "company_user",
    entity_id: target,
    after_data: after,
    correlation_id: crypto.randomUUID(),
  });
  if (result.error) throw new Error("No se pudo registrar la auditoría.");
}
const database = (error: { message: string }) => fail(400, "database", error.message);
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => typeof value === "string" ? value : "";
const uuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function requiredUuid(value: unknown) {
  if (typeof value !== "string" || !uuid(value)) throw new Error("UUID requerido.");
  return value;
}
function requiredText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Campo obligatorio.");
  return value.trim();
}
function requiredEmail(value: unknown) {
  const email = requiredText(value).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email inválido.");
  return email;
}
function requiredPassword(value: unknown) {
  const password = requiredText(value);
  if (
    password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) throw new Error("La contraseña debe tener 12 caracteres, mayúscula, minúscula, número y símbolo.");
  return password;
}
async function sha(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
