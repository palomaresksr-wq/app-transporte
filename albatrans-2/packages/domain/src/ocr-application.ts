import type {
  OcrApplicationComparisonStatus,
  OcrApplicationProposalPreview,
  OcrApplicationTargetEntityType,
} from "@albatrans/contracts";

export type { OcrApplicationComparisonStatus, OcrApplicationProposalPreview, OcrApplicationTargetEntityType };

export const ocrApplicationTransportFieldCodes = [
  "document_number",
  "pickup_date",
  "delivery_date",
  "origin_address",
  "destination_address",
  "package_count",
  "pallet_count",
  "weight_kg",
  "volume_m3",
  "reference_numbers",
  "observations",
] as const;

export const ocrApplicationSuggestionFieldCodes = [
  "sender_name",
  "sender_tax_id",
  "recipient_name",
  "recipient_tax_id",
  "carrier_name",
  "carrier_tax_id",
  "vehicle_registration",
  "driver_name",
] as const;

export function normalizeOcrApplicationText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return String(value).trim() || null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized : null;
}

export function normalizeOcrApplicationUpper(value: unknown): string | null {
  const text = normalizeOcrApplicationText(value);
  return text ? text.toUpperCase() : null;
}

export function normalizeOcrApplicationLower(value: unknown): string | null {
  const text = normalizeOcrApplicationText(value);
  return text ? text.toLowerCase() : null;
}

export function normalizeOcrApplicationDigits(value: unknown): string | null {
  const text = normalizeOcrApplicationText(value);
  if (!text) return null;
  const digits = text.replace(/\D+/g, "");
  return digits || null;
}

export function classifyOcrApplicationComparison(input: {
  currentValueJson: unknown;
  proposedValueJson: unknown;
  targetEntityId?: string | null;
  candidates?: number;
  valid?: boolean;
}): OcrApplicationComparisonStatus {
  if (input.valid === false) return "invalid";
  if (input.targetEntityId === undefined || input.targetEntityId === null) return "target_missing";
  if ((input.candidates ?? 1) > 1) return "ambiguous";
  if (JSON.stringify(input.currentValueJson) === JSON.stringify(input.proposedValueJson)) return "exact_match";
  if (input.currentValueJson === null || input.currentValueJson === undefined || input.currentValueJson === "") return "new_value";
  return "conflict";
}

export function summarizeOcrApplicationPreview(proposals: OcrApplicationProposalPreview[]) {
  return {
    total: proposals.length,
    exactMatches: proposals.filter((proposal) => proposal.comparisonStatus === "exact_match").length,
    ready: proposals.filter((proposal) => proposal.reviewStatus === "ready").length,
    conflicts: proposals.filter((proposal) => proposal.reviewStatus === "conflict").length,
    invalid: proposals.filter((proposal) => proposal.reviewStatus === "invalid").length,
    targetMissing: proposals.filter((proposal) => proposal.comparisonStatus === "target_missing").length,
  };
}

export function isTransportApplicationFieldCode(value: string): value is (typeof ocrApplicationTransportFieldCodes)[number] {
  return (ocrApplicationTransportFieldCodes as readonly string[]).includes(value);
}

export function isApplicationEditable(proposal: OcrApplicationProposalPreview): boolean {
  return proposal.reviewStatus === "ready" || proposal.reviewStatus === "pending";
}

export function applicationActionLabel(proposal: OcrApplicationProposalPreview): string {
  if (proposal.comparisonStatus === "exact_match") return "Coincide";
  if (proposal.comparisonStatus === "conflict") return "Conflicto";
  if (proposal.comparisonStatus === "target_missing") return "Sin destino";
  if (proposal.comparisonStatus === "ambiguous") return "Ambiguo";
  if (proposal.reviewStatus === "invalid") return "Invalido";
  return "Propuesta";
}