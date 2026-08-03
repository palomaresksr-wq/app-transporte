import type { MembershipStatus } from "./access";

export interface OrganizationDriver {
  membershipId: string;
  userId: string;
  organizationId: string;
  email: string;
  displayName: string;
  phone: string;
  locale: string;
  timezone: string;
  profileStatus: "active" | "blocked";
  membershipStatus: MembershipStatus;
  accessActive: boolean;
  invitationPending: boolean;
  lastAccessAt: string | null;
  createdAt: string;
  createdByUserId: string | null;
  createdByDisplayName: string | null;
}

export interface OrganizationDriversResult {
  items: readonly OrganizationDriver[];
  assignedCount: number;
  effectiveLimit: number | null;
}

export interface DriverIdentityInput {
  email: string;
  displayName: string;
  phone: string;
  locale: string;
  timezone: string;
}

export type DriverIdentityErrors = Partial<Record<keyof DriverIdentityInput, string>>;
export type DriverAction = "activate" | "deactivate" | "reset_password" | "resend_invitation" | "delete";
export interface DriverCommandResult { userId: string; }

