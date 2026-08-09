import type { OcrProviderCode } from "@albatrans/contracts";
import { validateReviewThreshold } from "@albatrans/domain";
import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../infrastructure/supabase/client";
import type { Database } from "../infrastructure/supabase/database.types";

type Client = SupabaseClient<Database>;
type OcrJobRow = Database["public"]["Tables"]["ocr_jobs"]["Row"];
type OcrResultRow = Database["public"]["Tables"]["ocr_results"]["Row"];
type OcrFieldRow = Database["public"]["Tables"]["ocr_field_results"]["Row"];
type OcrReviewRow = Database["public"]["Tables"]["ocr_reviews"]["Row"];
type OcrCorrectionRow = Database["public"]["Tables"]["ocr_field_corrections"]["Row"];
type OcrReservationRow = Database["public"]["Tables"]["ocr_quota_reservations"]["Row"];

export interface OcrFieldView extends OcrFieldRow {
  corrections: OcrCorrectionRow[];
}

export interface OcrResultView extends OcrResultRow {
  fields: OcrFieldView[];
}

export interface OcrReviewView extends OcrReviewRow {
  corrections: OcrCorrectionRow[];
}

export interface OcrJobView extends OcrJobRow {
  result: OcrResultView | null;
  reviews: OcrReviewView[];
  reservation: OcrReservationRow | null;
}

export interface OcrQuotaSummary {
  used: number;
  reserved: number;
  limit: number | null;
  available: number | null;
}

export interface RequestOcrInput {
  organizationId: string;
  documentId: string;
  documentVersionId: string;
  providerCode?: OcrProviderCode;
  reviewThreshold?: number;
  importantFields?: string[];
  providerMode?: "success" | "low_confidence" | "timeout" | "failure" | "invalid";
  idempotencyKey?: string;
}

export async function requestOcr(input: RequestOcrInput, client: Client = requiredClient()): Promise<Record<string, unknown>> {
  const payload: Record<string, unknown> = {
    schemaVersion: "1.0.0",
    reviewThreshold: validateReviewThreshold(input.reviewThreshold),
    importantFields: input.importantFields ?? [
      "document_number",
      "issue_date",
      "sender_name",
      "recipient_name",
    ],
  };
  if (input.providerMode) payload.providerMode = input.providerMode;
  return invokeOcr(client, {
    action: "request_ocr",
    organizationId: input.organizationId,
    documentId: input.documentId,
    documentVersionId: input.documentVersionId,
    providerCode: input.providerCode ?? "mock_local",
    payload,
    idempotencyKey: input.idempotencyKey ?? crypto.randomUUID(),
  });
}

export async function processNextOcrJob(
  organizationId: string,
  providerMode?: RequestOcrInput["providerMode"],
  client: Client = requiredClient(),
): Promise<Record<string, unknown>> {
  return invokeOcr(client, {
    action: "process_next",
    organizationId,
    providerMode,
    idempotencyKey: crypto.randomUUID(),
  });
}

export async function startOcrReview(
  organizationId: string,
  jobId: string,
  resultId: string,
  notes?: string,
  client: Client = requiredClient(),
): Promise<Record<string, unknown>> {
  return invokeOcr(client, {
    action: "start_review",
    organizationId,
    jobId,
    resultId,
    notes,
    idempotencyKey: crypto.randomUUID(),
  });
}

export async function correctOcrField(
  organizationId: string,
  reviewId: string,
  fieldCode: string,
  correctedValue: unknown,
  options?: { fieldResultId?: string; reason?: string },
  client: Client = requiredClient(),
): Promise<Record<string, unknown>> {
  return invokeOcr(client, {
    action: "correct_field",
    organizationId,
    reviewId,
    fieldCode,
    correctedValue,
    fieldResultId: options?.fieldResultId,
    reason: options?.reason,
    idempotencyKey: crypto.randomUUID(),
  });
}

export async function approveOcrReview(
  organizationId: string,
  reviewId: string,
  notes?: string,
  client: Client = requiredClient(),
): Promise<Record<string, unknown>> {
  return invokeOcr(client, {
    action: "approve_review",
    organizationId,
    reviewId,
    notes,
    idempotencyKey: crypto.randomUUID(),
  });
}

export async function rejectOcrReview(
  organizationId: string,
  reviewId: string,
  reason: string,
  client: Client = requiredClient(),
): Promise<Record<string, unknown>> {
  return invokeOcr(client, {
    action: "reject_review",
    organizationId,
    reviewId,
    reason,
    idempotencyKey: crypto.randomUUID(),
  });
}

export async function loadOcrJobsByDocumentIds(
  organizationId: string,
  documentIds: string[],
  client: Client = requiredClient(),
): Promise<Map<string, OcrJobView[]>> {
  if (documentIds.length === 0) return new Map();

  const [jobsResult, resultsResult, fieldsResult, reviewsResult, correctionsResult, reservationsResult] = await Promise.all([
    client.from("ocr_jobs").select("*").eq("organization_id", organizationId).in("document_id", documentIds).order("requested_at", { ascending: false }),
    client.from("ocr_results").select("*").eq("organization_id", organizationId).in("document_id", documentIds).order("created_at", { ascending: false }),
    client.from("ocr_field_results").select("*").eq("organization_id", organizationId),
    client.from("ocr_reviews").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    client.from("ocr_field_corrections").select("*").eq("organization_id", organizationId).order("corrected_at", { ascending: false }),
    client.from("ocr_quota_reservations").select("*").eq("organization_id", organizationId),
  ]);

  if (jobsResult.error) throw new Error(`No se pudieron cargar trabajos OCR: ${jobsResult.error.message}`);
  if (resultsResult.error) throw new Error(`No se pudieron cargar resultados OCR: ${resultsResult.error.message}`);
  if (fieldsResult.error) throw new Error(`No se pudieron cargar campos OCR: ${fieldsResult.error.message}`);
  if (reviewsResult.error) throw new Error(`No se pudieron cargar revisiones OCR: ${reviewsResult.error.message}`);
  if (correctionsResult.error) throw new Error(`No se pudieron cargar correcciones OCR: ${correctionsResult.error.message}`);
  if (reservationsResult.error) throw new Error(`No se pudieron cargar reservas OCR: ${reservationsResult.error.message}`);

  const jobs = jobsResult.data ?? [];
  const results = resultsResult.data ?? [];
  const fields = fieldsResult.data ?? [];
  const reviews = reviewsResult.data ?? [];
  const corrections = correctionsResult.data ?? [];
  const reservations = reservationsResult.data ?? [];

  const correctionsByReview = new Map<string, OcrCorrectionRow[]>();
  for (const correction of corrections) {
    const current = correctionsByReview.get(correction.ocr_review_id) ?? [];
    current.push(correction);
    correctionsByReview.set(correction.ocr_review_id, current);
  }

  const correctionsByField = new Map<string, OcrCorrectionRow[]>();
  for (const correction of corrections) {
    if (!correction.ocr_field_result_id) continue;
    const current = correctionsByField.get(correction.ocr_field_result_id) ?? [];
    current.push(correction);
    correctionsByField.set(correction.ocr_field_result_id, current);
  }

  const fieldsByResult = new Map<string, OcrFieldView[]>();
  for (const field of fields) {
    const current = fieldsByResult.get(field.ocr_result_id) ?? [];
    current.push({ ...field, corrections: correctionsByField.get(field.id) ?? [] });
    fieldsByResult.set(field.ocr_result_id, current);
  }

  const resultByJob = new Map<string, OcrResultView>();
  for (const result of results) {
    resultByJob.set(result.ocr_job_id, {
      ...result,
      fields: fieldsByResult.get(result.id) ?? [],
    });
  }

  const reviewsByJob = new Map<string, OcrReviewView[]>();
  for (const review of reviews) {
    const current = reviewsByJob.get(review.ocr_job_id) ?? [];
    current.push({ ...review, corrections: correctionsByReview.get(review.id) ?? [] });
    reviewsByJob.set(review.ocr_job_id, current);
  }

  const reservationByJob = new Map<string, OcrReservationRow>();
  for (const reservation of reservations) {
    if (reservation.ocr_job_id) reservationByJob.set(reservation.ocr_job_id, reservation);
  }

  const map = new Map<string, OcrJobView[]>();
  for (const job of jobs) {
    const bucket = map.get(job.document_id) ?? [];
    bucket.push({
      ...job,
      result: resultByJob.get(job.id) ?? null,
      reviews: reviewsByJob.get(job.id) ?? [],
      reservation: reservationByJob.get(job.id) ?? null,
    });
    map.set(job.document_id, bucket);
  }
  return map;
}

export async function loadOcrQuotaSummary(
  organizationId: string,
  client: Client = requiredClient(),
): Promise<OcrQuotaSummary> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const from = start.toISOString();
  const to = next.toISOString();

  const [usage, reservations, limit] = await Promise.all([
    client.from("organization_usage_counters").select("usage_value").eq("organization_id", organizationId).eq("metric_code", "ocr_monthly").eq("period_start", from).maybeSingle(),
    client.from("ocr_quota_reservations").select("quantity,status,reserved_at").eq("organization_id", organizationId).gte("reserved_at", from).lt("reserved_at", to),
    client.rpc("ocr_limit_value_for_organization", { p_org: organizationId, p_limit_code: "max_ocr_monthly" }),
  ]);

  if (usage.error) throw new Error(`No se pudo cargar uso OCR: ${usage.error.message}`);
  if (reservations.error) throw new Error(`No se pudieron cargar reservas OCR: ${reservations.error.message}`);
  if (limit.error) throw new Error(`No se pudo cargar limite OCR: ${limit.error.message}`);

  const used = Number(usage.data?.usage_value ?? 0);
  const reserved = (reservations.data as Array<{ quantity: number; status: string }> | null ?? [])
    .filter((row) => row.status === "reserved")
    .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const maxLimit = typeof limit.data === "number" ? limit.data : null;

  return {
    used,
    reserved,
    limit: maxLimit,
    available: maxLimit === null ? null : Math.max(maxLimit - used - reserved, 0),
  };
}

async function invokeOcr(client: Client, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = await client.functions.invoke<Record<string, unknown>>("ocr", { body });
  if (result.error) {
    if (result.error instanceof FunctionsHttpError) {
      const payload: unknown = await result.error.context.json();
      if (record(payload) && record(payload.error) && typeof payload.error.message === "string") {
        throw new Error(payload.error.message);
      }
    }
    throw result.error;
  }
  if (!record(result.data)) throw new Error("La operacion OCR no devolvio datos.");
  return result.data;
}

function requiredClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no esta configurado.");
  return client;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
