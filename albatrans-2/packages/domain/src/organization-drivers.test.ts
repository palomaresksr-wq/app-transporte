import { describe, expect, it } from "vitest";
import { canAssignDriver, normalizeDriverIdentity, validateDriverIdentity } from "./organization-drivers";

describe("conductores de empresa", () => {
  it("normaliza únicamente los datos soportados", () => {
    expect(normalizeDriverIdentity({ email: "  DRIVER@ALBA.LOCAL ", displayName: " Conductor Alba ", phone: " +34123 ", locale: " ES ", timezone: " Europe/Madrid " })).toEqual({ email: "driver@alba.local", displayName: "Conductor Alba", phone: "+34123", locale: "es", timezone: "Europe/Madrid" });
  });
  it("valida identidad sin contraseñas, roles ni referencias internas", () => {
    const result = validateDriverIdentity({ email: "incorrecto", displayName: " ", phone: "1".repeat(33), locale: "", timezone: "" });
    expect(result.valid).toBe(false); expect(Object.keys(result.errors).sort()).toEqual(["displayName", "email", "locale", "phone", "timezone"]);
  });
  it("respeta el límite efectivo y permite capacidad no limitada", () => {
    expect(canAssignDriver(4, 5)).toBe(true); expect(canAssignDriver(5, 5)).toBe(false); expect(canAssignDriver(500, null)).toBe(true);
  });
});

