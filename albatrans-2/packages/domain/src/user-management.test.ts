import { describe, expect, it } from "vitest";
import { canManageCompanyUsers, canTransitionCompanyUser, userLimitCode, validateInitialPassword } from "./user-management";

describe("gestión empresarial de usuarios", () => {
  it("exige una contraseña inicial robusta sin conservarla", () => {
    expect(validateInitialPassword("débil").valid).toBe(false);
    expect(validateInitialPassword("TemporalK2026!")).toEqual({ valid: true, errors: [] });
  });
  it("limita roles empresariales y nunca concede plataforma", () => {
    expect(canManageCompanyUsers("admin_empresa", "conductor")).toBe(true);
    expect(canManageCompanyUsers("conductor", "conductor")).toBe(false);
    expect(userLimitCode("admin_empresa")).toBe("max_admins");
  });
  it("aplica transiciones conservadoras", () => {
    expect(canTransitionCompanyUser("active", "block_user")).toBe(true);
    expect(canTransitionCompanyUser("deactivated", "reactivate_user")).toBe(true);
    expect(canTransitionCompanyUser("deactivated", "block_user")).toBe(false);
  });
});
