import type { MembershipStatus } from "./access";

export interface OrganizationAdministrator {
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
  lastAccessAt: string | null;
  createdAt: string;
  createdByUserId: string | null;
  createdByDisplayName: string | null;
}

export interface OrganizationAdministratorsResult {
  items: readonly OrganizationAdministrator[];
  assignedCount: number;
  effectiveLimit: number | null;
}

export interface AdministratorIdentityInput {
  email: string;
  displayName: string;
  phone: string;
  locale: string;
  timezone: string;
}

export type AdministratorIdentityErrors = Partial<Record<keyof AdministratorIdentityInput, string>>;
export type AdministratorAction = "activate" | "deactivate" | "reset_password" | "resend_invitation" | "delete";
export interface AdministratorCommandResult { userId: string; }
