import { describe, expect, it } from "vitest";
import {
  hasPlatformActivity,
  validatePlatformDashboardMetrics
} from "./platform-dashboard";

const emptyMetrics = {
  totalOrganizations: 0,
  activeOrganizations: 0,
  restrictedOrganizations: 0,
  totalUsers: 0,
  organizationAdmins: 0,
  drivers: 0
};

describe("métricas de plataforma", () => {
  it("detecta un dashboard vacío", () => {
    expect(hasPlatformActivity(emptyMetrics)).toBe(false);
    expect(
      hasPlatformActivity({ ...emptyMetrics, totalUsers: 1 })
    ).toBe(true);
  });

  it("acepta contadores consistentes", () => {
    const metrics = {
      totalOrganizations: 4,
      activeOrganizations: 2,
      restrictedOrganizations: 1,
      totalUsers: 8,
      organizationAdmins: 2,
      drivers: 5
    };
    expect(validatePlatformDashboardMetrics(metrics)).toBe(metrics);
  });

  it("rechaza números negativos y relaciones imposibles", () => {
    expect(() =>
      validatePlatformDashboardMetrics({
        ...emptyMetrics,
        totalUsers: -1
      })
    ).toThrow("Métrica de plataforma inválida");
    expect(() =>
      validatePlatformDashboardMetrics({
        ...emptyMetrics,
        activeOrganizations: 1
      })
    ).toThrow("organizaciones activas superan el total");
  });
});
