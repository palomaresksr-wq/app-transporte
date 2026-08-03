export const ORGANIZATION_STATUSES = [
  "pending",
  "active",
  "maintenance",
  "blocked",
  "suspended",
  "archived"
] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export const PLAN_CODES = [
  "starter",
  "professional",
  "enterprise",
  "custom"
] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const PLAN_STATUSES = ["active", "inactive", "archived"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = [
  "trial",
  "active",
  "past_due",
  "suspended",
  "cancelled",
  "expired"
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "not_required",
  "pending",
  "paid",
  "overdue",
  "failed"
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface Organization {
  id: string;
  legalName: string;
  tradeName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  countryCode: string;
  timezone: string;
  currencyCode: string;
  status: OrganizationStatus;
  statusReason: string | null;
  statusChangedAt: string;
  statusChangedBy: string | null;
  internalNotes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface Plan {
  id: string;
  code: PlanCode;
  name: string;
  description: string | null;
  status: PlanStatus;
  billingInterval: "monthly" | "yearly" | "custom";
  basePrice: number | null;
  currencyCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationSubscription {
  id: string;
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  paymentStatus: PaymentStatus;
  startsAt: string;
  currentPeriodStartsAt: string | null;
  currentPeriodEndsAt: string | null;
  paidThrough: string | null;
  gracePeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationSummary {
  organization: Organization;
  subscription: OrganizationSubscription | null;
  plan: Plan | null;
  activeAdminCount: number;
  activeDriverCount: number;
  enabledModuleCount: number;
}

export interface OrganizationListItem {
  id: string;
  legalName: string;
  tradeName: string | null;
  taxId: string | null;
  status: OrganizationStatus;
  planCode: PlanCode | null;
  planName: string | null;
  paymentStatus: PaymentStatus | null;
  activeAdminCount: number;
  activeDriverCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationListPage {
  items: readonly OrganizationListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OrganizationListFilters {
  search: string;
  status: OrganizationStatus | "all";
  plan: PlanCode | "all";
  paymentStatus: PaymentStatus | "all";
  page: number;
  pageSize: number;
}
