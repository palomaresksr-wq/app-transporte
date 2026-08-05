export const MODULE_CODES = [
  "transport_management",
  "transport_execution",
  "document_management",
  "client_management",
  "vehicle_management",
  "pod_signature",
  "electronic_delivery_notes",
  "ocr",
  "billing",
  "time_tracking",
  "leave_management",
  "exports",
  "reports",
  "api_access",
  "support_access",
  "audit_access"
] as const;
export type ModuleCode = (typeof MODULE_CODES)[number];

export const MODULE_OVERRIDE_MODES = [
  "inherit",
  "enabled",
  "disabled"
] as const;
export type ModuleOverrideMode = (typeof MODULE_OVERRIDE_MODES)[number];

export const LIMIT_CODES = [
  "max_admins",
  "max_drivers",
  "max_documents_total",
  "max_documents_monthly",
  "max_ocr_monthly",
  "max_storage_bytes",
  "max_exports_monthly"
] as const;
export type LimitCode = (typeof LIMIT_CODES)[number];

export const LIMIT_OVERRIDE_MODES = [
  "inherit",
  "custom"
] as const;
export type LimitOverrideMode = (typeof LIMIT_OVERRIDE_MODES)[number];

export type LimitUnit = "count" | "bytes" | "requests";
export type LimitPeriod = "total" | "monthly" | "daily";
export type LimitEnforcement = "hard" | "soft" | "informational";

export interface ModuleDefinition {
  id: string;
  code: ModuleCode;
  name: string;
  description: string | null;
  status: "active" | "deprecated";
  category: string;
  routePrefix: string | null;
  sortOrder: number;
}

export interface PlanModuleEntitlement {
  planId: string;
  moduleCode: ModuleCode;
  enabled: boolean;
}

export interface OrganizationModuleOverride {
  organizationId: string;
  moduleCode: ModuleCode;
  mode: ModuleOverrideMode;
  reason: string | null;
  changedBy: string;
  changedAt: string;
}

export interface EffectiveModule {
  code: ModuleCode;
  enabled: boolean;
  source: "plan" | "organization_override" | "not_in_plan";
}

export interface LimitDefinition {
  id: string;
  code: LimitCode;
  name: string;
  description: string | null;
  moduleCode: ModuleCode | null;
  unit: LimitUnit;
  period: LimitPeriod;
  enforcement: LimitEnforcement;
  status: "active" | "deprecated";
}

export interface LimitValue {
  value: number;
}

export interface PlanLimit {
  planId: string;
  limitCode: LimitCode;
  limit: LimitValue;
}

export interface OrganizationLimitOverride {
  organizationId: string;
  limitCode: LimitCode;
  mode: LimitOverrideMode;
  value: number | null;
  reason: string | null;
  changedBy: string;
  changedAt: string;
}

export interface EffectiveLimit extends LimitValue {
  code: LimitCode;
  source: "plan" | "organization_override";
}

export interface OrganizationUsageCounter {
  organizationId: string;
  metricCode: string;
  periodStart: string;
  periodEnd: string | null;
  usageValue: number;
  updatedAt: string;
}
