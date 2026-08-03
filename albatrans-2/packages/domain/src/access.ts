import type {
  AccessContext,
  EffectiveRole,
  OrganizationRole,
  PlatformRole
} from "@albatrans/contracts";

export type AccessDenialReason =
  | "profile_inactive"
  | "platform_admin_inactive"
  | "membership_missing"
  | "membership_inactive"
  | "organization_missing"
  | "organization_inactive";

export function isPlatformRole(value: unknown): value is PlatformRole {
  return value === "superadmin";
}

export function isOrganizationRole(value: unknown): value is OrganizationRole {
  return value === "admin_empresa" || value === "conductor";
}

export function isEffectiveRole(value: unknown): value is EffectiveRole {
  return isPlatformRole(value) || isOrganizationRole(value);
}

export function effectiveRoleHome(role: EffectiveRole): string {
  switch (role) {
    case "superadmin":
      return "/platform";
    case "admin_empresa":
      return "/empresa";
    case "conductor":
      return "/conductor";
  }
}

export function canAccessEffectiveRole(
  role: EffectiveRole,
  allowedRoles: readonly EffectiveRole[]
): boolean {
  return allowedRoles.includes(role);
}

export function accessDenialReason(
  context: AccessContext
): AccessDenialReason | null {
  if (context.profile.status !== "active") return "profile_inactive";

  if (context.effectiveRole === "superadmin") {
    return context.platformAdmin?.status === "active"
      ? null
      : "platform_admin_inactive";
  }

  if (!context.membership) return "membership_missing";
  if (context.membership.status !== "active") return "membership_inactive";
  if (!context.organization) return "organization_missing";
  if (context.organization.status !== "active") {
    return "organization_inactive";
  }

  return null;
}

export function canAccessApplication(context: AccessContext): boolean {
  return accessDenialReason(context) === null;
}
