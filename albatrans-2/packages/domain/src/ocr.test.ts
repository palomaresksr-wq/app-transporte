import { describe, expect, it } from "vitest";
import { needsHumanReview, normalizeFieldCode, validateConfidence, validateOcrProviderCode, validateReviewThreshold } from "./ocr";

describe("ocr domain", () => {
  it("validates provider and confidence", () => {
    expect(validateOcrProviderCode("mock_local")).toBe("mock_local");
    expect(validateConfidence(0.6)).toBe(0.6);
    expect(validateReviewThreshold(undefined)).toBe(0.85);
  });

  it("rejects invalid values", () => {
    expect(() => validateOcrProviderCode("other")).toThrow();
    expect(() => validateConfidence(1.5)).toThrow();
    expect(() => normalizeFieldCode("#bad")).toThrow();
  });

  it("decides when review is required", () => {
    expect(needsHumanReview({
      overallConfidence: 0.93,
      threshold: 0.85,
      warningsCount: 0,
      hasInvalidField: false,
      missingImportantFields: false,
      detectedDocumentType: "transport_document",
    })).toBe(false);

    expect(needsHumanReview({
      overallConfidence: 0.5,
      threshold: 0.85,
      warningsCount: 0,
      hasInvalidField: false,
      missingImportantFields: false,
      detectedDocumentType: "transport_document",
    })).toBe(true);
  });
});
