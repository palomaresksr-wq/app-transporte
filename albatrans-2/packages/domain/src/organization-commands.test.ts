import { describe, expect, it } from "vitest";
import { normalizeCreateOrganization, normalizeUpdateOrganization, validateCreateOrganization, validateUpdateOrganization } from "./organization-commands";

const valid = { legalName: "Transportes Alba", tradeName: "Alba", taxId: "B123", email: "hola@alba.es", phone: "+34 900", countryCode: "ES", timezone: "Europe/Madrid", currencyCode: "EUR", status: "active" as const, internalNotes: "Local" };

describe("alta de empresa", () => {
  it("acepta y normaliza una empresa válida", () => {
    expect(validateCreateOrganization(valid)).toEqual({ valid: true, errors: {} });
    expect(normalizeCreateOrganization({ ...valid, legalName: "  Alba  ", countryCode: "es" }).legalName).toBe("Alba");
  });
  it("rechaza campos requeridos y formatos inválidos", () => {
    const result = validateCreateOrganization({ ...valid, legalName: "", email: "incorrecto", countryCode: "España", currencyCode: "€" });
    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject({ legalName: expect.any(String), email: expect.any(String), countryCode: expect.any(String), currencyCode: expect.any(String) });
  });
});

describe("edición de datos generales", () => {
  const valid = { legalName: "Transportes Alba SL", tradeName: "Alba", taxId: "B12345678", email: "info@alba.es", phone: "+34 900 000 000", countryCode: "ES", timezone: "Europe/Madrid", currencyCode: "EUR", internalNotes: "Cuenta estratégica" };

  it("exige identificación y códigos regionales válidos", () => {
    const result = validateUpdateOrganization({ ...valid, legalName: " ", tradeName: "", taxId: " ", countryCode: "ESP", currencyCode: "EU", email: "incorrecto" });
    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject({ legalName: expect.any(String), tradeName: expect.any(String), taxId: expect.any(String), countryCode: expect.any(String), currencyCode: expect.any(String), email: expect.any(String) });
  });

  it("normaliza únicamente los datos generales editables", () => {
    expect(normalizeUpdateOrganization({ ...valid, legalName: "  Transportes Alba SL ", taxId: " b12345678 ", email: " INFO@ALBA.ES " })).toMatchObject({ legalName: "Transportes Alba SL", taxId: "B12345678", email: "info@alba.es" });
  });
});
