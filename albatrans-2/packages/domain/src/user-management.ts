import type { EffectiveRole, OrganizationRole } from "@albatrans/contracts";

export interface PasswordValidation { valid: boolean; errors: string[] }

export function validateInitialPassword(password: string): PasswordValidation {
  const errors: string[] = [];
  if (password.length < 12) errors.push("La contraseña debe tener al menos 12 caracteres.");
  if (!/[a-z]/.test(password)) errors.push("Debe incluir una minúscula.");
  if (!/[A-Z]/.test(password)) errors.push("Debe incluir una mayúscula.");
  if (!/[0-9]/.test(password)) errors.push("Debe incluir un número.");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Debe incluir un símbolo.");
  return { valid: errors.length === 0, errors };
}

export function canManageCompanyUsers(actor: EffectiveRole, targetRole: OrganizationRole) {
  if (actor === "superadmin") return true;
  return actor === "admin_empresa" && (targetRole === "admin_empresa" || targetRole === "conductor");
}

export function userLimitCode(role: OrganizationRole) {
  return role === "conductor" ? "max_drivers" : "max_admins";
}

export function canTransitionCompanyUser(from: string, action: string) {
  if (action === "block_user") return from === "active";
  if (action === "reactivate_user") return from === "blocked" || from === "deactivated";
  if (action === "deactivate_user") return from === "active" || from === "blocked";
  return false;
}
