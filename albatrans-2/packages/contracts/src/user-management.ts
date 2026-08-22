import type { MembershipStatus, OrganizationRole, ProfileStatus } from "./access";

export const COMPANY_USER_ACTIONS = ["create_user", "update_user", "block_user", "reactivate_user", "reset_password", "deactivate_user", "confirm_initial_password"] as const;
export type CompanyUserAction = typeof COMPANY_USER_ACTIONS[number];
export type CompanyUserLifecycleStatus = "pending" | "active" | "blocked" | "deactivated" | "compensated" | "reconciliation_required";

export interface CompanyUserListItem {
  userId: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone: string | null;
  role: OrganizationRole;
  profileStatus: ProfileStatus;
  membershipStatus: MembershipStatus;
  lifecycleStatus: CompanyUserLifecycleStatus;
  mustChangePassword: boolean;
  lastAccessAt: string | null;
  createdAt: string;
}

export interface CreateCompanyUserInput {
  organizationId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: OrganizationRole;
  password: string;
  mustChangePassword: boolean;
  idempotencyKey: string;
}

export interface CompanyUserCommandResult {
  userId: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  status: CompanyUserLifecycleStatus;
  mustChangePassword: boolean;
  idempotent?: boolean;
}
