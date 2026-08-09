export type ProviderMode = "success" | "low_confidence" | "timeout" | "failure" | "invalid";

export interface OcrProviderProcessInput {
  jobId: string;
  organizationId: string;
  documentId: string;
  documentVersionId: string;
  mimeType: string;
  bytes: Uint8Array;
  payload: Record<string, unknown>;
}

export interface OcrProviderProcessOutput {
  result: {
    providerCode: string;
    providerModel?: string;
    schemaVersion: string;
    detectedDocumentType?: string;
    detectedLanguage?: string;
    overallConfidence?: number | null;
    rawResponse: Record<string, unknown>;
    normalizedData: Record<string, unknown>;
    warnings: unknown[];
  };
  fields: Array<{
    fieldCode: string;
    rawValue?: unknown;
    normalizedValue?: unknown;
    confidence?: number | null;
    pageNumber?: number | null;
    boundingBox?: Record<string, unknown> | null;
    validationStatus?: "extracted" | "valid" | "uncertain" | "invalid" | "missing" | "not_applicable";
    warnings?: unknown[];
  }>;
}

export class OcrProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly providerProcessed = false,
  ) {
    super(message);
    this.name = "OcrProviderError";
  }
}

export interface OcrProvider {
  code: string;
  process(input: OcrProviderProcessInput): Promise<OcrProviderProcessOutput>;
  healthCheck(): Promise<{ ok: boolean; message?: string }>;
  mapError(error: unknown): { code: string; message: string; providerProcessed: boolean };
}

function defaultFields(confidence: number, status: "valid" | "uncertain"): OcrProviderProcessOutput["fields"] {
  return [
    {
      fieldCode: "document_number",
      rawValue: "ALB-2026-001",
      normalizedValue: "ALB-2026-001",
      confidence,
      validationStatus: status,
      pageNumber: 1,
      warnings: [],
    },
    {
      fieldCode: "issue_date",
      rawValue: "2026-08-05",
      normalizedValue: "2026-08-05",
      confidence,
      validationStatus: status,
      pageNumber: 1,
      warnings: [],
    },
    {
      fieldCode: "carrier_name",
      rawValue: "Albatrans",
      normalizedValue: "Albatrans",
      confidence,
      validationStatus: status,
      pageNumber: 1,
      warnings: [],
    },
    {
      fieldCode: "sender_name",
      rawValue: "Cliente origen",
      normalizedValue: "Cliente origen",
      confidence,
      validationStatus: status,
      pageNumber: 1,
      warnings: [],
    },
    {
      fieldCode: "recipient_name",
      rawValue: "Cliente destino",
      normalizedValue: "Cliente destino",
      confidence,
      validationStatus: status,
      pageNumber: 1,
      warnings: [],
    },
    {
      fieldCode: "reference_numbers",
      rawValue: ["REF-1"],
      normalizedValue: ["REF-1"],
      confidence,
      validationStatus: status,
      pageNumber: 1,
      warnings: [],
    },
  ];
}

export function createProvider(providerCode: string): OcrProvider {
  if (providerCode === "mock_local") return mockLocalProvider;
  if (providerCode === "legacy_leer_albaran") return legacyAdapterProvider;
  throw new OcrProviderError("provider_not_supported", `OCR provider ${providerCode} is not supported.`);
}

const mockLocalProvider: OcrProvider = {
  code: "mock_local",
  async process(input) {
    const mode = String(input.payload.providerMode ?? "success") as ProviderMode;
    if (mode === "timeout") {
      await new Promise((resolve) => setTimeout(resolve, 50));
      throw new OcrProviderError("provider_timeout", "Mock OCR timed out.", true);
    }
    if (mode === "failure") {
      throw new OcrProviderError("provider_failure", "Mock OCR provider failed.", true);
    }
    if (mode === "invalid") {
      return {
        result: {
          providerCode: "mock_local",
          providerModel: "mock-v1",
          schemaVersion: String(input.payload.schemaVersion ?? "1.0.0"),
          detectedDocumentType: "transport_document",
          detectedLanguage: "es",
          overallConfidence: 0.99,
          rawResponse: { invalid: true },
          normalizedData: "invalid" as unknown as Record<string, unknown>,
          warnings: [],
        },
        fields: [],
      };
    }
    const confidence = mode === "low_confidence" ? 0.58 : 0.93;
    const warnings = mode === "low_confidence" ? ["Low confidence extraction"] : [];
    const fieldStatus = mode === "low_confidence" ? "uncertain" : "valid";
    return {
      result: {
        providerCode: "mock_local",
        providerModel: "mock-v1",
        schemaVersion: String(input.payload.schemaVersion ?? "1.0.0"),
        detectedDocumentType: "transport_document",
        detectedLanguage: "es",
        overallConfidence: confidence,
        rawResponse: {
          bytes: input.bytes.byteLength,
          mimeType: input.mimeType,
          checksumSeed: `${input.documentId}:${input.documentVersionId}`,
          mode,
        },
        normalizedData: {
          document_number: "ALB-2026-001",
          issue_date: "2026-08-05",
          sender_name: "Cliente origen",
          recipient_name: "Cliente destino",
          carrier_name: "Albatrans",
          reference_numbers: ["REF-1"],
          observations: mode === "low_confidence" ? null : "Entrega parcial",
        },
        warnings,
      },
      fields: defaultFields(confidence, fieldStatus),
    };
  },
  healthCheck() {
    return Promise.resolve({ ok: true });
  },
  mapError(error) {
    if (error instanceof OcrProviderError) {
      return { code: error.code, message: error.message, providerProcessed: error.providerProcessed };
    }
    return {
      code: "provider_failure",
      message: error instanceof Error ? error.message : "Unknown OCR provider error.",
      providerProcessed: true,
    };
  },
};

const legacyAdapterProvider: OcrProvider = {
  code: "legacy_leer_albaran",
  async process(input) {
    const endpoint = Deno.env.get("LEGACY_LEER_ALBARAN_LOCAL_URL");
    if (!endpoint) {
      throw new OcrProviderError(
        "legacy_not_configured",
        "Legacy OCR adapter is not configured for local usage.",
        false,
      );
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: input.documentId,
        documentVersionId: input.documentVersionId,
        mimeType: input.mimeType,
        bytesBase64: btoa(String.fromCharCode(...input.bytes)),
      }),
    });

    if (!response.ok) {
      throw new OcrProviderError("legacy_provider_error", `Legacy adapter responded with ${response.status}.`, true);
    }

    const payload = await response.json();
    if (typeof payload !== "object" || payload === null) {
      throw new OcrProviderError("legacy_invalid_response", "Legacy adapter response is invalid.", true);
    }

    return {
      result: {
        providerCode: "legacy_leer_albaran",
        providerModel: "legacy-adapter",
        schemaVersion: "1.0.0",
        detectedDocumentType: "transport_document",
        detectedLanguage: "es",
        overallConfidence: 0.7,
        rawResponse: payload as Record<string, unknown>,
        normalizedData: {
          observations: "Legacy adapter payload accepted in local mode.",
        },
        warnings: ["Legacy adapter is local-only and non-production."],
      },
      fields: [
        {
          fieldCode: "observations",
          rawValue: "legacy",
          normalizedValue: "Legacy adapter payload accepted in local mode.",
          confidence: 0.7,
          pageNumber: 1,
          validationStatus: "uncertain",
          warnings: ["legacy adapter"],
        },
      ],
    };
  },
  healthCheck() {
    return Promise.resolve({
      ok: Boolean(Deno.env.get("LEGACY_LEER_ALBARAN_LOCAL_URL")),
      message: "Legacy adapter available only in local mode.",
    });
  },
  mapError(error) {
    if (error instanceof OcrProviderError) {
      return { code: error.code, message: error.message, providerProcessed: error.providerProcessed };
    }
    return {
      code: "legacy_provider_error",
      message: error instanceof Error ? error.message : "Legacy provider failed.",
      providerProcessed: true,
    };
  },
};
