import type { DriverIdentityErrors, DriverIdentityInput } from "@albatrans/contracts";

export function validateDriverIdentity(input: DriverIdentityInput): { valid: boolean; errors: DriverIdentityErrors } {
  const errors: DriverIdentityErrors = {};
  if (!input.displayName.trim()) errors.displayName = "El nombre es obligatorio.";
  else if (input.displayName.trim().length > 160) errors.displayName = "El nombre no puede superar 160 caracteres.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.email = "Introduce un correo electrónico válido.";
  else if (input.email.trim().length > 254) errors.email = "El correo no puede superar 254 caracteres.";
  if (input.phone.trim().length > 32) errors.phone = "El teléfono no puede superar 32 caracteres.";
  if (!input.locale.trim()) errors.locale = "El idioma es obligatorio.";
  if (!input.timezone.trim()) errors.timezone = "La zona horaria es obligatoria.";
  return { valid: Object.keys(errors).length === 0, errors };
}

export function normalizeDriverIdentity(input: DriverIdentityInput): DriverIdentityInput {
  return { email: input.email.trim().toLowerCase(), displayName: input.displayName.trim(), phone: input.phone.trim(), locale: input.locale.trim().toLowerCase(), timezone: input.timezone.trim() };
}

export function canAssignDriver(assignedCount: number, effectiveLimit: number | null): boolean {
  return Number.isSafeInteger(assignedCount) && assignedCount >= 0 && (effectiveLimit === null || assignedCount < effectiveLimit);
}

