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
      clients: {
        Row: {
          id: string;
          organization_id: string;
          legal_name: string;
          trade_name: string;
          tax_id: string | null;
          email: string | null;
          external_reference: string | null;
          status: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      document_versions: {
        Row: { storage_bucket: string; storage_path: string; mime_type: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          organization_id: string;
          transport_order_id: string | null;
          title: string;
          document_type: string;
          status: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      drivers: {
        Row: {
          id: string;
          organization_id: string;
          internal_reference: string | null;
          employee_number: string | null;
          display_name: string;
          email: string | null;
          employment_status: string;
        };
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
      locations: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string | null;
          name: string;
          address_line_1: string;
          postal_code: string;
          city: string;
          country_code: string;
          status: string;
        };
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
      ocr_application_proposals: {
        Row: {
          application_status: string;
          comparison_status: string;
          confidence: number | null;
          correlation_id: string;
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_reason: string | null;
          document_id: string;
          field_code: string;
          id: string;
          idempotency_key: string;
          normalized_value_json: Json | null;
          ocr_job_id: string;
          ocr_result_id: string;
          ocr_review_id: string;
          organization_id: string;
          applied_at: string | null;
          applied_by: string | null;
          proposed_value_json: Json;
          current_value_json: Json | null;
          review_status: string;
          source_summary: Json;
          target_entity_id: string | null;
          target_entity_type: string;
          transport_order_id: string;
        };
        Insert: {
          application_status?: string;
          comparison_status: string;
          confidence?: number | null;
          correlation_id: string;
          created_at?: string;
          created_by: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          document_id: string;
          field_code: string;
          id?: string;
          idempotency_key: string;
          normalized_value_json?: Json | null;
          ocr_job_id: string;
          ocr_result_id: string;
          ocr_review_id: string;
          organization_id: string;
          applied_at?: string | null;
          applied_by?: string | null;
          proposed_value_json: Json;
          current_value_json?: Json | null;
          review_status?: string;
          source_summary?: Json;
          target_entity_id?: string | null;
          target_entity_type: string;
          transport_order_id: string;
        };
        Update: {
          application_status?: string;
          confidence?: number | null;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          normalized_value_json?: Json | null;
          applied_at?: string | null;
          applied_by?: string | null;
          current_value_json?: Json | null;
          review_status?: string;
          source_summary?: Json;
        };
        Relationships: [];
      };
      ocr_application_command_idempotency: {
        Row: {
          organization_id: string;
          idempotency_key: string;
          request_hash: string;
          result: Json | null;
          actor_user_id: string;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          organization_id: string;
          idempotency_key: string;
          request_hash: string;
          result?: Json | null;
          actor_user_id: string;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: { request_hash?: string; result?: Json | null; completed_at?: string | null };
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
      ocr_field_results: {
        Row: {
          id: string;
          organization_id: string;
          ocr_result_id: string;
          field_code: string;
          normalized_value: Json | null;
          raw_value: Json | null;
          confidence: number | null;
          validation_status: string;
          page_number: number | null;
          warnings_json: Json;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      ocr_results: {
        Row: {
          id: string;
          organization_id: string;
          ocr_job_id: string;
          document_id: string;
          document_version_id: string;
          normalized_data_json: Json;
          warnings_json: Json;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      ocr_reviews: {
        Row: {
          id: string;
          organization_id: string;
          ocr_job_id: string;
          ocr_result_id: string;
          status: string;
          reviewed_by: string;
          started_at: string;
          completed_at: string | null;
          notes: string | null;
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
      transport_items: {
        Row: {
          id: string;
          organization_id: string;
          transport_order_id: string;
          stop_id: string;
          description: string;
          reference: string | null;
          packages: number;
          pallets: number;
          weight_kg: number | null;
          volume_m3: number | null;
          notes: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      transport_orders: {
        Row: {
          id: string;
          organization_id: string;
          customer_id: string;
          external_reference: string | null;
          planned_pickup_at: string | null;
          planned_delivery_at: string | null;
          notes: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      transport_stops: {
        Row: {
          id: string;
          organization_id: string;
          transport_order_id: string;
          position: number;
          stop_type: string;
          location_id: string;
          notes: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      transport_events: {
        Row: {
          id: string;
          organization_id: string;
          transport_order_id: string;
          event_type: string;
          actor_user_id: string;
          entity_type: string;
          entity_id: string | null;
          payload: Json;
          correlation_id: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          transport_order_id: string | null;
          event_type: string;
          actor_user_id: string;
          entity_type: string;
          entity_id?: string | null;
          payload?: Json;
          correlation_id: string;
        };
        Update: { payload?: Json };
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          organization_id: string;
          registration_plate: string;
          internal_code: string | null;
          status: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      audit_events: {
        Row: {
          id: string;
          organization_id: string;
          actor_user_id: string;
          actor_scope: string;
          action: string;
          entity_type: string;
          entity_id: string | null;
          before_data: Json | null;
          after_data: Json | null;
          reason: string | null;
          correlation_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          actor_user_id: string;
          actor_scope: string;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          before_data?: Json | null;
          after_data?: Json | null;
          reason?: string | null;
          correlation_id: string;
          created_at?: string;
        };
        Update: { reason?: string | null; after_data?: Json | null; before_data?: Json | null };
        Relationships: [];
      };
      internal_notifications: {
        Row: {
          id: string;
          organization_id: string;
          transport_order_id: string | null;
          recipient_user_id: string | null;
          event_type: string;
          title: string;
          payload: Json;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          transport_order_id?: string | null;
          recipient_user_id?: string | null;
          event_type: string;
          title: string;
          payload?: Json;
          status?: string;
          created_at?: string;
        };
        Update: { status?: string; payload?: Json };
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
      apply_ocr_proposals: { Args: AnyRecord; Returns: Json };
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
  transportOrderId?: unknown;
  idempotencyKey?: unknown;
  providerCode?: unknown;
  payload?: unknown;
  documentId?: unknown;
  documentVersionId?: unknown;
  jobId?: unknown;
  resultId?: unknown;
  reviewId?: unknown;
  proposalIds?: unknown;
  decision?: unknown;
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
      case "prepare_application":
        return await prepareApplication(db, auth.data.user.id, access.scope, ocrBody, correlationId, idempotencyKey);
      case "decide_application_proposals":
        return await decideApplicationProposals(
          db,
          auth.data.user.id,
          access.scope,
          ocrBody,
          correlationId,
          idempotencyKey,
        );
      case "apply_proposals":
        return await applyApplicationProposals(
          db,
          auth.data.user.id,
          access.scope,
          ocrBody,
          correlationId,
          idempotencyKey,
        );
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

async function prepareApplication(
  db: DbClient,
  actor: string,
  scope: Scope,
  body: OcrCommandBody,
  correlationId: string,
  idempotencyKey: string,
) {
  const result = await runApplicationCommand(
    db,
    actor,
    body.organizationId,
    idempotencyKey,
    { ...body },
    async () => {
      const [review, result, job, document, order] = await Promise.all([
        db.from("ocr_reviews").select(
          "id,organization_id,ocr_job_id,ocr_result_id,status,reviewed_by,started_at,completed_at,notes",
        ).eq("organization_id", body.organizationId).eq("id", requiredUuid(body.reviewId)).single(),
        db.from("ocr_results").select(
          "id,organization_id,ocr_job_id,document_id,document_version_id,normalized_data_json,warnings_json",
        ).eq("organization_id", body.organizationId).eq("id", requiredUuid(body.resultId)).single(),
        db.from("ocr_jobs").select(
          "id,organization_id,document_id,document_version_id,provider_code,payload,status,attempt_count,max_attempts,requested_at",
        ).eq("organization_id", body.organizationId).eq("id", requiredUuid(body.jobId)).single(),
        db.from("documents").select("id,organization_id,transport_order_id,title,document_type,status").eq(
          "organization_id",
          body.organizationId,
        ).eq("id", requiredUuid(body.documentId)).single(),
        db.from("transport_orders").select(
          "id,organization_id,customer_id,external_reference,planned_pickup_at,planned_delivery_at,notes",
        ).eq("organization_id", body.organizationId).eq("id", requiredUuid(body.transportOrderId)).single(),
      ]);

      if (review.error || result.error || job.error || document.error || order.error) {
        throw new Error(
          review.error?.message ?? result.error?.message ?? job.error?.message ?? document.error?.message ??
            order.error?.message ?? "No se pudo preparar la aplicación OCR.",
        );
      }

      if (review.data.status !== "approved") {
        return {
          ok: false,
          code: "review_not_approved",
          message: "La revisión OCR debe estar aprobada antes de preparar propuestas.",
          summary: emptyApplicationSummary(),
          proposalIds: [],
          correlationId,
          idempotencyKey,
        };
      }

      const fieldResultRows = await db.from("ocr_field_results").select(
        "id,organization_id,ocr_result_id,field_code,normalized_value,raw_value,confidence,validation_status,page_number,warnings_json",
      ).eq("organization_id", body.organizationId).eq("ocr_result_id", result.data.id);
      if (fieldResultRows.error) throw new Error(fieldResultRows.error.message);

      const itemRows = await db.from("transport_items").select(
        "id,organization_id,transport_order_id,stop_id,description,reference,packages,pallets,weight_kg,volume_m3,notes",
      ).eq("organization_id", body.organizationId).eq("transport_order_id", order.data.id).order("created_at", {
        ascending: true,
      });
      if (itemRows.error) throw new Error(itemRows.error.message);

      const stopRows = await db.from("transport_stops").select(
        "id,organization_id,transport_order_id,position,stop_type,location_id,notes",
      ).eq("organization_id", body.organizationId).eq("transport_order_id", order.data.id).order("position", {
        ascending: true,
      });
      if (stopRows.error) throw new Error(stopRows.error.message);

      const proposals = buildApplicationProposalDrafts({
        organizationId: body.organizationId,
        actor,
        correlationId,
        idempotencyKey,
        job: job.data,
        result: result.data,
        review: review.data,
        document: document.data,
        order: order.data,
        itemRows: itemRows.data ?? [],
        stopRows: stopRows.data ?? [],
        fieldRows: fieldResultRows.data ?? [],
        clientRows: (await db.from("clients").select(
          "id,organization_id,legal_name,trade_name,tax_id,email,external_reference,status",
        ).eq("organization_id", body.organizationId).eq("status", "active")).data ?? [],
        locationRows: (await db.from("locations").select(
          "id,organization_id,client_id,name,address_line_1,postal_code,city,country_code,status",
        ).eq("organization_id", body.organizationId).eq("status", "active")).data ?? [],
        vehicleRows: (await db.from("vehicles").select("id,organization_id,registration_plate,internal_code,status").eq(
          "organization_id",
          body.organizationId,
        ).eq("status", "active")).data ?? [],
        driverRows: (await db.from("drivers").select(
          "id,organization_id,internal_reference,employee_number,display_name,email,employment_status",
        ).eq("organization_id", body.organizationId).eq("employment_status", "active")).data ?? [],
      });

      if (proposals.length === 0) {
        return { ok: true, summary: emptyApplicationSummary(), proposalIds: [], correlationId, idempotencyKey };
      }

      const insertResult = await db.from("ocr_application_proposals").insert(
        proposals as Array<Database["public"]["Tables"]["ocr_application_proposals"]["Insert"]>,
      ).select(
        "id,field_code,comparison_status,review_status,application_status,target_entity_type,target_entity_id,current_value_json,proposed_value_json,normalized_value_json,confidence,decision_reason",
      );
      if (insertResult.error) throw new Error(insertResult.error.message);

      const inserted = insertResult.data ?? [];
      const summary = summarizeInsertedApplicationProposals(inserted);

      await db.from("transport_events").insert({
        organization_id: body.organizationId,
        transport_order_id: order.data.id,
        event_type: "ocr.application_prepared",
        actor_user_id: actor,
        entity_type: "ocr_application",
        entity_id: null,
        payload: {
          summary,
          proposalIds: inserted.map((proposal) => proposal.id),
          reviewId: review.data.id,
          resultId: result.data.id,
          jobId: job.data.id,
          documentId: document.data.id,
          correlationId,
          idempotencyKey,
        },
        correlation_id: correlationId,
      });

      await db.from("audit_events").insert({
        organization_id: body.organizationId,
        actor_user_id: actor,
        actor_scope: scope,
        action: "ocr.application_prepared",
        entity_type: "ocr_application",
        entity_id: order.data.id,
        after_data: {
          summary,
          proposalIds: inserted.map((proposal) => proposal.id),
          reviewId: review.data.id,
          resultId: result.data.id,
        },
        correlation_id: correlationId,
      });

      await db.from("internal_notifications").insert({
        organization_id: body.organizationId,
        transport_order_id: order.data.id,
        recipient_user_id: actor,
        event_type: "ocr.application_prepared",
        title: "Aplicacion OCR preparada",
        payload: { summary, proposalIds: inserted.map((proposal) => proposal.id) },
      });

      return { ok: true, summary, proposalIds: inserted.map((proposal) => proposal.id), correlationId, idempotencyKey };
    },
  );

  return respond(200, result);
}

async function decideApplicationProposals(
  db: DbClient,
  actor: string,
  scope: Scope,
  body: OcrCommandBody,
  correlationId: string,
  idempotencyKey: string,
) {
  const proposalIds = Array.isArray(body.proposalIds)
    ? body.proposalIds.filter((value) => typeof value === "string") as string[]
    : [];
  const decision = body.decision === "reject" ? "reject" : "approve";

  const result = await runApplicationCommand(db, actor, body.organizationId, idempotencyKey, {
    proposalIds,
    decision,
    reason: body.reason,
  }, async () => {
    if (proposalIds.length === 0) {
      return {
        ok: false,
        code: "proposal_ids_required",
        message: "Debes seleccionar al menos una propuesta.",
        summary: emptyApplicationSummary(),
        proposalIds: [],
        correlationId,
        idempotencyKey,
      };
    }

    const result = await db.from("ocr_application_proposals").select("*").eq("organization_id", body.organizationId).in(
      "id",
      proposalIds,
    ).order("created_at", { ascending: true });
    if (result.error) throw new Error(result.error.message);
    const proposals = result.data ?? [];
    if (proposals.length !== proposalIds.length) {
      return {
        ok: false,
        code: "proposal_not_found",
        message: "No se encontraron todas las propuestas seleccionadas.",
        summary: emptyApplicationSummary(),
        proposalIds,
        correlationId,
        idempotencyKey,
      };
    }

    for (const proposal of proposals) {
      if (decision === "approve" && proposal.review_status !== "ready") {
        return {
          ok: false,
          code: "proposal_not_ready",
          message: `La propuesta ${proposal.field_code} no está lista para aprobarse.`,
          summary: emptyApplicationSummary(),
          proposalIds,
          correlationId,
          idempotencyKey,
        };
      }
    }

    const nextStatus = decision === "approve" ? "approved" : "rejected";
    const nextReview = decision === "approve" ? "ready" : "ignored";
    const reason = optionalText(body.reason);

    const updateResult = await db.from("ocr_application_proposals").update({
      application_status: nextStatus,
      review_status: nextReview,
      decision_reason: typeof body.reason === "string" ? body.reason : null,
      decided_by: actor,
      decided_at: new Date().toISOString(),
    }).in("id", proposalIds).eq("organization_id", body.organizationId).select(
      "id,field_code,comparison_status,review_status,application_status,target_entity_type,target_entity_id,current_value_json,proposed_value_json,normalized_value_json,confidence,decision_reason",
    );
    if (updateResult.error) throw new Error(updateResult.error.message);

    const summary = summarizeInsertedApplicationProposals(updateResult.data ?? []);

    await db.from("transport_events").insert({
      organization_id: body.organizationId,
      transport_order_id: proposals[0].transport_order_id,
      event_type: decision === "approve" ? "ocr.proposal_approved" : "ocr.proposal_rejected",
      actor_user_id: actor,
      entity_type: "ocr_application_proposal",
      entity_id: proposalIds[0],
      payload: { proposalIds, decision, reason, correlationId, idempotencyKey },
      correlation_id: correlationId,
    });

    await db.from("audit_events").insert({
      organization_id: body.organizationId,
      actor_user_id: actor,
      actor_scope: scope,
      action: decision === "approve" ? "ocr.proposal_approved" : "ocr.proposal_rejected",
      entity_type: "ocr_application_proposal",
      entity_id: proposalIds[0],
      after_data: { proposalIds, decision, reason },
      reason,
      correlation_id: correlationId,
    });

    await db.from("internal_notifications").insert({
      organization_id: body.organizationId,
      transport_order_id: proposals[0].transport_order_id,
      recipient_user_id: actor,
      event_type: decision === "approve" ? "ocr.proposal_approved" : "ocr.proposal_rejected",
      title: decision === "approve" ? "Propuestas OCR aprobadas" : "Propuestas OCR rechazadas",
      payload: { proposalIds, decision, reason },
    });

    return { ok: true, summary, proposalIds, correlationId, idempotencyKey };
  });

  return respond(200, result);
}

async function applyApplicationProposals(
  db: DbClient,
  actor: string,
  scope: Scope,
  body: OcrCommandBody,
  correlationId: string,
  idempotencyKey: string,
) {
  const proposalIds = Array.isArray(body.proposalIds)
    ? body.proposalIds.filter((value) => typeof value === "string") as string[]
    : [];
  return await runRpc(db, "apply_ocr_proposals", {
    p_actor: actor,
    p_scope: scope,
    p_org: body.organizationId,
    p_proposal_ids: proposalIds,
    p_correlation: correlationId,
    p_key: idempotencyKey,
  });
}

async function runApplicationCommand<T>(
  db: DbClient,
  actor: string,
  organizationId: string,
  idempotencyKey: string,
  requestBody: Record<string, unknown>,
  work: () => Promise<T>,
): Promise<T> {
  const requestHash = await sha256Hex(JSON.stringify(requestBody));
  const previous = await db.from("ocr_application_command_idempotency").select("*").eq(
    "organization_id",
    organizationId,
  ).eq("idempotency_key", idempotencyKey).maybeSingle();
  if (previous.error) throw new Error(previous.error.message);
  if (previous.data && previous.data.request_hash !== requestHash) {
    throw new Error("idempotency key reused with different payload");
  }
  if (previous.data?.result) return previous.data.result as T;

  const result = await work();
  const upsertResult = await db.from("ocr_application_command_idempotency").upsert({
    organization_id: organizationId,
    idempotency_key: idempotencyKey,
    request_hash: requestHash,
    actor_user_id: actor,
    result: result as unknown as Json,
    completed_at: new Date().toISOString(),
  });
  if (upsertResult.error) throw new Error(upsertResult.error.message);
  return result;
}

function buildApplicationProposalDrafts(input: {
  organizationId: string;
  actor: string;
  correlationId: string;
  idempotencyKey: string;
  job: Database["public"]["Tables"]["ocr_jobs"]["Row"];
  result: Database["public"]["Tables"]["ocr_results"]["Row"];
  review: Database["public"]["Tables"]["ocr_reviews"]["Row"];
  document: { id: string };
  order: Database["public"]["Tables"]["transport_orders"]["Row"];
  itemRows: Array<Database["public"]["Tables"]["transport_items"]["Row"]>;
  stopRows: Array<Database["public"]["Tables"]["transport_stops"]["Row"]>;
  fieldRows: Array<Database["public"]["Tables"]["ocr_field_results"]["Row"]>;
  clientRows: Array<Database["public"]["Tables"]["clients"]["Row"]>;
  locationRows: Array<Database["public"]["Tables"]["locations"]["Row"]>;
  vehicleRows: Array<Database["public"]["Tables"]["vehicles"]["Row"]>;
  driverRows: Array<Database["public"]["Tables"]["drivers"]["Row"]>;
}) {
  const proposals: Array<Record<string, unknown>> = [];
  const fieldMap = new Map<string, Database["public"]["Tables"]["ocr_field_results"]["Row"]>();
  for (const field of input.fieldRows) fieldMap.set(field.field_code, field);

  const push = (draft: Record<string, unknown>) => proposals.push(draft);

  const itemRow = input.itemRows.length === 1 ? input.itemRows[0] : null;
  const pickupStop = input.stopRows.find((row) => row.stop_type === "pickup") ?? null;
  const deliveryStop = input.stopRows.find((row) => row.stop_type === "delivery") ?? null;

  const orderFieldMappings = [
    [
      "document_number",
      "external_reference",
      input.order.external_reference,
      textFieldValue(
        fieldMap.get("document_number")?.normalized_value ?? fieldMap.get("document_number")?.raw_value ?? null,
      ),
    ],
    [
      "pickup_date",
      "planned_pickup_at",
      input.order.planned_pickup_at,
      textFieldValue(fieldMap.get("pickup_date")?.normalized_value ?? fieldMap.get("pickup_date")?.raw_value ?? null),
    ],
    [
      "delivery_date",
      "planned_delivery_at",
      input.order.planned_delivery_at,
      textFieldValue(
        fieldMap.get("delivery_date")?.normalized_value ?? fieldMap.get("delivery_date")?.raw_value ?? null,
      ),
    ],
    [
      "observations",
      "notes",
      input.order.notes,
      textFieldValue(fieldMap.get("observations")?.normalized_value ?? fieldMap.get("observations")?.raw_value ?? null),
    ],
  ] as const;

  for (const [fieldCode, targetField, currentText, proposedText] of orderFieldMappings) {
    if (proposedText === null) continue;
    const comparison = currentText === null
      ? "new_value"
      : (normalizeText(currentText) === normalizeText(proposedText) ? "exact_match" : "conflict");
    push(proposalDraft({
      input,
      targetEntityType: "transport_order",
      targetEntityId: input.order.id,
      fieldCode: targetField,
      currentValueJson: currentText,
      proposedValueJson: proposedText,
      normalizedValueJson: proposedText,
      confidence: fieldMap.get(fieldCode)?.confidence ?? null,
      comparisonStatus: comparison,
      sourceSummary: { sourceField: fieldCode, targetField, documentId: input.document.id },
    }));
  }

  if (fieldMap.has("origin_address") && pickupStop) {
    const address = textFieldValue(
      fieldMap.get("origin_address")?.normalized_value ?? fieldMap.get("origin_address")?.raw_value ?? null,
    );
    if (address !== null) {
      const match = findLocationCandidate(address, input.locationRows, input.order.customer_id);
      push(proposalDraft({
        input,
        targetEntityType: "transport_stop",
        targetEntityId: pickupStop.id,
        fieldCode: "location_id",
        currentValueJson: pickupStop.location_id,
        proposedValueJson: match?.id ?? { address },
        normalizedValueJson: match
          ? {
            id: match.id,
            name: match.name,
            addressLine1: match.address_line_1,
            postalCode: match.postal_code,
            city: match.city,
          }
          : { address },
        confidence: fieldMap.get("origin_address")?.confidence ?? null,
        comparisonStatus: classifyTargetComparison(pickupStop.location_id, match?.id ?? null, match?.count ?? 0),
        sourceSummary: { sourceField: "origin_address", value: address, stopId: pickupStop.id },
        reviewStatus: match?.count === 1 ? "ready" : match?.count && match.count > 1 ? "conflict" : "pending",
      }));
    }
  }

  if (fieldMap.has("destination_address") && deliveryStop) {
    const address = textFieldValue(
      fieldMap.get("destination_address")?.normalized_value ?? fieldMap.get("destination_address")?.raw_value ?? null,
    );
    if (address !== null) {
      const match = findLocationCandidate(address, input.locationRows, input.order.customer_id);
      push(proposalDraft({
        input,
        targetEntityType: "transport_stop",
        targetEntityId: deliveryStop.id,
        fieldCode: "location_id",
        currentValueJson: deliveryStop.location_id,
        proposedValueJson: match?.id ?? { address },
        normalizedValueJson: match
          ? {
            id: match.id,
            name: match.name,
            addressLine1: match.address_line_1,
            postalCode: match.postal_code,
            city: match.city,
          }
          : { address },
        confidence: fieldMap.get("destination_address")?.confidence ?? null,
        comparisonStatus: classifyTargetComparison(deliveryStop.location_id, match?.id ?? null, match?.count ?? 0),
        sourceSummary: { sourceField: "destination_address", value: address, stopId: deliveryStop.id },
        reviewStatus: match?.count === 1 ? "ready" : match?.count && match.count > 1 ? "conflict" : "pending",
      }));
    }
  }

  const itemFieldMappings = [
    ["package_count", "packages", itemRow?.packages ?? null],
    ["pallet_count", "pallets", itemRow?.pallets ?? null],
    ["weight_kg", "weight_kg", itemRow?.weight_kg ?? null],
    ["volume_m3", "volume_m3", itemRow?.volume_m3 ?? null],
    ["reference_numbers", "reference", itemRow?.reference ?? null],
  ] as const;

  for (const [fieldCode, targetField, currentValue] of itemFieldMappings) {
    const field = fieldMap.get(fieldCode);
    const proposedValue = field ? valueFromJson(field.normalized_value ?? field.raw_value) : null;
    if (proposedValue === null || !itemRow) continue;
    push(proposalDraft({
      input,
      targetEntityType: "transport_item",
      targetEntityId: itemRow.id,
      fieldCode: targetField,
      currentValueJson: currentValue,
      proposedValueJson: proposedValue,
      normalizedValueJson: proposedValue,
      confidence: field?.confidence ?? null,
      comparisonStatus: compareProposal(currentValue, proposedValue),
      sourceSummary: { sourceField: fieldCode, itemId: itemRow.id },
      reviewStatus: compareProposal(currentValue, proposedValue) === "exact_match" ? "ignored" : "ready",
      applicationStatus: compareProposal(currentValue, proposedValue) === "exact_match" ? "archived" : "pending",
    }));
  }

  const clientSuggestions = [
    ["sender_tax_id", "sender_name", input.clientRows],
    ["recipient_tax_id", "recipient_name", input.clientRows],
    ["carrier_tax_id", "carrier_name", input.clientRows],
  ] as const;

  for (const [taxField, nameField, rows] of clientSuggestions) {
    const taxValue = textFieldValue(
      fieldMap.get(taxField)?.normalized_value ?? fieldMap.get(taxField)?.raw_value ?? null,
    );
    const nameValue = textFieldValue(
      fieldMap.get(nameField)?.normalized_value ?? fieldMap.get(nameField)?.raw_value ?? null,
    );
    if (taxValue === null && nameValue === null) continue;
    const match = findClientCandidate({ taxValue, nameValue }, rows);
    push(proposalDraft({
      input,
      targetEntityType: "client",
      targetEntityId: match?.id ?? null,
      fieldCode: taxValue ? taxField : nameField,
      currentValueJson: match?.id ?? null,
      proposedValueJson: { taxId: taxValue, name: nameValue },
      normalizedValueJson: match
        ? { id: match.id, legalName: match.legal_name, tradeName: match.trade_name }
        : { taxId: taxValue, name: nameValue },
      confidence: fieldMap.get(taxField)?.confidence ?? fieldMap.get(nameField)?.confidence ?? null,
      comparisonStatus: match?.count === 1
        ? "new_value"
        : match?.count && match.count > 1
        ? "ambiguous"
        : "target_missing",
      sourceSummary: { sourceField: taxValue ? taxField : nameField },
      reviewStatus: match?.count === 1 ? "ready" : match?.count && match.count > 1 ? "conflict" : "pending",
    }));
  }

  const vehicleValue = textFieldValue(
    fieldMap.get("vehicle_registration")?.normalized_value ?? fieldMap.get("vehicle_registration")?.raw_value ?? null,
  );
  if (vehicleValue) {
    const match = findVehicleCandidate(vehicleValue, input.vehicleRows);
    push(proposalDraft({
      input,
      targetEntityType: "vehicle",
      targetEntityId: match?.id ?? null,
      fieldCode: "vehicle_registration",
      currentValueJson: match?.registration_plate ?? null,
      proposedValueJson: vehicleValue,
      normalizedValueJson: match
        ? { id: match.id, registrationPlate: match.registration_plate }
        : { registrationPlate: vehicleValue },
      confidence: fieldMap.get("vehicle_registration")?.confidence ?? null,
      comparisonStatus: match?.count === 1
        ? "new_value"
        : match?.count && match.count > 1
        ? "ambiguous"
        : "target_missing",
      sourceSummary: { sourceField: "vehicle_registration" },
      reviewStatus: match?.count === 1 ? "ready" : match?.count && match.count > 1 ? "conflict" : "pending",
    }));
  }

  const driverValue = textFieldValue(
    fieldMap.get("driver_name")?.normalized_value ?? fieldMap.get("driver_name")?.raw_value ?? null,
  );
  if (driverValue) {
    const match = findDriverCandidate(driverValue, input.driverRows);
    push(proposalDraft({
      input,
      targetEntityType: "driver",
      targetEntityId: match?.id ?? null,
      fieldCode: "driver_name",
      currentValueJson: match?.display_name ?? null,
      proposedValueJson: driverValue,
      normalizedValueJson: match ? { id: match.id, displayName: match.display_name } : { displayName: driverValue },
      confidence: fieldMap.get("driver_name")?.confidence ?? null,
      comparisonStatus: match?.count === 1
        ? "new_value"
        : match?.count && match.count > 1
        ? "ambiguous"
        : "target_missing",
      sourceSummary: { sourceField: "driver_name" },
      reviewStatus: match?.count === 1 ? "ready" : match?.count && match.count > 1 ? "conflict" : "pending",
    }));
  }

  return proposals.map((proposal) => ({
    ...proposal,
    organization_id: input.organizationId,
    ocr_job_id: input.job.id,
    ocr_result_id: input.result.id,
    ocr_review_id: input.review.id,
    document_id: input.document.id,
    transport_order_id: input.order.id,
    created_by: input.actor,
    idempotency_key: input.idempotencyKey,
    correlation_id: input.correlationId,
  })) as Array<Record<string, unknown>>;
}

function proposalDraft(input: {
  input: {
    organizationId: string;
    actor: string;
    correlationId: string;
    idempotencyKey: string;
    job: { id: string };
    result: { id: string };
    review: { id: string };
    document: { id: string };
    order: { id: string };
  };
  targetEntityType: string;
  targetEntityId: string | null;
  fieldCode: string;
  currentValueJson: Json | null;
  proposedValueJson: Json;
  normalizedValueJson: Json | null;
  confidence: number | null;
  comparisonStatus: string;
  sourceSummary: Record<string, unknown>;
  reviewStatus?: string;
  applicationStatus?: string;
  decisionReason?: string | null;
}) {
  const reviewStatus = input.reviewStatus ??
    (input.comparisonStatus === "exact_match"
      ? "ignored"
      : input.comparisonStatus === "conflict" || input.comparisonStatus === "ambiguous"
      ? "conflict"
      : input.targetEntityId
      ? "ready"
      : "pending");
  return {
    target_entity_type: input.targetEntityType,
    target_entity_id: input.targetEntityId,
    field_code: input.fieldCode,
    current_value_json: input.currentValueJson,
    proposed_value_json: input.proposedValueJson,
    normalized_value_json: input.normalizedValueJson,
    confidence: input.confidence,
    comparison_status: input.comparisonStatus,
    review_status: reviewStatus,
    application_status: input.applicationStatus ?? (reviewStatus === "ignored" ? "archived" : "pending"),
    decision_reason: input.decisionReason ?? null,
    source_summary: input.sourceSummary,
  };
}

function emptyApplicationSummary() {
  return { total: 0, exactMatches: 0, ready: 0, conflicts: 0, invalid: 0, targetMissing: 0 };
}

function summarizeInsertedApplicationProposals(rows: Array<{ comparison_status: string; review_status: string }>) {
  return {
    total: rows.length,
    exactMatches: rows.filter((row) => row.comparison_status === "exact_match").length,
    ready: rows.filter((row) => row.review_status === "ready").length,
    conflicts: rows.filter((row) => row.review_status === "conflict").length,
    invalid: rows.filter((row) => row.review_status === "invalid").length,
    targetMissing: rows.filter((row) => row.comparison_status === "target_missing").length,
  };
}

function compareProposal(currentValue: unknown, proposedValue: unknown): string {
  if (currentValue === null || currentValue === undefined || currentValue === "") return "new_value";
  return JSON.stringify(currentValue) === JSON.stringify(proposedValue) ? "exact_match" : "conflict";
}

function normalizePlate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
  return normalized || null;
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim().replace(/\s+/g, " ").toLowerCase() || null;
  return String(value).trim().replace(/\s+/g, " ").toLowerCase() || null;
}

function textFieldValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  return String(value).trim() || null;
}

function valueFromJson(value: Json | null): Json | null {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value;
  return value;
}

function findClientCandidate(
  criteria: { taxValue: string | null; nameValue: string | null },
  rows: Array<
    { id: string; legal_name: string; trade_name: string; tax_id: string | null; external_reference: string | null }
  >,
) {
  const candidates = rows.filter((row) => {
    const taxMatch = criteria.taxValue !== null &&
      ((row.tax_id && normalizeText(row.tax_id) === normalizeText(criteria.taxValue)) ||
        (row.external_reference && normalizeText(row.external_reference) === normalizeText(criteria.taxValue)));
    const nameMatch = criteria.nameValue !== null &&
      (normalizeText(row.legal_name) === normalizeText(criteria.nameValue) ||
        normalizeText(row.trade_name) === normalizeText(criteria.nameValue));
    return taxMatch || nameMatch;
  });
  return candidates.length === 1
    ? { ...candidates[0], count: candidates.length }
    : candidates.length > 1
    ? { ...candidates[0], count: candidates.length }
    : null;
}

function findVehicleCandidate(value: string, rows: Array<{ id: string; registration_plate: string }>) {
  const match = rows.filter((row) => normalizePlate(row.registration_plate) === normalizePlate(value));
  return match.length === 1
    ? { ...match[0], count: match.length }
    : match.length > 1
    ? { ...match[0], count: match.length }
    : null;
}

function findDriverCandidate(
  value: string,
  rows: Array<
    {
      id: string;
      internal_reference: string | null;
      employee_number: string | null;
      display_name: string;
      email: string | null;
    }
  >,
) {
  const lower = normalizeText(value);
  const match = rows.filter((row) => {
    const referenceMatch = (row.internal_reference && normalizeText(row.internal_reference) === lower) ||
      (row.employee_number && normalizeText(row.employee_number) === lower);
    const emailMatch = row.email && normalizeText(row.email) === lower;
    const nameMatch = normalizeText(row.display_name) === lower;
    return referenceMatch || emailMatch || nameMatch;
  });
  return match.length === 1
    ? { ...match[0], count: match.length }
    : match.length > 1
    ? { ...match[0], count: match.length }
    : null;
}

function findLocationCandidate(
  value: string,
  rows: Array<
    { id: string; client_id: string | null; name: string; address_line_1: string; postal_code: string; city: string }
  >,
  clientId: string | null,
) {
  const normalized = normalizeText(value);
  const match = rows.filter((row) => {
    const addressMatch = normalizeText(row.address_line_1) === normalized || normalizeText(row.name) === normalized;
    const clientMatch = clientId ? row.client_id === clientId : true;
    return clientMatch && addressMatch;
  });
  return match.length === 1
    ? { ...match[0], count: match.length }
    : match.length > 1
    ? { ...match[0], count: match.length }
    : null;
}

function classifyTargetComparison(currentId: string | null, proposedId: string | null, candidateCount: number) {
  if (candidateCount > 1) return "ambiguous";
  if (proposedId === null) return "target_missing";
  return currentId === proposedId ? "exact_match" : "new_value";
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
