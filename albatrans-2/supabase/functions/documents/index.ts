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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return fail(405, "invalid_request", "Método no permitido.");
  const bearer = request.headers.get("Authorization");
  if (!bearer?.startsWith("Bearer ")) return fail(401, "unauthorized", "Sesión requerida.");
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return fail(500, "configuration_error", "Servicio no configurado.");
  const db = makeClient(url, key), auth = await db.auth.getUser(bearer.slice(7));
  if (auth.error || !auth.data.user) return fail(401, "unauthorized", "Sesión no válida.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_request", "JSON inválido.");
  }
  if (
    !record(body) || typeof body.action !== "string" || typeof body.organizationId !== "string" ||
    !uuid(body.organizationId)
  ) return fail(400, "invalid_request", "Payload inválido.");
  const access = await authorize(
    db,
    auth.data.user.id,
    body.organizationId,
    body.action.includes("pod") || body.action.includes("signature") ? "pod_signature" : "document_management",
  );
  if (!access.ok) return fail(access.status, access.code, access.message);
  const keyId = keyFrom(body.idempotencyKey, request.headers.get("idempotency-key"));
  if (!keyId) return fail(400, "invalid_request", "idempotency_key debe ser un UUID válido.");
  const correlation = crypto.randomUUID();
  try {
    if (body.action === "begin_upload" || body.action === "begin_version") {
      return await begin(db, auth.data.user.id, access.scope, body, keyId, correlation);
    }
    if (body.action === "confirm_upload") {
      return await confirm(db, auth.data.user.id, access.scope, body, keyId, correlation);
    }
    if (body.action === "signed_download") return await download(db, body);
    if (body.action === "archive") {
      return await rpc(db, "archive_document", {
        p_actor: auth.data.user.id,
        p_scope: access.scope,
        p_org: body.organizationId,
        p_document: requiredUuid(body.documentId),
        p_reason: requiredText(body.reason),
        p_correlation: correlation,
        p_key: keyId,
      });
    }
    if (body.action === "fail_upload") {
      return await rpc(db, "fail_document_upload", {
        p_actor: auth.data.user.id,
        p_scope: access.scope,
        p_org: body.organizationId,
        p_document: requiredUuid(body.documentId),
        p_version: requiredUuid(body.versionId),
        p_reason: requiredText(body.reason),
        p_correlation: correlation,
        p_key: keyId,
      });
    }
    if (["create_pod", "confirm_pod", "reject_pod"].includes(body.action)) {
      return await pod(db, auth.data.user.id, access.scope, body, keyId, correlation);
    }
    if (["create_signature", "revoke_signature"].includes(body.action)) {
      return await signature(db, auth.data.user.id, access.scope, body, keyId, correlation, request);
    }
    if (body.action === "reconcile") return await reconcile(db, body.organizationId);
    return fail(400, "invalid_action", "Acción documental no permitida.");
  } catch (caught) {
    return fail(400, "invalid_request", caught instanceof Error ? caught.message : "Payload inválido.");
  }
});

async function begin(
  db: Client,
  actor: string,
  scope: Scope,
  body: Record<string, unknown>,
  key: string,
  correlation: string,
) {
  const mime = requiredMime(body.mimeType), size = requiredSize(body.sizeBytes);
  const isVersion = body.action === "begin_version";
  const result = isVersion
    ? await db.rpc("begin_document_version_upload", {
      p_actor: actor,
      p_scope: scope,
      p_org: body.organizationId,
      p_document: requiredUuid(body.documentId),
      p_original_filename: requiredText(body.originalFilename),
      p_mime_type: mime,
      p_size_bytes: size,
      p_correlation: correlation,
      p_key: key,
    })
    : await db.rpc("begin_document_upload", {
      p_actor: actor,
      p_scope: scope,
      p_org: body.organizationId,
      p_document_type: requiredText(body.documentType),
      p_title: requiredText(body.title),
      p_description: optionalText(body.description),
      p_source: source(body.source),
      p_original_filename: requiredText(body.originalFilename),
      p_mime_type: mime,
      p_size_bytes: size,
      p_relations: relations(body.relations),
      p_correlation: correlation,
      p_key: key,
    });
  if (result.error) return databaseError(result.error.code, result.error.message);
  if (!record(result.data) || typeof result.data.storagePath !== "string") {
    return fail(500, "invalid_result", "Ruta de subida no disponible.");
  }
  const signed = await db.storage.from("albatrans-documents").createSignedUploadUrl(result.data.storagePath);
  if (signed.error) {
    return fail(502, "storage_unavailable", "No se pudo preparar la subida; puede reintentarse con la misma clave.");
  }
  return respond(200, {
    ...result.data,
    eventType: isVersion ? "document.version_created" : "document.upload_started",
    signedUploadUrl: signed.data.signedUrl,
    token: signed.data.token,
  });
}
async function confirm(
  db: Client,
  actor: string,
  scope: Scope,
  body: Record<string, unknown>,
  key: string,
  correlation: string,
) {
  const documentId = requiredUuid(body.documentId), versionId = requiredUuid(body.versionId);
  const version = await db.from("document_versions").select("storage_bucket,storage_path,mime_type,size_bytes,status")
    .eq("organization_id", body.organizationId).eq("document_id", documentId).eq("id", versionId).maybeSingle();
  if (version.error) return databaseError(version.error.code, version.error.message);
  if (!version.data) return fail(404, "not_found", "Versión no encontrada.");
  const object = await db.storage.from(version.data.storage_bucket).download(version.data.storage_path);
  if (object.error) return fail(409, "object_missing", "El archivo todavía no existe en Storage.");
  const bytes = await object.data.arrayBuffer();
  const actualMime = object.data.type || version.data.mime_type;
  if (bytes.byteLength !== version.data.size_bytes || actualMime !== version.data.mime_type) {
    return fail(409, "storage_mismatch", "El archivo no coincide con los metadatos declarados.");
  }
  const sha256 = hex(await crypto.subtle.digest("SHA-256", bytes));
  const result = await db.rpc("confirm_document_upload", {
    p_actor: actor,
    p_scope: scope,
    p_org: body.organizationId,
    p_document: documentId,
    p_version: versionId,
    p_actual_mime: actualMime,
    p_actual_size: bytes.byteLength,
    p_sha256: sha256,
    p_metadata: record(body.metadata) ? body.metadata : {},
    p_correlation: correlation,
    p_key: key,
  });
  if (result.error) return databaseError(result.error.code, result.error.message);
  return respond(200, result.data);
}
async function download(db: Client, body: Record<string, unknown>) {
  const version = await db.from("document_versions").select(
    "document_id,storage_bucket,storage_path,status",
  ).eq("organization_id", body.organizationId).eq("id", requiredUuid(body.versionId)).maybeSingle();
  if (version.error) return databaseError(version.error.code, version.error.message);
  if (!version.data || version.data.status !== "available") {
    return fail(409, "document_unavailable", "Documento no disponible.");
  }
  const document = await db.from("documents").select("status").eq("organization_id", body.organizationId).eq(
    "id",
    version.data.document_id,
  ).maybeSingle();
  if (document.error) return databaseError(document.error.code, document.error.message);
  if (document.data?.status !== "available") {
    return fail(409, "document_unavailable", "Documento no disponible.");
  }
  const signed = await db.storage.from(version.data.storage_bucket).createSignedUrl(version.data.storage_path, 120);
  if (signed.error) return fail(502, "storage_unavailable", "No se pudo preparar la descarga.");
  return respond(200, { signedUrl: signed.data.signedUrl, expiresIn: 120 });
}
function pod(
  db: Client,
  actor: string,
  scope: Scope,
  body: Record<string, unknown>,
  key: string,
  correlation: string,
) {
  const action = body.action === "create_pod" ? "create" : body.action === "confirm_pod" ? "confirm" : "reject";
  return rpc(db, "command_proof_of_delivery", {
    p_actor: actor,
    p_scope: scope,
    p_org: body.organizationId,
    p_action: action,
    p_pod: optionalUuid(body.entityId),
    p_document: optionalUuid(body.documentId),
    p_order: optionalUuid(body.transportOrderId),
    p_stop: optionalUuid(body.transportStopId),
    p_values: record(body.values) ? body.values : {},
    p_correlation: correlation,
    p_key: key,
  });
}
async function signature(
  db: Client,
  actor: string,
  scope: Scope,
  body: Record<string, unknown>,
  key: string,
  correlation: string,
  request: Request,
) {
  const values = record(body.values) ? { ...body.values } : {};
  if (body.action === "create_signature") {
    const type = values.signatureType === "typed" || values.signatureType === "drawn" ? values.signatureType : null;
    if (!type || typeof values.signerName !== "string" || typeof values.signatureValue !== "string") {
      throw new Error("Firma inválida.");
    }
    values.signatureHash = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(values.signatureValue)));
    delete values.signatureValue;
    values.userAgent = request.headers.get("user-agent");
  }
  return rpc(db, "command_document_signature", {
    p_actor: actor,
    p_scope: scope,
    p_org: body.organizationId,
    p_action: body.action === "create_signature" ? "create" : "revoke",
    p_signature: optionalUuid(body.entityId),
    p_document: optionalUuid(body.documentId),
    p_version: optionalUuid(body.versionId),
    p_values: values,
    p_correlation: correlation,
    p_key: key,
  });
}
async function reconcile(db: Client, organizationId: unknown) {
  const pending = await db.from("document_outbox").select("id,document_id,document_version_id,event_type,attempts").eq(
    "organization_id",
    organizationId,
  ).in("status", ["pending", "failed"]).lte("next_attempt_at", new Date().toISOString()).limit(100);
  if (pending.error) return databaseError(pending.error.code, pending.error.message);
  return respond(200, { inspected: pending.data.length, pending: pending.data });
}
async function rpc(db: Client, name: string, args: Record<string, unknown>) {
  const result = await db.rpc(name, args);
  if (result.error) return databaseError(result.error.code, result.error.message);
  return respond(200, record(result.data) ? result.data : { result: result.data });
}
async function authorize(db: Client, userId: string, organizationId: string, moduleCode: string) {
  const [profile, platform, membership, organization, module] = await Promise.all([
    db.from("profiles").select("status").eq("user_id", userId).maybeSingle(),
    db.from("platform_admins").select("role,status").eq("user_id", userId).maybeSingle(),
    db.from("organization_memberships").select("organization_id,role,status").eq("user_id", userId).eq(
      "organization_id",
      organizationId,
    ).maybeSingle(),
    db.from("organizations").select("status").eq("id", organizationId).maybeSingle(),
    db.from("modules").select("id").eq("code", moduleCode).single(),
  ]);
  if (profile.error || platform.error || membership.error || organization.error || module.error) {
    return deny(500, "access_check_failed", "No se pudo verificar el acceso.");
  }
  if (profile.data?.status !== "active") return deny(403, "forbidden", "Perfil inactivo.");
  if (platform.data?.role === "superadmin" && platform.data.status === "active") {
    return { ok: true as const, scope: "platform" as Scope };
  }
  if (
    organization.data?.status !== "active" || membership.data?.role !== "admin_empresa" ||
    membership.data.status !== "active"
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
    return deny(403, "module_disabled", "El módulo requerido está desactivado.");
  }
  return { ok: true as const, scope: "organization" as Scope };
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function uuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function requiredUuid(value: unknown) {
  if (typeof value !== "string" || !uuid(value)) throw new Error("Identificador inválido.");
  return value;
}
function optionalUuid(value: unknown) {
  return value === undefined || value === null ? null : requiredUuid(value);
}
function requiredText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Texto obligatorio.");
  return value.trim();
}
function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function requiredMime(value: unknown) {
  if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(String(value))) {
    throw new Error("MIME no permitido.");
  }
  return String(value);
}
function requiredSize(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 10 * 1024 * 1024) {
    throw new Error("Tamaño no permitido.");
  }
  return value;
}
function source(value: unknown) {
  if (!["upload", "camera", "generated", "imported", "legacy", "future_ocr"].includes(String(value))) {
    throw new Error("Origen inválido.");
  }
  return String(value);
}
function relations(value: unknown) {
  if (!record(value) || !Object.values(value).some((item) => typeof item === "string" && uuid(item))) {
    throw new Error("Relación obligatoria.");
  }
  return value;
}
function keyFrom(body: unknown, header: string | null) {
  const value = typeof body === "string" ? body : header ?? crypto.randomUUID();
  return uuid(value) ? value : null;
}
function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((item) => item.toString(16).padStart(2, "0")).join("");
}
const deny = (status: number, code: string, message: string) => ({ ok: false as const, status, code, message });
function databaseError(code: string | undefined, message: string) {
  if (code === "23505") return fail(409, "idempotency_conflict", message);
  if (code === "P0002") return fail(404, "not_found", message);
  if (code === "42501") return fail(403, "forbidden", message);
  if (["23514", "22P02", "22023", "55000"].includes(String(code))) return fail(409, "operation_rejected", message);
  return fail(500, "command_failed", "No se pudo ejecutar el comando documental.");
}
