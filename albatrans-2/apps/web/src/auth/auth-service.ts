import type {
  AccessContext,
  MembershipStatus,
  Organization,
  OrganizationMembership,
  OrganizationRole,
  OrganizationStatus,
  PlatformAdmin,
  PlatformAdminStatus,
  Profile
} from "@albatrans/contracts";
import { accessDenialReason } from "@albatrans/domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../infrastructure/supabase/client";
import type { Database } from "../infrastructure/supabase/database.types";

type DenialReason = NonNullable<ReturnType<typeof accessDenialReason>>;

export class AccessDeniedError extends Error {
  constructor(
    message: string,
    readonly reason: DenialReason | "access_assignment_missing"
  ) {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await requireSupabase().auth.signInWithPassword({
    email,
    password
  });
  if (error) {
    throw new Error("No se pudo iniciar sesión. Revisa tus credenciales.");
  }
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("No se pudo cerrar la sesión.");
}

export async function requestPasswordReset(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}/restablecer-contrasena`;
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
    redirectTo
  });
  if (error) throw new Error("No se pudo solicitar el restablecimiento.");
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await requireSupabase().auth.updateUser({ password });
  if (error) throw new Error("No se pudo actualizar la contraseña.");
}

export async function loadAccessContext(
  userId: string,
  client: SupabaseClient<Database> = requireSupabase()
): Promise<AccessContext> {
  const { data: profileData, error: profileError } = await client
    .from("profiles")
    .select(
      "user_id,display_name,phone,locale,timezone,status,last_login_at,created_at,updated_at"
    )
    .eq("user_id", userId)
    .single();

  if (profileError || !profileData) {
    throw new AccessDeniedError(
      "Tu cuenta no tiene un perfil de Albatrans.",
      "access_assignment_missing"
    );
  }

  const profile = mapProfile(profileData as Record<string, unknown>);
  if (profile.status !== "active") {
    throw new AccessDeniedError(
      denialMessage("profile_inactive"),
      "profile_inactive"
    );
  }

  const platformResult = await client
    .from("platform_admins")
    .select("user_id,role,status,created_at,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (platformResult.error) {
    throw new Error("No se pudo resolver el rol de plataforma.");
  }
  const platformAdmin = platformResult.data
    ? mapPlatformAdmin(platformResult.data as Record<string, unknown>)
    : null;

  if (platformAdmin) {
    const context: AccessContext = {
      profile,
      effectiveRole: platformAdmin.role,
      platformAdmin,
      membership: null,
      organization: null,
      enabledModules: [],
      effectiveLimits: {}
    };
    const denial = accessDenialReason(context);
    if (denial) throw new AccessDeniedError(denialMessage(denial), denial);
    return context;
  }

  const membershipResult = await client
    .from("organization_memberships")
    .select(
      "id,organization_id,user_id,role,status,invited_by,invited_at,joined_at,suspended_at,created_at,updated_at"
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (membershipResult.error) {
    throw new Error("No se pudo resolver la empresa asignada.");
  }
  const membership = membershipResult.data
    ? mapMembership(membershipResult.data as Record<string, unknown>)
    : null;

  if (!membership) {
    throw new AccessDeniedError(
      "Tu cuenta no tiene un rol de plataforma ni una empresa asignada.",
      "access_assignment_missing"
    );
  }
  if (membership.status !== "active") {
    throw new AccessDeniedError(
      denialMessage("membership_inactive"),
      "membership_inactive"
    );
  }

  const { data: organizationData, error: organizationError } = await client
    .from("organizations")
    .select(
      "id,legal_name,trade_name,tax_id,email,phone,country_code,timezone,currency_code,status,status_reason,status_changed_at,status_changed_by,internal_notes,created_by,created_at,updated_at,archived_at"
    )
    .eq("id", membership.organizationId)
    .maybeSingle();
  if (organizationError) {
    throw new Error("No se pudo comprobar el estado de la empresa.");
  }
  const organization = organizationData
    ? mapOrganization(organizationData as Record<string, unknown>)
    : null;

  const entitlementCodes = ["transport_management", "client_management", "vehicle_management"] as const;
  const entitlementResults = await Promise.all(
    entitlementCodes.map((code) => client.rpc("current_organization_module_enabled", { p_module_code: code }))
  );
  for (const result of entitlementResults) {
    if (result.error) throw new Error("No se pudieron resolver los módulos de la empresa.");
  }
  const enabledModules = entitlementCodes.filter((_, index) => entitlementResults[index]?.data === true);

  const context: AccessContext = {
    profile,
    effectiveRole: membership.role,
    platformAdmin: null,
    membership,
    organization,
    enabledModules,
    effectiveLimits: {}
  };
  const denial = accessDenialReason(context);
  if (denial) throw new AccessDeniedError(denialMessage(denial), denial);
  return context;
}

function requireSupabase(): SupabaseClient<Database> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no está configurado.");
  return client;
}

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    userId: requiredString(row.user_id, "profiles.user_id"),
    displayName: requiredString(row.display_name, "profiles.display_name"),
    phone: nullableString(row.phone),
    locale: requiredString(row.locale, "profiles.locale"),
    timezone: requiredString(row.timezone, "profiles.timezone"),
    status: enumValue(row.status, ["active", "blocked"], "profiles.status"),
    lastLoginAt: nullableString(row.last_login_at),
    createdAt: requiredString(row.created_at, "profiles.created_at"),
    updatedAt: requiredString(row.updated_at, "profiles.updated_at")
  };
}

function mapPlatformAdmin(row: Record<string, unknown>): PlatformAdmin {
  return {
    userId: requiredString(row.user_id, "platform_admins.user_id"),
    role: enumValue(row.role, ["superadmin"], "platform_admins.role"),
    status: enumValue(
      row.status,
      ["active", "blocked"],
      "platform_admins.status"
    ) as PlatformAdminStatus,
    createdAt: requiredString(row.created_at, "platform_admins.created_at"),
    updatedAt: requiredString(row.updated_at, "platform_admins.updated_at")
  };
}

function mapMembership(row: Record<string, unknown>): OrganizationMembership {
  return {
    id: requiredString(row.id, "organization_memberships.id"),
    organizationId: requiredString(
      row.organization_id,
      "organization_memberships.organization_id"
    ),
    userId: requiredString(row.user_id, "organization_memberships.user_id"),
    role: enumValue(
      row.role,
      ["admin_empresa", "conductor"],
      "organization_memberships.role"
    ) as OrganizationRole,
    status: enumValue(
      row.status,
      ["invited", "active", "blocked", "suspended", "revoked"],
      "organization_memberships.status"
    ) as MembershipStatus,
    invitedBy: nullableString(row.invited_by),
    invitedAt: nullableString(row.invited_at),
    joinedAt: nullableString(row.joined_at),
    suspendedAt: nullableString(row.suspended_at),
    createdAt: requiredString(
      row.created_at,
      "organization_memberships.created_at"
    ),
    updatedAt: requiredString(
      row.updated_at,
      "organization_memberships.updated_at"
    )
  };
}

function mapOrganization(row: Record<string, unknown>): Organization {
  return {
    id: requiredString(row.id, "organizations.id"),
    legalName: requiredString(row.legal_name, "organizations.legal_name"),
    tradeName: nullableString(row.trade_name),
    taxId: nullableString(row.tax_id),
    email: nullableString(row.email),
    phone: nullableString(row.phone),
    countryCode: requiredString(row.country_code, "organizations.country_code"),
    timezone: requiredString(row.timezone, "organizations.timezone"),
    currencyCode: requiredString(
      row.currency_code,
      "organizations.currency_code"
    ),
    status: enumValue(
      row.status,
      ["pending", "active", "maintenance", "blocked", "suspended", "archived"],
      "organizations.status"
    ) as OrganizationStatus,
    statusReason: nullableString(row.status_reason),
    statusChangedAt: requiredString(
      row.status_changed_at,
      "organizations.status_changed_at"
    ),
    statusChangedBy: nullableString(row.status_changed_by),
    internalNotes: nullableString(row.internal_notes),
    createdBy: requiredString(row.created_by, "organizations.created_by"),
    createdAt: requiredString(row.created_at, "organizations.created_at"),
    updatedAt: requiredString(row.updated_at, "organizations.updated_at"),
    archivedAt: nullableString(row.archived_at)
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Respuesta inválida: ${field}.`);
  }
  return value;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`Respuesta inválida: ${field}.`);
  }
  return value as T;
}

function denialMessage(reason: DenialReason): string {
  switch (reason) {
    case "profile_inactive":
      return "Tu perfil está bloqueado.";
    case "platform_admin_inactive":
      return "Tu acceso de superadministración está bloqueado.";
    case "membership_missing":
      return "Tu cuenta no tiene una empresa asignada.";
    case "membership_inactive":
      return "Tu acceso a la empresa no está activo.";
    case "organization_missing":
      return "No se pudo encontrar la empresa asignada.";
    case "organization_inactive":
      return "La empresa no está activa.";
  }
}
