import type { ModuleCode, ModuleOverrideMode } from "./entitlements";
import type { OrganizationStatus, PaymentStatus, PlanCode, SubscriptionStatus } from "./organizations";

export interface CreateOrganizationInput {
  legalName: string;
  tradeName: string;
  taxId: string;
  email: string;
  phone: string;
  countryCode: string;
  timezone: string;
  currencyCode: string;
  status: Extract<OrganizationStatus, "pending" | "active">;
  internalNotes: string;
}

export interface CreateOrganizationResult { organizationId: string; }
export type CreateOrganizationErrors = Partial<Record<keyof CreateOrganizationInput, string>>;

export interface UpdateOrganizationInput {
  legalName: string;
  tradeName: string;
  taxId: string;
  email: string;
  phone: string;
  countryCode: string;
  timezone: string;
  currencyCode: string;
  internalNotes: string;
}

export interface UpdateOrganizationResult { organizationId: string; }
export type UpdateOrganizationErrors = Partial<Record<keyof UpdateOrganizationInput, string>>;

export type OrganizationCommandErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "tax_id_conflict"
  | "invalid_transition"
  | "reason_required"
  | "plan_not_found"
  | "module_not_found"
  | "limit_not_found"
  | "limit_unconfigured"
  | "administrator_limit_reached"
  | "administrator_conflict"
  | "administrator_dependencies"
  | "driver_limit_reached"
  | "driver_conflict"
  | "driver_dependencies"
  | "delivery_failed"
  | "audit_failed"
  | "update_failed";

export interface OrganizationCommandErrorBody {
  error: {
    code: OrganizationCommandErrorCode;
    message: string;
  };
}

export interface ChangeOrganizationStatusInput {
  status: OrganizationStatus;
  reason: string;
}

export interface ChangeOrganizationStatusResult {
  organizationId: string;
  status: OrganizationStatus;
}

export interface ManageOrganizationSubscriptionInput {
  planCode: PlanCode;
  status: SubscriptionStatus;
  paymentStatus: PaymentStatus;
  startsAt: string;
  currentPeriodStartsAt: string;
  currentPeriodEndsAt: string;
  paidThrough: string;
  gracePeriodEndsAt: string;
  cancelAtPeriodEnd: boolean;
  notes: string;
  reason: string;
}

export type ManageOrganizationSubscriptionErrors = Partial<Record<keyof ManageOrganizationSubscriptionInput, string>>;

export interface ManageOrganizationSubscriptionResult {
  organizationId: string;
  subscriptionId: string;
  created: boolean;
}

export interface ChangeOrganizationModuleInput {
  moduleCode: ModuleCode;
  overrideMode: ModuleOverrideMode;
  reason: string;
}

export interface ChangeOrganizationModuleResult {
  organizationId: string;
  moduleCode: ModuleCode;
  overrideMode: ModuleOverrideMode;
  effectiveEnabled: boolean;
}

export type OrganizationLimitAction = "inherit" | "custom" | "delete";
export interface ChangeOrganizationLimitInput { limitCode: import("./entitlements").LimitCode; action: OrganizationLimitAction; value: number | null; reason: string; }
export interface ChangeOrganizationLimitResult { organizationId: string; limitCode: import("./entitlements").LimitCode; action: OrganizationLimitAction; effectiveValue: number; }
