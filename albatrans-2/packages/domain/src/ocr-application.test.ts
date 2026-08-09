import { describe, expect, it } from "vitest";
import { classifyOcrApplicationComparison, normalizeOcrApplicationDigits, normalizeOcrApplicationText, summarizeOcrApplicationPreview } from "./ocr-application";

describe("ocr-application", () => {
  it("normaliza textos y numeros para matching determinista", () => {
    expect(normalizeOcrApplicationText("  Cliente   origen  ")).toBe("Cliente origen");
    expect(normalizeOcrApplicationDigits(" 1.250 kg ")).toBe("1250");
  });

  it("clasifica coincidencia, conflicto y destino ausente", () => {
    expect(classifyOcrApplicationComparison({ currentValueJson: "ABC", proposedValueJson: "ABC", targetEntityId: "1" })).toBe("exact_match");
    expect(classifyOcrApplicationComparison({ currentValueJson: "ABC", proposedValueJson: "XYZ", targetEntityId: "1" })).toBe("conflict");
    expect(classifyOcrApplicationComparison({ currentValueJson: null, proposedValueJson: "XYZ", targetEntityId: null })).toBe("target_missing");
  });

  it("resume la previsualizacion de propuestas", () => {
    const summary = summarizeOcrApplicationPreview([
      { fieldCode: "document_number", targetEntityType: "transport_order", targetEntityId: "1", comparisonStatus: "exact_match", reviewStatus: "ignored", applicationStatus: "pending", currentValueJson: "A", proposedValueJson: "A", normalizedValueJson: "A", confidence: 1, decisionReason: null },
      { fieldCode: "weight_kg", targetEntityType: "transport_item", targetEntityId: "1", comparisonStatus: "new_value", reviewStatus: "ready", applicationStatus: "pending", currentValueJson: null, proposedValueJson: 1250, normalizedValueJson: 1250, confidence: 0.96, decisionReason: null },
    ]);
    expect(summary.total).toBe(2);
    expect(summary.exactMatches).toBe(1);
    expect(summary.ready).toBe(1);
  });
});