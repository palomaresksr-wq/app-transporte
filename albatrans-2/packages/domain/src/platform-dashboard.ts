import type { PlatformDashboardMetrics } from "@albatrans/contracts";

export function hasPlatformActivity(
  metrics: PlatformDashboardMetrics
): boolean {
  return Object.values(metrics).some((value) => value > 0);
}

export function validatePlatformDashboardMetrics(
  metrics: PlatformDashboardMetrics
): PlatformDashboardMetrics {
  for (const [name, value] of Object.entries(metrics)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Métrica de plataforma inválida: ${name}.`);
    }
  }
  if (metrics.activeOrganizations > metrics.totalOrganizations) {
    throw new Error("Las organizaciones activas superan el total.");
  }
  if (metrics.restrictedOrganizations > metrics.totalOrganizations) {
    throw new Error("Las organizaciones restringidas superan el total.");
  }
  if (
    metrics.organizationAdmins + metrics.drivers >
    metrics.totalUsers
  ) {
    throw new Error("Las membresías superan el total de usuarios.");
  }
  return metrics;
}
