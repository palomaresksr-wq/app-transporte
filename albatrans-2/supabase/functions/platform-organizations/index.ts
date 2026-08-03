import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const respond = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: cors });
const createAdminClient = (url: string, key: string) => createClient(url, key, { auth: { persistSession: false } });
type AdminClient = ReturnType<typeof createAdminClient>;
type CommandErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "tax_id_conflict"
  | "invalid_transition"
  | "reason_required"
  | "plan_not_found"
  | "module_not_found"
  | "limit_not_found"
  | "limit_unconfigured"
  | "audit_failed"
  | "update_failed";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return respond(405, commandError("invalid_request", "Método no permitido."));
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return respond(401, commandError("unauthorized", "Sesión requerida."));
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return respond(500, commandError("update_failed", "API local no configurada."));
  const admin = createAdminClient(url, serviceKey);
  const token = authorization.slice(7);
  const userResult = await admin.auth.getUser(token);
  if (userResult.error || !userResult.data.user) return respond(401, commandError("unauthorized", "Sesión no válida."));
  const userId = userResult.data.user.id;
  const [profile, platform] = await Promise.all([
    admin.from("profiles").select("status").eq("user_id", userId).maybeSingle(),
    admin.from("platform_admins").select("role,status").eq("user_id", userId).maybeSingle(),
  ]);
  if (profile.error || platform.error) {
    return respond(500, commandError("update_failed", "No se pudo verificar el acceso."));
  }
  if (profile.data?.status !== "active" || platform.data?.role !== "superadmin" || platform.data.status !== "active") {
    return respond(403, commandError("forbidden", "Acceso exclusivo de superadministración."));
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond(400, commandError("invalid_request", "JSON inválido."));
  }
  if (record(body) && body.action === "update") return updateOrganization(admin, userId, request, body);
  if (record(body) && body.action === "change_status") return changeOrganizationStatus(admin, userId, request, body);
  if (record(body) && body.action === "manage_subscription") {
    return manageOrganizationSubscription(admin, userId, request, body);
  }
  if (record(body) && body.action === "change_module") return changeOrganizationModule(admin, userId, request, body);
  if (record(body) && body.action === "change_limit") return changeOrganizationLimit(admin, userId, request, body);
  return createOrganization(admin, userId, request, body);
});

type CreatePayload = {
  legalName: string;
  tradeName: string;
  taxId: string;
  email: string;
  phone: string;
  countryCode: string;
  timezone: string;
  currencyCode: string;
  status: "pending" | "active";
  internalNotes: string;
};
type CreateParseResult = { ok: true; organization: CreatePayload } | { ok: false; message: string };

async function createOrganization(
  admin: AdminClient,
  userId: string,
  request: Request,
  body: unknown,
): Promise<Response> {
  const parsed = parseCreateRequest(body);
  if (!parsed.ok) return respond(400, { error: parsed.message });
  const organization = parsed.organization;
  const created = await admin.from("organizations").insert({
    legal_name: organization.legalName,
    trade_name: nullable(organization.tradeName),
    tax_id: nullable(organization.taxId),
    email: nullable(organization.email),
    phone: nullable(organization.phone),
    country_code: organization.countryCode,
    timezone: organization.timezone,
    currency_code: organization.currencyCode,
    status: organization.status,
    internal_notes: nullable(organization.internalNotes),
    created_by: userId,
  }).select("id,legal_name,status,country_code,currency_code").single();
  if (created.error) {
    return respond(created.error.code === "23505" ? 409 : 400, {
      error: created.error.code === "23505"
        ? "Ya existe una empresa con ese NIF/CIF en el país indicado."
        : "No se pudo crear la empresa.",
    });
  }
  const audit = await admin.from("audit_events").insert({
    organization_id: created.data.id,
    actor_user_id: userId,
    actor_scope: "platform",
    action: "organization.created",
    entity_type: "organization",
    entity_id: created.data.id,
    after_data: created.data,
    correlation_id: crypto.randomUUID(),
    user_agent: request.headers.get("user-agent"),
  });
  if (audit.error) {
    await admin.from("organizations").delete().eq("id", created.data.id);
    return respond(500, { error: "No se pudo registrar la creación de forma auditable." });
  }
  return respond(201, { organizationId: created.data.id });
}

function parseCreateRequest(value: unknown): CreateParseResult {
  if (!record(value) || value.action !== "create" || !record(value.organization)) {
    return { ok: false, message: "Solicitud de creación inválida." };
  }
  const row = value.organization;
  const keys = [
    "legalName",
    "tradeName",
    "taxId",
    "email",
    "phone",
    "countryCode",
    "timezone",
    "currencyCode",
    "status",
    "internalNotes",
  ] as const;
  if (keys.some((key) => typeof row[key] !== "string")) {
    return { ok: false, message: "Todos los campos deben ser texto." };
  }
  const organization: CreatePayload = {
    legalName: text(row.legalName),
    tradeName: text(row.tradeName),
    taxId: text(row.taxId).toUpperCase(),
    email: text(row.email).toLowerCase(),
    phone: text(row.phone),
    countryCode: text(row.countryCode).toUpperCase(),
    timezone: text(row.timezone),
    currencyCode: text(row.currencyCode).toUpperCase(),
    status: row.status === "active" ? "active" : "pending",
    internalNotes: text(row.internalNotes),
  };
  if (
    !organization.legalName || organization.legalName.length > 160 || !/^[A-Z]{2}$/.test(organization.countryCode) ||
    !/^[A-Z]{3}$/.test(organization.currencyCode) || !organization.timezone || organization.internalNotes.length > 2000
  ) return { ok: false, message: "Los datos de la empresa no son válidos." };
  if (organization.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(organization.email)) {
    return { ok: false, message: "El correo electrónico no es válido." };
  }
  return { ok: true, organization };
}

type UpdatePayload = {
  legalName: string;
  tradeName: string;
  taxId: string;
  email: string;
  phone: string;
  countryCode: string;
  timezone: string;
  currencyCode: string;
  internalNotes: string;
};
type UpdateParseResult = { ok: true; organizationId: string; organization: UpdatePayload } | {
  ok: false;
  message: string;
};

async function updateOrganization(
  admin: AdminClient,
  userId: string,
  request: Request,
  body: Record<string, unknown>,
): Promise<Response> {
  const parsed = parseUpdateRequest(body);
  if (!parsed.ok) return respond(400, commandError("invalid_request", parsed.message));
  const beforeResult = await admin.from("organizations").select(
    "legal_name,trade_name,tax_id,email,phone,country_code,timezone,currency_code,internal_notes",
  ).eq("id", parsed.organizationId).maybeSingle();
  if (beforeResult.error) return respond(500, commandError("update_failed", "No se pudo consultar la empresa."));
  if (!beforeResult.data) return respond(404, commandError("not_found", "La empresa no existe."));
  const values = databaseValues(parsed.organization);
  const updated = await admin.from("organizations").update(values).eq("id", parsed.organizationId).select(
    "legal_name,trade_name,tax_id,email,phone,country_code,timezone,currency_code,internal_notes",
  ).single();
  if (updated.error) {
    if (updated.error.code === "23505") {
      return respond(
        409,
        commandError("tax_id_conflict", "Ya existe una empresa con ese NIF/CIF en el país indicado."),
      );
    }
    return respond(400, commandError("update_failed", "No se pudo actualizar la empresa."));
  }
  const audit = await admin.from("audit_events").insert({
    organization_id: parsed.organizationId,
    actor_user_id: userId,
    actor_scope: "platform",
    action: "organization.updated",
    entity_type: "organization",
    entity_id: parsed.organizationId,
    before_data: beforeResult.data,
    after_data: updated.data,
    correlation_id: crypto.randomUUID(),
    user_agent: request.headers.get("user-agent"),
  });
  if (audit.error) {
    await admin.from("organizations").update(beforeResult.data).eq("id", parsed.organizationId);
    return respond(500, commandError("audit_failed", "No se pudo registrar la actualización de forma auditable."));
  }
  return respond(200, { organizationId: parsed.organizationId });
}

function parseUpdateRequest(value: Record<string, unknown>): UpdateParseResult {
  if (
    !exactKeys(value, ["action", "organizationId", "organization"]) || value.action !== "update" ||
    typeof value.organizationId !== "string" || !uuid(value.organizationId) || !record(value.organization)
  ) return { ok: false, message: "Solicitud de actualización inválida." };
  const row = value.organization;
  const keys = [
    "legalName",
    "tradeName",
    "taxId",
    "email",
    "phone",
    "countryCode",
    "timezone",
    "currencyCode",
    "internalNotes",
  ] as const;
  if (!exactKeys(row, keys) || keys.some((key) => typeof row[key] !== "string")) {
    return { ok: false, message: "Solo se permiten los datos generales editables." };
  }
  const organization: UpdatePayload = {
    legalName: text(row.legalName),
    tradeName: text(row.tradeName),
    taxId: text(row.taxId).toUpperCase(),
    email: text(row.email).toLowerCase(),
    phone: text(row.phone),
    countryCode: text(row.countryCode).toUpperCase(),
    timezone: text(row.timezone),
    currencyCode: text(row.currencyCode).toUpperCase(),
    internalNotes: text(row.internalNotes),
  };
  if (
    !organization.legalName || organization.legalName.length > 160 || !organization.tradeName ||
    organization.tradeName.length > 160 || !organization.taxId || organization.taxId.length > 32 ||
    !/^[A-Z]{2}$/.test(organization.countryCode) || !/^[A-Z]{3}$/.test(organization.currencyCode) ||
    !organization.timezone || organization.internalNotes.length > 2000 || organization.phone.length > 32 ||
    organization.email.length > 254
  ) return { ok: false, message: "Los datos generales no son válidos." };
  if (organization.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(organization.email)) {
    return { ok: false, message: "El correo electrónico no es válido." };
  }
  return { ok: true, organizationId: value.organizationId, organization };
}

type OrganizationStatus = "pending" | "active" | "maintenance" | "blocked" | "suspended" | "archived";
const statusTransitions: Readonly<Record<OrganizationStatus, readonly OrganizationStatus[]>> = {
  pending: ["active", "blocked", "archived"],
  active: ["maintenance", "blocked", "suspended", "archived"],
  maintenance: ["active", "blocked", "suspended", "archived"],
  blocked: ["active", "maintenance", "suspended", "archived"],
  suspended: ["active", "maintenance", "blocked", "archived"],
  archived: [],
};

async function changeOrganizationStatus(
  admin: AdminClient,
  userId: string,
  request: Request,
  body: Record<string, unknown>,
): Promise<Response> {
  if (
    !exactKeys(body, ["action", "organizationId", "status", "reason"]) || typeof body.organizationId !== "string" ||
    !uuid(body.organizationId) || !isOrganizationStatus(body.status) || typeof body.reason !== "string"
  ) return respond(400, commandError("invalid_request", "Solicitud de cambio de estado inválida."));
  const reason = body.reason.trim();
  if (requiresReason(body.status) && !reason) {
    return respond(400, commandError("reason_required", "El motivo es obligatorio para este estado."));
  }
  if (reason.length > 1000) {
    return respond(400, commandError("invalid_request", "El motivo no puede superar 1.000 caracteres."));
  }
  const select = "status,status_reason,status_changed_at,status_changed_by,archived_at";
  const before = await admin.from("organizations").select(select).eq("id", body.organizationId).maybeSingle();
  if (before.error) return respond(500, commandError("update_failed", "No se pudo consultar la empresa."));
  if (!before.data) return respond(404, commandError("not_found", "La empresa no existe."));
  if (!isOrganizationStatus(before.data.status) || !statusTransitions[before.data.status].includes(body.status)) {
    return respond(
      409,
      commandError("invalid_transition", `No se permite pasar de ${before.data.status} a ${body.status}.`),
    );
  }
  const changedAt = new Date().toISOString();
  const values = {
    status: body.status,
    status_reason: nullable(reason),
    status_changed_at: changedAt,
    status_changed_by: userId,
    archived_at: body.status === "archived" ? changedAt : null,
  };
  const updated = await admin.from("organizations").update(values).eq("id", body.organizationId).select(select)
    .single();
  if (updated.error) return respond(400, commandError("update_failed", "No se pudo cambiar el estado de la empresa."));
  const audit = await admin.from("audit_events").insert({
    organization_id: body.organizationId,
    actor_user_id: userId,
    actor_scope: "platform",
    action: "organization.status_changed",
    entity_type: "organization",
    entity_id: body.organizationId,
    before_data: before.data,
    after_data: updated.data,
    reason: nullable(reason),
    correlation_id: crypto.randomUUID(),
    user_agent: request.headers.get("user-agent"),
  });
  if (audit.error) {
    await admin.from("organizations").update(before.data).eq("id", body.organizationId);
    return respond(500, commandError("audit_failed", "No se pudo registrar el cambio de estado de forma auditable."));
  }
  return respond(200, { organizationId: body.organizationId, status: body.status });
}

function isOrganizationStatus(value: unknown): value is OrganizationStatus {
  return value === "pending" || value === "active" || value === "maintenance" || value === "blocked" ||
    value === "suspended" || value === "archived";
}
function requiresReason(value: OrganizationStatus): boolean {
  return value === "blocked" || value === "suspended" || value === "archived";
}

type PlanCode = "starter" | "professional" | "enterprise" | "custom";
type SubscriptionStatus = "trial" | "active" | "past_due" | "suspended" | "cancelled" | "expired";
type PaymentStatus = "not_required" | "pending" | "paid" | "overdue" | "failed";
type SubscriptionPayload = {
  planCode: PlanCode;
  status: SubscriptionStatus;
  paymentStatus: PaymentStatus;
  startsAt: string;
  currentPeriodStartsAt: string;
  currentPeriodEndsAt: string;
  paidThrough: string;
  gracePeriodEndsAt: string;
  cancelAtPeriodEnd: boolean;
  notes: string;
  reason: string;
};
type SubscriptionParseResult = { ok: true; organizationId: string; subscription: SubscriptionPayload } | {
  ok: false;
  code: "invalid_request" | "reason_required";
  message: string;
};
const commercialSelect =
  "plan_id,status,payment_status,starts_at,current_period_starts_at,current_period_ends_at,paid_through,grace_period_ends_at,cancel_at_period_end,notes";

async function manageOrganizationSubscription(
  admin: AdminClient,
  userId: string,
  request: Request,
  body: Record<string, unknown>,
): Promise<Response> {
  const parsed = parseSubscriptionRequest(body);
  if (!parsed.ok) return respond(400, commandError(parsed.code, parsed.message));
  const organization = await admin.from("organizations").select("id").eq("id", parsed.organizationId).maybeSingle();
  if (organization.error) return respond(500, commandError("update_failed", "No se pudo consultar la empresa."));
  if (!organization.data) return respond(404, commandError("not_found", "La empresa no existe."));
  const plan = await admin.from("plans").select("id,code").eq("code", parsed.subscription.planCode).eq(
    "status",
    "active",
  ).maybeSingle();
  if (plan.error) return respond(500, commandError("update_failed", "No se pudo consultar el plan."));
  if (!plan.data) return respond(400, commandError("plan_not_found", "El plan seleccionado no está disponible."));
  const existing = await admin.from("organization_subscriptions").select(`id,${commercialSelect}`).eq(
    "organization_id",
    parsed.organizationId,
  ).maybeSingle();
  if (existing.error) return respond(500, commandError("update_failed", "No se pudo consultar la suscripción."));
  const values = subscriptionValues(plan.data.id, parsed.subscription);
  const saved = existing.data
    ? await admin.from("organization_subscriptions").update(values).eq("id", existing.data.id).select(
      `id,${commercialSelect}`,
    ).single()
    : await admin.from("organization_subscriptions").insert({ organization_id: parsed.organizationId, ...values })
      .select(`id,${commercialSelect}`).single();
  if (saved.error) return respond(400, commandError("update_failed", "No se pudo guardar la suscripción."));
  const beforeData = existing.data ? commercialData(existing.data) : null;
  const afterData = commercialData(saved.data);
  const actions = beforeData === null ? ["subscription.created"] : subscriptionAuditActions(beforeData, afterData);
  if (actions.length > 0) {
    const correlationId = crypto.randomUUID();
    const audits = actions.map((action) => ({
      organization_id: parsed.organizationId,
      actor_user_id: userId,
      actor_scope: "platform",
      action,
      entity_type: "organization_subscription",
      entity_id: saved.data.id,
      before_data: beforeData,
      after_data: afterData,
      reason: nullable(parsed.subscription.reason),
      correlation_id: correlationId,
      user_agent: request.headers.get("user-agent"),
    }));
    const audit = await admin.from("audit_events").insert(audits);
    if (audit.error) {
      if (existing.data) await admin.from("organization_subscriptions").update(beforeData).eq("id", existing.data.id);
      else await admin.from("organization_subscriptions").delete().eq("id", saved.data.id);
      return respond(500, commandError("audit_failed", "No se pudo registrar el cambio comercial de forma auditable."));
    }
  }
  return respond(200, {
    organizationId: parsed.organizationId,
    subscriptionId: saved.data.id,
    created: !existing.data,
  });
}

function parseSubscriptionRequest(value: Record<string, unknown>): SubscriptionParseResult {
  if (
    !exactKeys(value, ["action", "organizationId", "subscription"]) || typeof value.organizationId !== "string" ||
    !uuid(value.organizationId) || !record(value.subscription)
  ) return { ok: false, code: "invalid_request", message: "Solicitud de suscripción inválida." };
  const row = value.subscription;
  const keys = [
    "planCode",
    "status",
    "paymentStatus",
    "startsAt",
    "currentPeriodStartsAt",
    "currentPeriodEndsAt",
    "paidThrough",
    "gracePeriodEndsAt",
    "cancelAtPeriodEnd",
    "notes",
    "reason",
  ] as const;
  if (
    !exactKeys(row, keys) || !isPlanCode(row.planCode) || !isSubscriptionStatus(row.status) ||
    !isPaymentStatus(row.paymentStatus) || typeof row.cancelAtPeriodEnd !== "boolean" ||
    keys.filter((key) => key !== "cancelAtPeriodEnd").some((key) => typeof row[key] !== "string")
  ) return { ok: false, code: "invalid_request", message: "El payload comercial no es válido." };
  const subscription: SubscriptionPayload = {
    planCode: row.planCode,
    status: row.status,
    paymentStatus: row.paymentStatus,
    startsAt: text(row.startsAt),
    currentPeriodStartsAt: text(row.currentPeriodStartsAt),
    currentPeriodEndsAt: text(row.currentPeriodEndsAt),
    paidThrough: text(row.paidThrough),
    gracePeriodEndsAt: text(row.gracePeriodEndsAt),
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    notes: text(row.notes),
    reason: text(row.reason),
  };
  if (
    !validInstant(subscription.startsAt) || invalidOptionalInstant(subscription.currentPeriodStartsAt) ||
    invalidOptionalInstant(subscription.currentPeriodEndsAt) || invalidOptionalInstant(subscription.paidThrough) ||
    invalidOptionalInstant(subscription.gracePeriodEndsAt) || subscription.notes.length > 2000 ||
    subscription.reason.length > 1000
  ) return { ok: false, code: "invalid_request", message: "Las fechas o textos comerciales no son válidos." };
  const periodStart = optionalTime(subscription.currentPeriodStartsAt);
  const periodEnd = optionalTime(subscription.currentPeriodEndsAt);
  const graceEnd = optionalTime(subscription.gracePeriodEndsAt);
  if (periodStart !== null && periodEnd !== null && periodEnd < periodStart) {
    return { ok: false, code: "invalid_request", message: "El fin del periodo no puede ser anterior al inicio." };
  }
  if (graceEnd !== null && periodEnd !== null && graceEnd < periodEnd) {
    return {
      ok: false,
      code: "invalid_request",
      message: "El periodo de gracia no puede terminar antes que el periodo contratado.",
    };
  }
  if (commercialReasonRequired(subscription) && !subscription.reason) {
    return { ok: false, code: "reason_required", message: "El motivo es obligatorio para este cambio comercial." };
  }
  return { ok: true, organizationId: value.organizationId, subscription };
}

function subscriptionValues(planId: string, value: SubscriptionPayload) {
  return {
    plan_id: planId,
    status: value.status,
    payment_status: value.paymentStatus,
    starts_at: iso(value.startsAt),
    current_period_starts_at: optionalIso(value.currentPeriodStartsAt),
    current_period_ends_at: optionalIso(value.currentPeriodEndsAt),
    paid_through: optionalIso(value.paidThrough),
    grace_period_ends_at: optionalIso(value.gracePeriodEndsAt),
    cancel_at_period_end: value.cancelAtPeriodEnd,
    notes: nullable(value.notes),
  };
}
function commercialData(value: Record<string, unknown>) {
  return {
    plan_id: value.plan_id,
    status: value.status,
    payment_status: value.payment_status,
    starts_at: value.starts_at,
    current_period_starts_at: value.current_period_starts_at,
    current_period_ends_at: value.current_period_ends_at,
    paid_through: value.paid_through,
    grace_period_ends_at: value.grace_period_ends_at,
    cancel_at_period_end: value.cancel_at_period_end,
    notes: value.notes,
  };
}
function subscriptionAuditActions(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const actions: string[] = [];
  if (before.plan_id !== after.plan_id) actions.push("subscription.plan_changed");
  if (before.payment_status !== after.payment_status) actions.push("subscription.payment_changed");
  if (
    [
      "starts_at",
      "current_period_starts_at",
      "current_period_ends_at",
      "paid_through",
      "grace_period_ends_at",
      "cancel_at_period_end",
    ].some((key) => before[key] !== after[key])
  ) actions.push("subscription.expiry_changed");
  if (before.status !== after.status) actions.push("subscription.status_changed");
  if (before.notes !== after.notes) actions.push("subscription.notes_changed");
  return actions;
}
function commercialReasonRequired(value: SubscriptionPayload): boolean {
  return value.paymentStatus === "failed" || value.paymentStatus === "overdue" || value.status === "suspended" ||
    value.status === "cancelled" || value.status === "expired";
}
function isPlanCode(value: unknown): value is PlanCode {
  return value === "starter" || value === "professional" || value === "enterprise" || value === "custom";
}
function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return value === "trial" || value === "active" || value === "past_due" || value === "suspended" ||
    value === "cancelled" || value === "expired";
}
function isPaymentStatus(value: unknown): value is PaymentStatus {
  return value === "not_required" || value === "pending" || value === "paid" || value === "overdue" ||
    value === "failed";
}
function validInstant(value: string): boolean {
  return value.length > 0 && Number.isFinite(new Date(value).getTime());
}
function invalidOptionalInstant(value: string): boolean {
  return value.length > 0 && !Number.isFinite(new Date(value).getTime());
}
function optionalTime(value: string): number | null {
  return value ? new Date(value).getTime() : null;
}
function iso(value: string): string {
  return new Date(value).toISOString();
}
function optionalIso(value: string): string | null {
  return value ? iso(value) : null;
}

type ModuleCode =
  | "transport_management"
  | "client_management"
  | "vehicle_management"
  | "pod_signature"
  | "electronic_delivery_notes"
  | "ocr"
  | "billing"
  | "time_tracking"
  | "leave_management"
  | "exports"
  | "reports"
  | "api_access"
  | "support_access"
  | "audit_access";
type ModuleOverrideMode = "inherit" | "enabled" | "disabled";

async function changeOrganizationModule(
  admin: AdminClient,
  userId: string,
  request: Request,
  body: Record<string, unknown>,
): Promise<Response> {
  if (
    !exactKeys(body, ["action", "organizationId", "moduleCode", "overrideMode", "reason"]) ||
    typeof body.organizationId !== "string" || !uuid(body.organizationId) || !isModuleCode(body.moduleCode) ||
    !isModuleOverrideMode(body.overrideMode) || typeof body.reason !== "string"
  ) return respond(400, commandError("invalid_request", "Solicitud de módulo inválida."));
  const reason = body.reason.trim();
  if (body.overrideMode !== "inherit" && !reason) {
    return respond(400, commandError("reason_required", "El motivo es obligatorio al activar o desactivar un módulo."));
  }
  if (reason.length > 1000) {
    return respond(400, commandError("invalid_request", "El motivo no puede superar 1.000 caracteres."));
  }
  const organization = await admin.from("organizations").select("id").eq("id", body.organizationId).maybeSingle();
  if (organization.error) return respond(500, commandError("update_failed", "No se pudo consultar la empresa."));
  if (!organization.data) return respond(404, commandError("not_found", "La empresa no existe."));
  const moduleResult = await admin.from("modules").select("id,code").eq("code", body.moduleCode).eq("status", "active")
    .maybeSingle();
  if (moduleResult.error) return respond(500, commandError("update_failed", "No se pudo consultar el módulo."));
  if (!moduleResult.data) return respond(400, commandError("module_not_found", "El módulo no está disponible."));
  const subscription = await admin.from("organization_subscriptions").select("plan_id").eq(
    "organization_id",
    body.organizationId,
  ).maybeSingle();
  if (subscription.error) {
    return respond(500, commandError("update_failed", "No se pudo consultar el plan de la empresa."));
  }
  const planModule = subscription.data
    ? await admin.from("plan_modules").select("enabled").eq("plan_id", subscription.data.plan_id).eq(
      "module_id",
      moduleResult.data.id,
    ).maybeSingle()
    : { data: null, error: null };
  if (planModule.error) return respond(500, commandError("update_failed", "No se pudo resolver el valor del plan."));
  const planEnabled = planModule.data?.enabled ?? false;
  const existing = await admin.from("organization_module_overrides").select(
    "override_mode,reason,changed_by,changed_at",
  ).eq("organization_id", body.organizationId).eq("module_id", moduleResult.data.id).maybeSingle();
  if (existing.error) return respond(500, commandError("update_failed", "No se pudo consultar el override."));
  const beforeMode = existing.data?.override_mode ?? "inherit";
  const beforeEffective = effectiveModule(planEnabled, beforeMode);
  const changedAt = new Date().toISOString();
  const saved = await admin.from("organization_module_overrides").upsert({
    organization_id: body.organizationId,
    module_id: moduleResult.data.id,
    override_mode: body.overrideMode,
    reason: body.overrideMode === "inherit" ? null : reason,
    changed_by: userId,
    changed_at: changedAt,
  }, { onConflict: "organization_id,module_id" }).select("override_mode").single();
  if (saved.error) return respond(400, commandError("update_failed", "No se pudo guardar el override del módulo."));
  const afterEffective = effectiveModule(planEnabled, saved.data.override_mode);
  const beforeData = {
    module_code: body.moduleCode,
    plan_enabled: planEnabled,
    override_mode: beforeMode,
    effective_enabled: beforeEffective,
  };
  const afterData = {
    module_code: body.moduleCode,
    plan_enabled: planEnabled,
    override_mode: saved.data.override_mode,
    effective_enabled: afterEffective,
  };
  const action = saved.data.override_mode === "enabled"
    ? "organization.module_enabled"
    : saved.data.override_mode === "disabled"
    ? "organization.module_disabled"
    : "organization.module_inherited";
  const audit = await admin.from("audit_events").insert({
    organization_id: body.organizationId,
    actor_user_id: userId,
    actor_scope: "platform",
    action,
    entity_type: "organization_module",
    entity_id: moduleResult.data.id,
    before_data: beforeData,
    after_data: afterData,
    reason: nullable(reason),
    correlation_id: crypto.randomUUID(),
    user_agent: request.headers.get("user-agent"),
  });
  if (audit.error) {
    if (existing.data) {
      await admin.from("organization_module_overrides").update(existing.data).eq("organization_id", body.organizationId)
        .eq("module_id", moduleResult.data.id);
    } else {await admin.from("organization_module_overrides").delete().eq("organization_id", body.organizationId).eq(
        "module_id",
        moduleResult.data.id,
      );}
    return respond(500, commandError("audit_failed", "No se pudo registrar el cambio de módulo de forma auditable."));
  }
  return respond(200, {
    organizationId: body.organizationId,
    moduleCode: body.moduleCode,
    overrideMode: saved.data.override_mode,
    effectiveEnabled: afterEffective,
  });
}

function effectiveModule(planEnabled: boolean, overrideMode: ModuleOverrideMode): boolean {
  return overrideMode === "enabled" ? true : overrideMode === "disabled" ? false : planEnabled;
}

type LimitCode =
  | "max_admins"
  | "max_drivers"
  | "max_documents_total"
  | "max_documents_monthly"
  | "max_ocr_monthly"
  | "max_storage_bytes"
  | "max_exports_monthly";
type LimitAction = "inherit" | "custom" | "delete";
async function changeOrganizationLimit(
  admin: AdminClient,
  userId: string,
  request: Request,
  body: Record<string, unknown>,
): Promise<Response> {
  if (
    !exactKeys(body, ["action", "organizationId", "limitCode", "limitAction", "value", "reason"]) ||
    typeof body.organizationId !== "string" || !uuid(body.organizationId) || !isLimitCode(body.limitCode) ||
    !isLimitAction(body.limitAction) || (body.value !== null && typeof body.value !== "number") ||
    typeof body.reason !== "string"
  ) return respond(400, commandError("invalid_request", "Solicitud de límite inválida."));
  if (
    body.limitAction === "custom" &&
    (typeof body.value !== "number" || !Number.isSafeInteger(body.value) || body.value < 0)
  ) return respond(400, commandError("invalid_request", "El límite debe ser un entero igual o mayor que cero."));
  if (body.limitAction !== "custom" && body.value !== null) {
    return respond(400, commandError("invalid_request", "Solo un override personalizado acepta valor."));
  }
  const reason = text(body.reason);
  if (body.limitAction === "custom" && !reason) {
    return respond(400, commandError("reason_required", "El motivo es obligatorio para un límite personalizado."));
  }
  const organizationResult = await admin.from("organizations").select("id").eq("id", body.organizationId).maybeSingle();
  if (organizationResult.error) return respond(500, commandError("update_failed", "No se pudo consultar la empresa."));
  if (!organizationResult.data) return respond(404, commandError("not_found", "La empresa no existe."));
  const definition = await admin.from("limit_definitions").select("id,code").eq("code", body.limitCode).eq(
    "status",
    "active",
  ).maybeSingle();
  if (definition.error) return respond(500, commandError("update_failed", "No se pudo consultar el límite."));
  if (!definition.data) return respond(404, commandError("limit_not_found", "El límite no existe."));
  const [subscription, existing] = await Promise.all([
    admin.from("organization_subscriptions").select("plan_id").eq("organization_id", body.organizationId).maybeSingle(),
    admin.from("organization_limit_overrides").select("override_mode,limit_value,reason,changed_by,changed_at").eq(
      "organization_id",
      body.organizationId,
    ).eq("limit_definition_id", definition.data.id).maybeSingle(),
  ]);
  if (subscription.error || existing.error) {
    return respond(500, commandError("update_failed", "No se pudo resolver el límite efectivo."));
  }
  const plan = subscription.data
    ? await admin.from("plan_limits").select("limit_value").eq("plan_id", subscription.data.plan_id).eq(
      "limit_definition_id",
      definition.data.id,
    ).maybeSingle()
    : { data: null, error: null };
  if (plan.error) return respond(500, commandError("update_failed", "No se pudo cargar el límite del plan."));
  const planValue = plan.data?.limit_value ?? null;
  if (body.limitAction !== "custom" && planValue === null) {
    return respond(
      409,
      commandError(
        "limit_unconfigured",
        "No se puede heredar ni eliminar el override porque el plan no define este límite.",
      ),
    );
  }
  const beforeEffective = existing.data?.override_mode === "custom" ? existing.data.limit_value : planValue;
  if (beforeEffective === null) {
    return respond(409, commandError("limit_unconfigured", "El límite actual no está configurado."));
  }
  if (body.limitAction === "delete") {
    const removed = await admin.from("organization_limit_overrides").delete().eq("organization_id", body.organizationId)
      .eq("limit_definition_id", definition.data.id);
    if (removed.error) return respond(400, commandError("update_failed", "No se pudo eliminar el override."));
  } else {
    const saved = await admin.from("organization_limit_overrides").upsert({
      organization_id: body.organizationId,
      limit_definition_id: definition.data.id,
      override_mode: body.limitAction,
      limit_value: body.limitAction === "custom" ? body.value : null,
      reason: body.limitAction === "custom" ? reason : null,
      changed_by: userId,
      changed_at: new Date().toISOString(),
    }, { onConflict: "organization_id,limit_definition_id" });
    if (saved.error) return respond(400, commandError("update_failed", "No se pudo guardar el override."));
  }
  const effectiveValue = body.limitAction === "custom" ? body.value : planValue;
  if (effectiveValue === null) {
    return respond(500, commandError("update_failed", "No se pudo resolver el valor efectivo."));
  }
  const beforeData = {
    limit_code: body.limitCode,
    plan_value: planValue,
    override_mode: existing.data?.override_mode ?? null,
    override_value: existing.data?.limit_value ?? null,
    effective_value: beforeEffective,
  };
  const afterData = {
    limit_code: body.limitCode,
    plan_value: planValue,
    override_mode: body.limitAction === "delete" ? null : body.limitAction,
    override_value: body.limitAction === "custom" ? body.value : null,
    effective_value: effectiveValue,
  };
  const audit = await admin.from("audit_events").insert({
    organization_id: body.organizationId,
    actor_user_id: userId,
    actor_scope: "platform",
    action: body.limitAction === "custom" ? "organization.limit_updated" : "organization.limit_inherited",
    entity_type: "organization_limit",
    entity_id: definition.data.id,
    before_data: beforeData,
    after_data: afterData,
    reason: nullable(reason),
    correlation_id: crypto.randomUUID(),
    user_agent: request.headers.get("user-agent"),
  });
  if (audit.error) {
    if (existing.data) {
      await admin.from("organization_limit_overrides").upsert({
        organization_id: body.organizationId,
        limit_definition_id: definition.data.id,
        ...existing.data,
      }, { onConflict: "organization_id,limit_definition_id" });
    } else {await admin.from("organization_limit_overrides").delete().eq("organization_id", body.organizationId).eq(
        "limit_definition_id",
        definition.data.id,
      );}
    return respond(500, commandError("audit_failed", "No se pudo registrar el cambio de límite de forma auditable."));
  }
  return respond(200, {
    organizationId: body.organizationId,
    limitCode: body.limitCode,
    action: body.limitAction,
    effectiveValue,
  });
}
function isLimitCode(value: unknown): value is LimitCode {
  return value === "max_admins" || value === "max_drivers" || value === "max_documents_total" ||
    value === "max_documents_monthly" || value === "max_ocr_monthly" || value === "max_storage_bytes" ||
    value === "max_exports_monthly";
}
function isLimitAction(value: unknown): value is LimitAction {
  return value === "inherit" || value === "custom" || value === "delete";
}
function isModuleOverrideMode(value: unknown): value is ModuleOverrideMode {
  return value === "inherit" || value === "enabled" || value === "disabled";
}
function isModuleCode(value: unknown): value is ModuleCode {
  return value === "transport_management" || value === "client_management" || value === "vehicle_management" ||
    value === "pod_signature" || value === "electronic_delivery_notes" || value === "ocr" || value === "billing" ||
    value === "time_tracking" || value === "leave_management" || value === "exports" || value === "reports" ||
    value === "api_access" || value === "support_access" || value === "audit_access";
}

function databaseValues(value: UpdatePayload) {
  return {
    legal_name: value.legalName,
    trade_name: value.tradeName,
    tax_id: value.taxId,
    email: nullable(value.email),
    phone: nullable(value.phone),
    country_code: value.countryCode,
    timezone: value.timezone,
    currency_code: value.currencyCode,
    internal_notes: nullable(value.internalNotes),
  };
}
function commandError(code: CommandErrorCode, message: string) {
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
