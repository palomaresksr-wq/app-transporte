import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../infrastructure/supabase/client";
import type { Database } from "../infrastructure/supabase/database.types";
import type {
  OcrApplicationComparisonStatus,
  OcrApplicationReviewStatus,
  OcrApplicationStatus,
  OcrApplicationTargetEntityType,
} from "@albatrans/contracts";
import { summarizeOcrApplicationPreview } from "@albatrans/domain";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type Client = SupabaseClient<Database & OcrApplicationSchema>;

type OcrApplicationSchema = {
  public: {
    Tables: {
      ocr_application_proposals: {
        Row: OcrApplicationProposalRow;
        Insert: OcrApplicationProposalInsert;
        Update: OcrApplicationProposalUpdate;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    Views: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export interface OcrApplicationProposalRow {
  id: string;
  organization_id: string;
  ocr_job_id: string;
  ocr_result_id: string;
  ocr_review_id: string;
  document_id: string;
  transport_order_id: string;
  target_entity_type: OcrApplicationTargetEntityType;
  target_entity_id: string | null;
  field_code: string;
  current_value_json: Json | null;
  proposed_value_json: Json;
  normalized_value_json: Json | null;
  confidence: number | null;
  comparison_status: OcrApplicationComparisonStatus;
  review_status: OcrApplicationReviewStatus;
  application_status: OcrApplicationStatus;
  decision_reason: string | null;
  created_by: string;
  created_at: string;
  decided_by: string | null;
  decided_at: string | null;
  applied_by: string | null;
  applied_at: string | null;
  idempotency_key: string;
  correlation_id: string;
  source_summary: Json;
}

export interface OcrApplicationProposalInsert {
  organization_id: string;
  ocr_job_id: string;
  ocr_result_id: string;
  ocr_review_id: string;
  document_id: string;
  transport_order_id: string;
  target_entity_type: OcrApplicationTargetEntityType;
  target_entity_id?: string | null;
  field_code: string;
  current_value_json?: Json | null;
  proposed_value_json: Json;
  normalized_value_json?: Json | null;
  confidence?: number | null;
  comparison_status: OcrApplicationComparisonStatus;
  review_status?: OcrApplicationReviewStatus;
  application_status?: OcrApplicationStatus;
  decision_reason?: string | null;
  created_by: string;
  decided_by?: string | null;
  decided_at?: string | null;
  applied_by?: string | null;
  applied_at?: string | null;
  idempotency_key: string;
  correlation_id: string;
  source_summary?: Json;
}

export interface OcrApplicationProposalUpdate {
  review_status?: OcrApplicationReviewStatus;
  application_status?: OcrApplicationStatus;
  decision_reason?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  applied_by?: string | null;
  applied_at?: string | null;
  source_summary?: Json;
}

export interface OcrApplicationPrepareInput {
  organizationId: string;
  transportOrderId: string;
  documentId: string;
  ocrJobId: string;
  ocrResultId: string;
  ocrReviewId: string;
  providerMode?: "success" | "low_confidence" | "timeout" | "failure" | "invalid";
  idempotencyKey?: string;
}

export interface OcrApplicationPrepareResult {
  ok: boolean;
  summary: ReturnType<typeof summarizeOcrApplicationPreview>;
  proposalIds: string[];
  correlationId?: string;
  idempotencyKey?: string;
  code?: string;
  message?: string;
}

export interface OcrApplicationDecisionInput {
  organizationId: string;
  proposalIds: string[];
  decision: "approve" | "reject";
  reason?: string;
  idempotencyKey?: string;
}

export interface OcrApplicationApplyInput {
  organizationId: string;
  proposalIds: string[];
  idempotencyKey?: string;
}

export async function prepareOcrApplication(
  input: OcrApplicationPrepareInput,
  client: Client = requiredClient(),
): Promise<OcrApplicationPrepareResult> {
  const result = await invokeApplication(client, {
    action: "prepare_application",
    ...input,
    idempotencyKey: input.idempotencyKey ?? crypto.randomUUID(),
  });
  if (!isApplicationResult(result)) {
    throw new Error("La preparación OCR no devolvió una respuesta válida.");
  }
  return result as OcrApplicationPrepareResult;
}

export async function decideOcrApplicationProposals(
  input: OcrApplicationDecisionInput,
  client: Client = requiredClient(),
): Promise<OcrApplicationPrepareResult> {
  const result = await invokeApplication(client, {
    action: "decide_application_proposals",
    ...input,
    idempotencyKey: input.idempotencyKey ?? crypto.randomUUID(),
  });
  if (!isApplicationResult(result)) {
    throw new Error("La decisión OCR no devolvió una respuesta válida.");
  }
  return result as OcrApplicationPrepareResult;
}

export async function applyOcrProposals(
  input: OcrApplicationApplyInput,
  client: Client = requiredClient(),
): Promise<OcrApplicationPrepareResult> {
  const result = await invokeApplication(client, {
    action: "apply_proposals",
    ...input,
    idempotencyKey: input.idempotencyKey ?? crypto.randomUUID(),
  });
  if (!isApplicationResult(result)) {
    throw new Error("La aplicación OCR no devolvió una respuesta válida.");
  }
  return result as OcrApplicationPrepareResult;
}

export async function loadOcrApplicationProposalsByDocumentIds(
  organizationId: string,
  documentIds: string[],
  client: Client = requiredClient(),
): Promise<Map<string, OcrApplicationProposalRow[]>> {
  if (documentIds.length === 0) return new Map();
  const result = await client
    .from("ocr_application_proposals")
    .select("*")
    .eq("organization_id", organizationId)
    .in("document_id", documentIds)
    .order("created_at", { ascending: false });

  if (result.error) throw new Error(`No se pudieron cargar propuestas OCR: ${result.error.message}`);

  const map = new Map<string, OcrApplicationProposalRow[]>();
  for (const row of result.data ?? []) {
    const bucket = map.get(row.document_id) ?? [];
    bucket.push(row);
    map.set(row.document_id, bucket);
  }
  return map;
}

export function summarizeApplicationRows(rows: OcrApplicationProposalRow[]) {
  return summarizeOcrApplicationPreview(
    rows.map((row) => ({
      fieldCode: row.field_code,
      targetEntityType: row.target_entity_type,
      targetEntityId: row.target_entity_id,
      comparisonStatus: row.comparison_status,
      reviewStatus: row.review_status,
      applicationStatus: row.application_status,
      currentValueJson: row.current_value_json,
      proposedValueJson: row.proposed_value_json,
      normalizedValueJson: row.normalized_value_json,
      confidence: row.confidence,
      decisionReason: row.decision_reason,
    })),
  );
}

function requiredClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no está configurado.");
  return client as Client;
}

async function invokeApplication(client: Client, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = await client.functions.invoke<Record<string, unknown>>("ocr", { body });
  if (result.error) {
    if (result.error instanceof FunctionsHttpError) {
      const payload: unknown = await result.error.context.json().catch(() => null);
      if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string") {
        throw new Error(payload.error.message);
      }
    }
    throw result.error;
  }
  if (!isRecord(result.data)) throw new Error("La respuesta OCR de aplicación es invalida.");
  return result.data;
}

function isApplicationResult(value: unknown): value is OcrApplicationPrepareResult {
  return isRecord(value) && typeof value.ok === "boolean";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
