import { describe, expect, it } from "vitest";
import { normalizeDocumentText, validateDocumentFile, validateDocumentRelations, validatePodTransition } from "./documents";
describe("dominio documental", () => {
  it("normaliza textos y valida archivos", () => { expect(normalizeDocumentText("  Albarán   firmado ", "Título", 200)).toBe("Albarán firmado"); expect(validateDocumentFile("application/pdf", 100)).toEqual({ mimeType: "application/pdf", sizeBytes: 100 }); });
  it("rechaza MIME, tamaño y relaciones inválidos", () => { expect(() => validateDocumentFile("text/html", 1)).toThrow(); expect(() => validateDocumentFile("image/jpeg", 20_000_000)).toThrow(); expect(() => validateDocumentRelations({})).toThrow(); });
  it("valida transiciones POD", () => { expect(validatePodTransition("captured", "confirmed")).toBe("confirmed"); expect(() => validatePodTransition("confirmed", "rejected")).toThrow(); });
});
