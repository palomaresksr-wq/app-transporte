import type { CreateOrganizationErrors, CreateOrganizationInput, UpdateOrganizationErrors, UpdateOrganizationInput } from "@albatrans/contracts";

export function validateCreateOrganization(input: CreateOrganizationInput): { valid: boolean; errors: CreateOrganizationErrors } {
  const errors: CreateOrganizationErrors = {};
  if (!input.legalName.trim()) errors.legalName = "La razón social es obligatoria.";
  else if (input.legalName.trim().length > 160) errors.legalName = "La razón social no puede superar 160 caracteres.";
  if (input.tradeName.trim().length > 160) errors.tradeName = "El nombre comercial no puede superar 160 caracteres.";
  if (input.taxId.trim().length > 32) errors.taxId = "El NIF/CIF no puede superar 32 caracteres.";
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.email = "Introduce un correo electrónico válido.";
  if (input.email.trim().length > 254) errors.email = "El correo no puede superar 254 caracteres.";
  if (input.phone.trim().length > 32) errors.phone = "El teléfono no puede superar 32 caracteres.";
  if (!/^[A-Z]{2}$/.test(input.countryCode.trim().toUpperCase())) errors.countryCode = "Usa un código de país ISO de dos letras.";
  if (!input.timezone.trim()) errors.timezone = "La zona horaria es obligatoria.";
  if (!/^[A-Z]{3}$/.test(input.currencyCode.trim().toUpperCase())) errors.currencyCode = "Usa un código de moneda ISO de tres letras.";
  if (input.status !== "pending" && input.status !== "active") errors.status = "El estado inicial no es válido.";
  if (input.internalNotes.trim().length > 2000) errors.internalNotes = "Las notas no pueden superar 2.000 caracteres.";
  return { valid: Object.keys(errors).length === 0, errors };
}

export function normalizeCreateOrganization(input: CreateOrganizationInput): CreateOrganizationInput {
  return {
    legalName: input.legalName.trim(), tradeName: input.tradeName.trim(), taxId: input.taxId.trim().toUpperCase(),
    email: input.email.trim().toLowerCase(), phone: input.phone.trim(), countryCode: input.countryCode.trim().toUpperCase(),
    timezone: input.timezone.trim(), currencyCode: input.currencyCode.trim().toUpperCase(), status: input.status,
    internalNotes: input.internalNotes.trim()
  };
}

export function validateUpdateOrganization(input: UpdateOrganizationInput): { valid: boolean; errors: UpdateOrganizationErrors } {
  const errors: UpdateOrganizationErrors = {};
  if (!input.legalName.trim()) errors.legalName = "La razón social es obligatoria.";
  else if (input.legalName.trim().length > 160) errors.legalName = "La razón social no puede superar 160 caracteres.";
  if (!input.tradeName.trim()) errors.tradeName = "El nombre comercial es obligatorio.";
  else if (input.tradeName.trim().length > 160) errors.tradeName = "El nombre comercial no puede superar 160 caracteres.";
  if (!input.taxId.trim()) errors.taxId = "El NIF/CIF es obligatorio.";
  else if (input.taxId.trim().length > 32) errors.taxId = "El NIF/CIF no puede superar 32 caracteres.";
  if (input.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.email = "Introduce un correo electrónico válido.";
  if (input.email.trim().length > 254) errors.email = "El correo no puede superar 254 caracteres.";
  if (input.phone.trim().length > 32) errors.phone = "El teléfono no puede superar 32 caracteres.";
  if (!/^[A-Z]{2}$/.test(input.countryCode.trim().toUpperCase())) errors.countryCode = "Usa un código de país ISO de dos letras.";
  if (!input.timezone.trim()) errors.timezone = "La zona horaria es obligatoria.";
  if (!/^[A-Z]{3}$/.test(input.currencyCode.trim().toUpperCase())) errors.currencyCode = "Usa un código de moneda ISO de tres letras.";
  if (input.internalNotes.trim().length > 2000) errors.internalNotes = "Las notas no pueden superar 2.000 caracteres.";
  return { valid: Object.keys(errors).length === 0, errors };
}

export function normalizeUpdateOrganization(input: UpdateOrganizationInput): UpdateOrganizationInput {
  return {
    legalName: input.legalName.trim(),
    tradeName: input.tradeName.trim(),
    taxId: input.taxId.trim().toUpperCase(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    countryCode: input.countryCode.trim().toUpperCase(),
    timezone: input.timezone.trim(),
    currencyCode: input.currencyCode.trim().toUpperCase(),
    internalNotes: input.internalNotes.trim()
  };
}
