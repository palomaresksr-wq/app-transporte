import type { OrganizationDetailLimit } from "@albatrans/contracts";

export function usagePercentage(usage: number, limit: number | null): number | null {
  if (limit === null) return null;
  if (limit === 0) return usage === 0 ? 0 : 100;
  return Math.min(100, Math.round((usage / limit) * 100));
}
export function formatLimitUsage(limit: OrganizationDetailLimit): string { return limit.limit === null ? "Sin configuración" : `${limit.usage.toLocaleString("es-ES")} / ${limit.limit.toLocaleString("es-ES")}`; }
