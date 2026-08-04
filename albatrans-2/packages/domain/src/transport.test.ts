import { describe, expect, it } from "vitest";
import {
  allowedTransportTransitions,
  nonNegativeDecimal,
  nonNegativeInteger,
  normalizeTransportType,
  TransportValidationError,
  validatePeriod,
  validateTransportTransition,
} from "./transport";
describe("núcleo de transporte", () => {
  it("solo permite transiciones consecutivas, cancelación y archivado terminal", () => {
    expect(allowedTransportTransitions("assigned")).toEqual([
      "loading",
      "cancelled",
    ]);
    expect(validateTransportTransition("unloading", "completed")).toBe(
      "completed",
    );
    expect(() => validateTransportTransition("draft", "completed")).toThrow(
      TransportValidationError,
    );
    expect(() => validateTransportTransition("completed", "assigned"))
      .toThrow();
  });
  it("normaliza tipos empresariales abiertos", () => {
    expect(normalizeTransportType("  Carga   refrigerada ")).toBe(
      "Carga refrigerada",
    );
    expect(() => normalizeTransportType(" ")).toThrow();
  });
  it("valida ventanas temporales", () => {
    expect(() => validatePeriod("2026-01-02", "2026-01-01")).toThrow();
    expect(() => validatePeriod("2026-01-01", "2026-01-02")).not.toThrow();
  });
  it("valida cantidades", () => {
    expect(nonNegativeInteger(0, "Bultos")).toBe(0);
    expect(nonNegativeDecimal("12.5", "Peso")).toBe(12.5);
    expect(() => nonNegativeInteger(1.2, "Palets")).toThrow();
  });
});
