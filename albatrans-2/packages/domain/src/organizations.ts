import type {
  OrganizationStatus,
  PaymentStatus,
  SubscriptionStatus
} from "@albatrans/contracts";

const ALLOWED_STATUS_TRANSITIONS: Readonly<
  Record<OrganizationStatus, readonly OrganizationStatus[]>
> = {
  pending: ["active", "blocked", "archived"],
  active: ["maintenance", "blocked", "suspended", "archived"],
  maintenance: ["active", "blocked", "suspended", "archived"],
  blocked: ["active", "maintenance", "suspended", "archived"],
  suspended: ["active", "maintenance", "blocked", "archived"],
  archived: []
};

export function isOrganizationOperational(
  status: OrganizationStatus
): boolean {
  return status === "active";
}

export function canTransitionOrganizationStatus(
  from: OrganizationStatus,
  to: OrganizationStatus
): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}

export function organizationStatusTransitions(from: OrganizationStatus): readonly OrganizationStatus[] {
  return ALLOWED_STATUS_TRANSITIONS[from];
}

export function requiresOrganizationStatusReason(
  status: OrganizationStatus
): boolean {
  return status === "blocked" || status === "suspended" || status === "archived";
}

export function isSubscriptionUsable(status: SubscriptionStatus): boolean {
  return status === "trial" || status === "active";
}

export function isPaymentAttentionRequired(status: PaymentStatus): boolean {
  return status === "pending" || status === "overdue" || status === "failed";
}
