import { describe, expect, it } from "vitest";
import {
  canConsumeLimit,
  DEFAULT_PLAN_LIMITS,
  planIncludesModule,
  resolveEffectiveLimit,
  resolveEffectiveModule,
  validateCustomLimitValue
} from "./entitlements";

describe("módulos por plan", () => {
  it("configura Starter según las decisiones aprobadas", () => {
    expect(planIncludesModule("starter", "transport_management")).toBe(true);
    expect(planIncludesModule("starter", "client_management")).toBe(true);
    expect(planIncludesModule("starter", "vehicle_management")).toBe(true);
    expect(planIncludesModule("starter", "pod_signature")).toBe(true);
    expect(
      planIncludesModule("starter", "electronic_delivery_notes")
    ).toBe(true);
    expect(planIncludesModule("starter", "ocr")).toBe(false);
    expect(planIncludesModule("starter", "billing")).toBe(false);
    expect(planIncludesModule("starter", "api_access")).toBe(false);
    expect(planIncludesModule("starter", "audit_access")).toBe(false);
  });

  it("configura Profesional sin acceso API", () => {
    expect(planIncludesModule("professional", "ocr")).toBe(true);
    expect(planIncludesModule("professional", "billing")).toBe(true);
    expect(planIncludesModule("professional", "time_tracking")).toBe(true);
    expect(planIncludesModule("professional", "leave_management")).toBe(true);
    expect(planIncludesModule("professional", "exports")).toBe(true);
    expect(planIncludesModule("professional", "reports")).toBe(true);
    expect(planIncludesModule("professional", "audit_access")).toBe(true);
    expect(planIncludesModule("professional", "api_access")).toBe(false);
  });

  it("incluye todos los módulos en Enterprise", () => {
    expect(planIncludesModule("enterprise", "api_access")).toBe(true);
    expect(planIncludesModule("enterprise", "ocr")).toBe(true);
    expect(planIncludesModule("enterprise", "support_access")).toBe(true);
    expect(planIncludesModule("enterprise", "audit_access")).toBe(true);
  });

  it("deja Personalizado sin módulos heredados", () => {
    expect(planIncludesModule("custom", "transport_management")).toBe(false);
    expect(planIncludesModule("custom", "api_access")).toBe(false);
    expect(planIncludesModule("custom", "support_access")).toBe(false);
    expect(planIncludesModule("custom", "audit_access")).toBe(false);
  });
  it("valida overrides personalizados incluyendo capacidad cero", () => {
    expect(validateCustomLimitValue(0)).toBeNull();
    expect(validateCustomLimitValue(25)).toBeNull();
    expect(validateCustomLimitValue(-1)).not.toBeNull();
    expect(validateCustomLimitValue(1.5)).not.toBeNull();
  });
});

describe("resolución de módulos", () => {
  it("da prioridad a los overrides", () => {
    expect(resolveEffectiveModule("ocr", false, "enabled")).toEqual({
      code: "ocr",
      enabled: true,
      source: "organization_override"
    });
    expect(resolveEffectiveModule("billing", true, "disabled")).toEqual({
      code: "billing",
      enabled: false,
      source: "organization_override"
    });
  });

  it("resuelve activar, desactivar y volver a heredar sin alterar el plan", () => {
    expect(resolveEffectiveModule("api_access", false, "enabled").enabled).toBe(true);
    expect(resolveEffectiveModule("billing", true, "disabled").enabled).toBe(false);
    expect(resolveEffectiveModule("billing", true, "inherit")).toEqual({ code: "billing", enabled: true, source: "plan" });
  });

  it("trata support_access y audit_access como módulos normales, no como facultades de plataforma", () => {
    expect(resolveEffectiveModule("support_access", false, "disabled").enabled).toBe(false);
    expect(resolveEffectiveModule("audit_access", false, "enabled").enabled).toBe(true);
  });

  it("hereda del plan sin override", () => {
    expect(resolveEffectiveModule("reports", true, "inherit")).toEqual({
      code: "reports",
      enabled: true,
      source: "plan"
    });
  });

  it("desactiva por defecto lo que el plan no declara", () => {
    expect(resolveEffectiveModule("api_access", undefined, null)).toEqual({
      code: "api_access",
      enabled: false,
      source: "not_in_plan"
    });
  });
});

describe("límites", () => {
  it("define administradores y conductores de Starter y Profesional", () => {
    expect(DEFAULT_PLAN_LIMITS.starter.max_admins).toEqual({
      value: 1
    });
    expect(DEFAULT_PLAN_LIMITS.starter.max_drivers?.value).toBe(5);
    expect(DEFAULT_PLAN_LIMITS.professional.max_admins?.value).toBe(5);
    expect(DEFAULT_PLAN_LIMITS.professional.max_drivers?.value).toBe(25);
  });

  it("asigna valores altos y configurables a Enterprise", () => {
    expect(DEFAULT_PLAN_LIMITS.enterprise.max_admins).toEqual({
      value: 100
    });
    expect(DEFAULT_PLAN_LIMITS.enterprise.max_drivers?.value).toBe(1000);
    expect(DEFAULT_PLAN_LIMITS.enterprise.max_storage_bytes?.value).toBe(
      10995116277760
    );
  });

  it("resuelve overrides personalizados igual para todos los planes", () => {
    expect(
      resolveEffectiveLimit("max_drivers", undefined, {
        mode: "custom",
        value: 12
      })
    ).toEqual({
      code: "max_drivers",
      value: 12,
      source: "organization_override"
    });

    expect(
      resolveEffectiveLimit("max_admins", { value: 100 }, {
        mode: "custom",
        value: 250
      })
    ).toEqual({
      code: "max_admins",
      value: 250,
      source: "organization_override"
    });
  });

  it("trata cero como un límite numérico normal", () => {
    const limit = resolveEffectiveLimit(
      "max_ocr_monthly",
      { value: 0 },
      null
    );
    expect(canConsumeLimit(limit, 0, 1)).toBe(false);
  });

  it("acepta consumo dentro del límite y rechaza el exceso", () => {
    const limit = resolveEffectiveLimit(
      "max_drivers",
      { value: 5 },
      null
    );
    expect(canConsumeLimit(limit, 4, 1)).toBe(true);
    expect(canConsumeLimit(limit, 5, 1)).toBe(false);
  });

  it("rechaza un límite sin valor de plan ni override", () => {
    expect(() =>
      resolveEffectiveLimit("max_documents_total", undefined, null)
    ).toThrow("no está configurado");
  });
});
