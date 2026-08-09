export const ocrProviderCodes = ["mock_local", "legacy_leer_albaran"] as const;
export type OcrProviderCode = (typeof ocrProviderCodes)[number];

export const ocrJobStatuses = [
  "queued",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
  "needs_review",
  "reviewed",
  "archived",
] as const;
export type OcrJobStatus = (typeof ocrJobStatuses)[number];

export const ocrFieldValidationStatuses = [
  "extracted",
  "valid",
  "uncertain",
  "invalid",
  "missing",
  "not_applicable",
] as const;
export type OcrFieldValidationStatus = (typeof ocrFieldValidationStatuses)[number];

export const ocrReviewStatuses = ["pending", "in_progress", "approved", "rejected", "archived"] as const;
export type OcrReviewStatus = (typeof ocrReviewStatuses)[number];

export const ocrOutboxEventTypes = [
  "ocr.requested",
  "ocr.processing_started",
  "ocr.provider_call_required",
  "ocr.succeeded",
  "ocr.failed",
  "ocr.review_required",
  "ocr.review_approved",
  "ocr.review_rejected",
  "ocr.quota_reserved",
  "ocr.quota_committed",
  "ocr.quota_released",
  "ocr.reconciliation_required",
] as const;
export type OcrOutboxEventType = (typeof ocrOutboxEventTypes)[number];

export const normalizedOcrFieldCodes = [
  "document_number",
  "issue_date",
  "pickup_date",
  "delivery_date",
  "sender_name",
  "sender_tax_id",
  "recipient_name",
  "recipient_tax_id",
  "carrier_name",
  "carrier_tax_id",
  "origin_address",
  "destination_address",
  "vehicle_registration",
  "driver_name",
  "package_count",
  "pallet_count",
  "weight_kg",
  "volume_m3",
  "reference_numbers",
  "observations",
] as const;
export type NormalizedOcrFieldCode = (typeof normalizedOcrFieldCodes)[number];

export interface OcrFieldPayload {
  fieldCode: string;
  rawValue?: unknown;
  normalizedValue?: unknown;
  confidence?: number | null;
  pageNumber?: number | null;
  boundingBox?: Record<string, unknown> | null;
  validationStatus?: OcrFieldValidationStatus;
  warnings?: unknown[];
}

export interface RequestOcrCommand {
  action: "request_ocr";
  organizationId: string;
  documentId: string;
  documentVersionId: string;
  providerCode?: OcrProviderCode;
  payload?: {
    schemaVersion?: string;
    reviewThreshold?: number;
    importantFields?: string[];
    providerMode?: "success" | "low_confidence" | "timeout" | "failure" | "invalid";
  };
  idempotencyKey?: string;
}

export interface OcrReviewCommand {
  action: "start_review" | "approve_review" | "reject_review" | "correct_field";
  organizationId: string;
  jobId?: string;
  resultId?: string;
  reviewId?: string;
  fieldResultId?: string;
  fieldCode?: string;
  correctedValue?: unknown;
  reason?: string;
  notes?: string;
  idempotencyKey?: string;
}

export type OcrCommand = RequestOcrCommand | OcrReviewCommand;
