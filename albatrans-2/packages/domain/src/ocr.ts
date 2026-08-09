import {
  normalizedOcrFieldCodes,
  ocrFieldValidationStatuses,
  ocrProviderCodes,
  type OcrFieldPayload,
  type OcrFieldValidationStatus,
  type OcrProviderCode,
} from "@albatrans/contracts";

export class OcrValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OcrValidationError";
  }
}

export function validateOcrProviderCode(value: unknown): OcrProviderCode {
  if (typeof value !== "string" || !ocrProviderCodes.includes(value as OcrProviderCode)) {
    throw new OcrValidationError("Proveedor OCR no permitido.");
  }
  return value as OcrProviderCode;
}

export function validateConfidence(value: unknown, label = "confidence"): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new OcrValidationError(`${label} debe estar entre 0 y 1.`);
  }
  return parsed;
}

export function validateReviewThreshold(value: unknown): number {
  const parsed = validateConfidence(value, "reviewThreshold");
  return parsed ?? 0.85;
}

export function normalizeFieldCode(value: unknown): string {
  if (typeof value !== "string") {
    throw new OcrValidationError("fieldCode debe ser texto.");
  }
  const clean = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{0,99}$/.test(clean)) {
    throw new OcrValidationError("fieldCode no tiene formato valido.");
  }
  return clean;
}

export function validateOcrFieldPayload(field: OcrFieldPayload): OcrFieldPayload {
  const fieldCode = normalizeFieldCode(field.fieldCode);
  const confidence = validateConfidence(field.confidence, `confidence de ${fieldCode}`);
  if (
    field.validationStatus !== undefined
    && !ocrFieldValidationStatuses.includes(field.validationStatus as OcrFieldValidationStatus)
  ) {
    throw new OcrValidationError(`Estado de validacion OCR no permitido para ${fieldCode}.`);
  }
  return {
    ...field,
    fieldCode,
    confidence,
    validationStatus: field.validationStatus ?? "extracted",
    warnings: Array.isArray(field.warnings) ? field.warnings : [],
  };
}

export function needsHumanReview(input: {
  overallConfidence: number | null;
  threshold: number;
  warningsCount: number;
  hasInvalidField: boolean;
  missingImportantFields: boolean;
  detectedDocumentType?: string | null;
}): boolean {
  return (
    input.overallConfidence === null
    || input.overallConfidence < input.threshold
    || input.warningsCount > 0
    || input.hasInvalidField
    || input.missingImportantFields
    || !input.detectedDocumentType
  );
}

export function normalizedOcrSchemaImportantFields(): readonly string[] {
  return normalizedOcrFieldCodes;
}
