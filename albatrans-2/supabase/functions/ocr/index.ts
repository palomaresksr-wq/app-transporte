import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.55.0";
import { createProvider, OcrProviderError } from "./providers.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
  "Content-Type": "application/json",
};

const respond = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
const fail = (status: number, code: string, message: string) => respond(status, { error: { code, message } });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Scope = "platform" | "organization";

type AnyRecord = Record<string, unknown>;
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Database = {
  public: {
    Tables: {
      document_versions: {
        Row: { storage_bucket: string; storage_path: string; mime_type: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      modules: {
        Row: { id: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      organization_memberships: {
        Row: { organization_id: string; role: string; status: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      organization_module_overrides: {
        Row: { override_mode: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      organization_subscriptions: {
        Row: { plan_id: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      organizations: {
        Row: { status: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      platform_admins: {
        Row: { role: string; status: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      plan_modules: {
        Row: { enabled: boolean };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      ocr_jobs: {
        Row: {
          id: string;
          organization_id: string;
          document_id: string;
          document_version_id: string;
          provider_code: string;
          payload: Json | null;
          status: string;
          attempt_count: number;
          max_attempts: number;
          requested_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      profiles: {
        Row: { status: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      approve_ocr_review: { Args: AnyRecord; Returns: unknown };
      archive_ocr_job: { Args: AnyRecord; Returns: unknown };
      complete_ocr_job_result: { Args: AnyRecord; Returns: unknown };
      correct_ocr_field: { Args: AnyRecord; Returns: unknown };
      fail_ocr_job: { Args: AnyRecord; Returns: unknown };
      mark_ocr_processing_started: { Args: AnyRecord; Returns: unknown };
      reconcile_ocr_jobs: { Args: AnyRecord; Returns: unknown };
      reject_ocr_review: { Args: AnyRecord; Returns: unknown };
      request_document_ocr: { Args: AnyRecord; Returns: unknown };
      start_ocr_review: { Args: AnyRecord; Returns: unknown };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type DbClient = SupabaseClient<Database>;
type OcrCommandBody = {
  action: string;
  organizationId: string;
  idempotencyKey?: unknown;
  providerCode?: unknown;
  payload?: unknown;
  documentId?: unknown;
  documentVersionId?: unknown;
  jobId?: unknown;
  resultId?: unknown;
  reviewId?: unknown;
  fieldResultId?: unknown;
  fieldCode?: unknown;
  correctedValue?: unknown;
  reason?: unknown;
  notes?: unknown;
  limit?: unknown;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return fail(405, "invalid_request", "Metodo no permitido.");

  const bearer = request.headers.get("Authorization");
  if (!bearer?.startsWith("Bearer ")) return fail(401, "unauthorized", "Sesion requerida.");

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return fail(500, "configuration_error", "Servicio no configurado.");

  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const auth = await db.auth.getUser(bearer.slice(7));
  if (auth.error || !auth.data.user) return fail(401, "unauthorized", "Sesion no valida.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_request", "JSON invalido.");
  }

  if (
    !record(body) || typeof body.action !== "string" || typeof body.organizationId !== "string" ||
    !uuid(body.organizationId)
  ) {
    return fail(400, "invalid_request", "Payload OCR invalido.");
  }

  const ocrBody = body as OcrCommandBody;

  const access = await authorize(db, auth.data.user.id, ocrBody.organizationId, "ocr");
  if (!access.ok) return fail(access.status, access.code, access.message);

  const idempotencyKey = keyFrom(ocrBody.idempotencyKey, request.headers.get("idempotency-key"));
  if (!idempotencyKey) return fail(400, "invalid_request", "idempotency_key debe ser UUID.");

  const correlationId = crypto.randomUUID();

  try {
    switch (body.action) {
      case "request_ocr":
        return await requestOcr(db, auth.data.user.id, access.scope, ocrBody, idempotencyKey, correlationId);
      case "process_next":
        return await processNext(db, auth.data.user.id, access.scope, ocrBody, correlationId);
      case "start_review":
        return await runRpc(db, "start_ocr_review", {
          p_actor: auth.data.user.id,
          p_scope: access.scope,
          p_org: ocrBody.organizationId,
          p_job: requiredUuid(ocrBody.jobId),
          p_result: requiredUuid(ocrBody.resultId),
          p_notes: optionalText(ocrBody.notes),
          p_correlation: correlationId,
          p_key: idempotencyKey,
        });
      case "correct_field":
        return await runRpc(db, "correct_ocr_field", {
          p_actor: auth.data.user.id,
          p_scope: access.scope,
          p_org: ocrBody.organizationId,
          p_review: requiredUuid(ocrBody.reviewId),
          p_field_result: optionalUuid(ocrBody.fieldResultId),
          p_field_code: requiredText(ocrBody.fieldCode),
          p_corrected_value: ocrBody.correctedValue ?? null,
          p_reason: optionalText(ocrBody.reason),
          p_correlation: correlationId,
          p_key: idempotencyKey,
        });
      case "approve_review":
        return await runRpc(db, "approve_ocr_review", {
          p_actor: auth.data.user.id,
          p_scope: access.scope,
          p_org: ocrBody.organizationId,
          p_review: requiredUuid(ocrBody.reviewId),
          p_notes: optionalText(ocrBody.notes),
          p_correlation: correlationId,
          p_key: idempotencyKey,
        });
      case "reject_review":
        return await runRpc(db, "reject_ocr_review", {
          p_actor: auth.data.user.id,
          p_scope: access.scope,
          p_org: ocrBody.organizationId,
          p_review: requiredUuid(ocrBody.reviewId),
          p_reason: requiredText(ocrBody.reason),
          p_correlation: correlationId,
          p_key: idempotencyKey,
        });
      case "archive_job":
        return await runRpc(db, "archive_ocr_job", {
          p_actor: auth.data.user.id,
          p_scope: access.scope,
          p_org: ocrBody.organizationId,
          p_job: requiredUuid(ocrBody.jobId),
          p_reason: requiredText(ocrBody.reason),
          p_correlation: correlationId,
          p_key: idempotencyKey,
        });
      case "reconcile":
        return await runRpc(db, "reconcile_ocr_jobs", {
          p_org: ocrBody.organizationId,
          p_limit: typeof ocrBody.limit === "number" ? ocrBody.limit : 100,
        });
      default:
        return fail(400, "invalid_action", "Accion OCR no permitida.");
    }
  } catch (caught) {
    return fail(400, "invalid_request", caught instanceof Error ? caught.message : "Payload invalido.");
  }
});

async function requestOcr(
  db: DbClient,
  actor: string,
  scope: Scope,
  body: OcrCommandBody,
  idempotencyKey: string,
  correlationId: string,
) {
  const providerCode = ["mock_local", "legacy_leer_albaran"].includes(String(body.providerCode))
    ? String(body.providerCode)
    : "mock_local";

  return await runRpc(db, "request_document_ocr", {
    p_actor: actor,
    p_scope: scope,
    p_org: body.organizationId,
    p_document: requiredUuid(body.documentId),
    p_document_version: requiredUuid(body.documentVersionId),
    p_provider_code: providerCode,
    p_payload: record(body.payload) ? body.payload : {},
    p_correlation: correlationId,
    p_key: idempotencyKey,
  });
}

async function processNext(
  db: DbClient,
  actor: string,
  scope: Scope,
  body: OcrCommandBody,
  correlationId: string,
) {
  const queue = await db
    .from("ocr_jobs")
    .select(
      "id,organization_id,document_id,document_version_id,provider_code,payload,status,attempt_count,max_attempts",
    )
    .eq("organization_id", body.organizationId)
    .in("status", ["queued", "failed"])
    .order("requested_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (queue.error) return databaseError(queue.error.code, queue.error.message);
  if (!queue.data) return respond(200, { processed: false, reason: "no_pending_jobs" });
  if (queue.data.status === "failed" && queue.data.attempt_count >= queue.data.max_attempts) {
    return respond(200, { processed: false, reason: "max_attempts_reached", jobId: queue.data.id });
  }

  const start = await db.rpc("mark_ocr_processing_started", {
    p_actor: actor,
    p_scope: scope,
    p_org: body.organizationId,
    p_job: queue.data.id,
    p_provider_request_id: crypto.randomUUID(),
    p_correlation: correlationId,
    p_key: crypto.randomUUID(),
  });
  if (start.error) return databaseError(start.error.code, start.error.message);

  const version = await db
    .from("document_versions")
    .select("storage_bucket,storage_path,mime_type")
    .eq("organization_id", body.organizationId)
    .eq("id", queue.data.document_version_id)
    .single();

  if (version.error) {
    await failJob(
      db,
      actor,
      scope,
      body.organizationId as string,
      queue.data.id,
      "document_version_missing",
      version.error.message,
      false,
      correlationId,
    );
    return databaseError(version.error.code, version.error.message);
  }

  const file = await db.storage.from(version.data.storage_bucket).download(version.data.storage_path);
  if (file.error) {
    await failJob(
      db,
      actor,
      scope,
      body.organizationId as string,
      queue.data.id,
      "object_missing",
      file.error.message,
      false,
      correlationId,
    );
    return fail(409, "object_missing", "No se encontro el archivo para OCR.");
  }

  const bytes = new Uint8Array(await file.data.arrayBuffer());
  const provider = createProvider(queue.data.provider_code);

  try {
    const providerResponse = await provider.process({
      jobId: queue.data.id,
      organizationId: body.organizationId as string,
      documentId: queue.data.document_id,
      documentVersionId: queue.data.document_version_id,
      mimeType: version.data.mime_type,
      bytes,
      payload: record(queue.data.payload) ? queue.data.payload : {},
    });

    const completion = await db.rpc("complete_ocr_job_result", {
      p_actor: actor,
      p_scope: scope,
      p_org: body.organizationId,
      p_job: queue.data.id,
      p_result: providerResponse.result,
      p_fields: providerResponse.fields,
      p_correlation: correlationId,
      p_key: crypto.randomUUID(),
    });

    if (completion.error) {
      await failJob(
        db,
        actor,
        scope,
        body.organizationId as string,
        queue.data.id,
        "invalid_result",
        completion.error.message,
        true,
        correlationId,
      );
      return databaseError(completion.error.code, completion.error.message);
    }

    return respond(200, { processed: true, jobId: queue.data.id, completion: completion.data });
  } catch (error) {
    const mapped = error instanceof OcrProviderError
      ? { code: error.code, message: error.message, providerProcessed: error.providerProcessed }
      : provider.mapError(error);
    await failJob(
      db,
      actor,
      scope,
      body.organizationId as string,
      queue.data.id,
      mapped.code,
      mapped.message,
      mapped.providerProcessed,
      correlationId,
    );
    return fail(
      mapped.code === "provider_timeout" ? 504 : 502,
      mapped.code,
      mapped.message,
    );
  }
}

async function failJob(
  db: DbClient,
  actor: string,
  scope: Scope,
  organizationId: string,
  jobId: string,
  failureCode: string,
  failureMessage: string,
  providerProcessed: boolean,
  correlationId: string,
) {
  await db.rpc("fail_ocr_job", {
    p_actor: actor,
    p_scope: scope,
    p_org: organizationId,
    p_job: jobId,
    p_failure_code: failureCode,
    p_failure_message: failureMessage,
    p_provider_processed: providerProcessed,
    p_correlation: correlationId,
    p_key: crypto.randomUUID(),
  });
}

async function runRpc(
  db: DbClient,
  name: keyof Database["public"]["Functions"],
  args: AnyRecord,
) {
  const result = await db.rpc(name, args);
  if (result.error) return databaseError(result.error.code, result.error.message);
  return respond(200, record(result.data) ? result.data : { result: result.data });
}

async function authorize(
  db: DbClient,
  userId: string,
  organizationId: string,
  moduleCode: string,
) {
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
    return deny(500, "access_check_failed", "No se pudo verificar acceso OCR.");
  }
  if (profile.data?.status !== "active") return deny(403, "forbidden", "Perfil inactivo.");

  if (platform.data?.role === "superadmin" && platform.data.status === "active") {
    return { ok: true as const, scope: "platform" as Scope };
  }

  if (
    organization.data?.status !== "active" || membership.data?.role !== "admin_empresa" ||
    membership.data.status !== "active"
  ) {
    return deny(403, "forbidden", "Acceso empresarial no autorizado.");
  }

  const [subscription, override] = await Promise.all([
    db.from("organization_subscriptions").select("plan_id").eq("organization_id", organizationId).maybeSingle(),
    db.from("organization_module_overrides").select("override_mode").eq("organization_id", organizationId).eq(
      "module_id",
      module.data.id,
    ).maybeSingle(),
  ]);

  if (subscription.error || override.error) {
    return deny(500, "access_check_failed", "No se pudo resolver modulo OCR.");
  }

  let enabled = override.data?.override_mode === "enabled";
  if (!override.data && subscription.data) {
    const plan = await db.from("plan_modules").select("enabled").eq("plan_id", subscription.data.plan_id).eq(
      "module_id",
      module.data.id,
    ).maybeSingle();
    if (plan.error) return deny(500, "access_check_failed", "No se pudo resolver plan OCR.");
    enabled = plan.data?.enabled === true;
  }

  if (override.data?.override_mode === "disabled" || !enabled) {
    return deny(403, "module_disabled", "El modulo OCR esta desactivado.");
  }

  return { ok: true as const, scope: "organization" as Scope };
}

function record(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredUuid(value: unknown): string {
  if (typeof value !== "string" || !uuid(value)) throw new Error("Identificador UUID invalido.");
  return value;
}

function optionalUuid(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requiredUuid(value);
}

function requiredText(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Texto obligatorio.");
  return value.trim();
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function keyFrom(body: unknown, header: string | null): string | null {
  const value = typeof body === "string" ? body : header ?? crypto.randomUUID();
  return uuid(value) ? value : null;
}

function uuid(value: string) {
  return uuidPattern.test(value);
}

const deny = (status: number, code: string, message: string) => ({ ok: false as const, status, code, message });

function databaseError(code: string | undefined, message: string) {
  if (code === "23505") return fail(409, "idempotency_conflict", message);
  if (code === "P0002") return fail(404, "not_found", message);
  if (code === "42501") return fail(403, "forbidden", message);
  if (code === "23514") {
    if (message.includes("quota")) return fail(409, "quota_exhausted", message);
    return fail(409, "operation_rejected", message);
  }
  if (["22P02", "22023", "55000"].includes(String(code))) return fail(409, "operation_rejected", message);
  return fail(500, "command_failed", "No se pudo ejecutar el comando OCR.");
}
