import { describe, expect, it } from "vitest";
import {
  canAccessEffectiveRole,
  effectiveRoleHome,
  isEffectiveRole,
  isOrganizationRole,
  isPlatformRole
} from "./access";

describe("roles definitivos de Albatrans 2.0", () => {
  it("reconoce únicamente los tres roles aprobados", () => {
    expect(isEffectiveRole("superadmin")).toBe(true);
    expect(isEffectiveRole("admin_empresa")).toBe(true);
    expect(isEffectiveRole("conductor")).toBe(true);
    expect(isEffectiveRole("driver")).toBe(false);
    expect(isEffectiveRole("admin_global")).toBe(false);
  });

  it("separa el rol de plataforma de los roles empresariales", () => {
    expect(isPlatformRole("superadmin")).toBe(true);
    expect(isPlatformRole("admin_empresa")).toBe(false);
    expect(isOrganizationRole("admin_empresa")).toBe(true);
    expect(isOrganizationRole("conductor")).toBe(true);
    expect(isOrganizationRole("superadmin")).toBe(false);
  });

  it("resuelve la portada de cada rol definitivo", () => {
    expect(effectiveRoleHome("superadmin")).toBe("/platform");
    expect(effectiveRoleHome("admin_empresa")).toBe("/empresa");
    expect(effectiveRoleHome("conductor")).toBe("/conductor");
  });

  it("no introduce jerarquías implícitas", () => {
    expect(
      canAccessEffectiveRole("admin_empresa", ["admin_empresa"])
    ).toBe(true);
    expect(
      canAccessEffectiveRole("superadmin", ["admin_empresa"])
    ).toBe(false);
  });
});
