export const ocrApplicationTargetEntityTypes = [
  "transport_order",
  "transport_stop",
  "transport_item",
  "client",
  "location",
  "vehicle",
  "driver",
] as const;
export type OcrApplicationTargetEntityType = (typeof ocrApplicationTargetEntityTypes)[number];

export const ocrApplicationReviewStatuses = ["pending", "ready", "conflict", "invalid", "ignored"] as const;
export type OcrApplicationReviewStatus = (typeof ocrApplicationReviewStatuses)[number];

export const ocrApplicationStatuses = ["pending", "approved", "applied", "rejected", "failed", "archived"] as const;
export type OcrApplicationStatus = (typeof ocrApplicationStatuses)[number];

export const ocrApplicationComparisonStatuses = [
  "exact_match",
  "new_value",
  "conflict",
  "target_missing",
  "invalid",
  "ambiguous",
] as const;
export type OcrApplicationComparisonStatus = (typeof ocrApplicationComparisonStatuses)[number];

export interface OcrApplicationProposalCommandContext {
  organizationId: string;
  ocrJobId: string;
  ocrResultId: string;
  ocrReviewId: string;
  documentId: string;
  transportOrderId: string;
  idempotencyKey?: string;
}

export interface OcrApplicationDecisionCommand {
  organizationId: string;
  proposalId: string;
  decision: "approve" | "reject";
  reason?: string;
  idempotencyKey?: string;
}

export interface OcrApplicationApplyCommand {
  organizationId: string;
  proposalIds: string[];
  idempotencyKey?: string;
}

export interface OcrApplicationProposalPreview {
  fieldCode: string;
  targetEntityType: OcrApplicationTargetEntityType;
  targetEntityId: string | null;
  comparisonStatus: OcrApplicationComparisonStatus;
  reviewStatus: OcrApplicationReviewStatus;
  applicationStatus: OcrApplicationStatus;
  currentValueJson: unknown;
  proposedValueJson: unknown;
  normalizedValueJson: unknown;
  confidence: number | null;
  decisionReason: string | null;
}