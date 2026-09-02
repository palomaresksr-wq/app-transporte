export const PLATFORM_ROLES = ["superadmin"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const ORGANIZATION_ROLES = ["admin_empresa", "conductor"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export type EffectiveRole = PlatformRole | OrganizationRole | import("./client-portal").ClientPortalRole;

export const PROFILE_STATUSES = ["active", "blocked"] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

export const PLATFORM_ADMIN_STATUSES = ["active", "blocked"] as const;
export type PlatformAdminStatus = (typeof PLATFORM_ADMIN_STATUSES)[number];

export const MEMBERSHIP_STATUSES = [
  "invited",
  "active",
  "blocked",
  "suspended",
  "revoked"
] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export interface Profile {
  userId: string;
  displayName: string;
  phone: string | null;
  locale: string;
  timezone: string;
  status: ProfileStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileRow {
  user_id: string;
  display_name: string;
  phone: string | null;
  locale: string;
  timezone: string;
  status: ProfileStatus;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformAdmin {
  userId: string;
  role: PlatformRole;
  status: PlatformAdminStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  status: MembershipStatus;
  invitedBy: string | null;
  invitedAt: string | null;
  joinedAt: string | null;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccessContext {
  profile: Profile;
  effectiveRole: EffectiveRole;
  platformAdmin: PlatformAdmin | null;
  membership: OrganizationMembership | null;
  clientPortalMembership?: import("./client-portal").ClientPortalMembership | null;
  organization: import("./organizations").Organization | null;
  enabledModules: readonly import("./entitlements").ModuleCode[];
  effectiveLimits: Readonly<
    Partial<
      Record<
        import("./entitlements").LimitCode,
        import("./entitlements").EffectiveLimit
      >
    >
  >;
  mustChangePassword?: boolean;
  onboardingRequired?: boolean;
}
