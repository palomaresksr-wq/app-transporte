import type { ChangeOrganizationLimitInput, ChangeOrganizationLimitResult, ChangeOrganizationModuleInput, ChangeOrganizationModuleResult, ChangeOrganizationStatusInput, ChangeOrganizationStatusResult, CreateOrganizationInput, CreateOrganizationResult, ManageOrganizationSubscriptionInput, ManageOrganizationSubscriptionResult, OrganizationCommandErrorBody, OrganizationCommandErrorCode, UpdateOrganizationInput, UpdateOrganizationResult } from "@albatrans/contracts";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { getSupabaseClient } from "../infrastructure/supabase/client";

export async function createOrganization(input: CreateOrganizationInput): Promise<CreateOrganizationResult> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no está configurado.");
  const { data, error } = await client.functions.invoke("platform-organizations", { body: { action: "create", organization: input } });
  if (error) throw new Error(error.message || "No se pudo crear la empresa.");
  if (!isCreateResult(data)) throw new Error("La API devolvió una respuesta de creación inválida.");
  return data;
}

function isCreateResult(value: unknown): value is CreateOrganizationResult {
  return typeof value === "object" && value !== null && "organizationId" in value && typeof value.organizationId === "string" && value.organizationId.length > 0;
}

export class OrganizationCommandError extends Error {
  constructor(public readonly code: OrganizationCommandErrorCode, message: string) {
    super(message);
    this.name = "OrganizationCommandError";
  }
}

export async function loadOrganizationForEdit(organizationId: string): Promise<UpdateOrganizationInput | null> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no está configurado.");
  const result = await client.from("organizations").select("legal_name,trade_name,tax_id,email,phone,country_code,timezone,currency_code,internal_notes").eq("id", organizationId).maybeSingle();
  if (result.error) throw new Error(`No se pudo cargar la empresa: ${result.error.message}`);
  if (!result.data) return null;
  return { legalName: result.data.legal_name, tradeName: result.data.trade_name ?? "", taxId: result.data.tax_id ?? "", email: result.data.email ?? "", phone: result.data.phone ?? "", countryCode: result.data.country_code, timezone: result.data.timezone, currencyCode: result.data.currency_code, internalNotes: result.data.internal_notes ?? "" };
}

export async function updateOrganization(organizationId: string, input: UpdateOrganizationInput): Promise<UpdateOrganizationResult> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no está configurado.");
  const { data, error } = await client.functions.invoke("platform-organizations", { body: { action: "update", organizationId, organization: input } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body: unknown = await error.context.json().catch(() => null);
      if (isCommandErrorBody(body)) throw new OrganizationCommandError(body.error.code, body.error.message);
    }
    throw new Error(error.message || "No se pudo actualizar la empresa.");
  }
  if (!isUpdateResult(data)) throw new Error("La API devolvió una respuesta de actualización inválida.");
  return data;
}

export async function changeOrganizationStatus(organizationId: string, input: ChangeOrganizationStatusInput): Promise<ChangeOrganizationStatusResult> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no está configurado.");
  const { data, error } = await client.functions.invoke("platform-organizations", { body: { action: "change_status", organizationId, status: input.status, reason: input.reason } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body: unknown = await error.context.json().catch(() => null);
      if (isCommandErrorBody(body)) throw new OrganizationCommandError(body.error.code, body.error.message);
    }
    throw new Error(error.message || "No se pudo cambiar el estado de la empresa.");
  }
  if (!isStatusResult(data)) throw new Error("La API devolvió una respuesta de estado inválida.");
  return data;
}

export async function manageOrganizationSubscription(organizationId: string, input: ManageOrganizationSubscriptionInput): Promise<ManageOrganizationSubscriptionResult> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no está configurado.");
  const { data, error } = await client.functions.invoke("platform-organizations", { body: { action: "manage_subscription", organizationId, subscription: input } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body: unknown = await error.context.json().catch(() => null);
      if (isCommandErrorBody(body)) throw new OrganizationCommandError(body.error.code, body.error.message);
    }
    throw new Error(error.message || "No se pudo guardar la suscripción.");
  }
  if (!isSubscriptionResult(data)) throw new Error("La API devolvió una respuesta de suscripción inválida.");
  return data;
}

export async function changeOrganizationModule(organizationId: string, input: ChangeOrganizationModuleInput): Promise<ChangeOrganizationModuleResult> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no está configurado.");
  const { data, error } = await client.functions.invoke("platform-organizations", { body: { action: "change_module", organizationId, moduleCode: input.moduleCode, overrideMode: input.overrideMode, reason: input.reason } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body: unknown = await error.context.json().catch(() => null);
      if (isCommandErrorBody(body)) throw new OrganizationCommandError(body.error.code, body.error.message);
    }
    throw new Error(error.message || "No se pudo cambiar el módulo.");
  }
  if (!isModuleResult(data)) throw new Error("La API devolvió una respuesta de módulo inválida.");
  return data;
}

export async function changeOrganizationLimit(organizationId: string, input: ChangeOrganizationLimitInput): Promise<ChangeOrganizationLimitResult> {
  const client = getSupabaseClient(); if (!client) throw new Error("Supabase no está configurado.");
  const { data, error } = await client.functions.invoke("platform-organizations", { body: { action: "change_limit", organizationId, limitCode: input.limitCode, limitAction: input.action, value: input.value, reason: input.reason } });
  if (error) { if (error instanceof FunctionsHttpError) { const body: unknown = await error.context.json().catch(() => null); if (isCommandErrorBody(body)) throw new OrganizationCommandError(body.error.code, body.error.message); } throw new Error(error.message || "No se pudo cambiar el límite."); }
  if (!isLimitResult(data)) throw new Error("La API devolvió una respuesta de límite inválida."); return data;
}

function isUpdateResult(value: unknown): value is UpdateOrganizationResult {
  return typeof value === "object" && value !== null && "organizationId" in value && typeof value.organizationId === "string" && value.organizationId.length > 0;
}

function isStatusResult(value: unknown): value is ChangeOrganizationStatusResult {
  return typeof value === "object" && value !== null && "organizationId" in value && typeof value.organizationId === "string" && "status" in value && isOrganizationStatus(value.status);
}

function isSubscriptionResult(value: unknown): value is ManageOrganizationSubscriptionResult {
  return typeof value === "object" && value !== null && "organizationId" in value && typeof value.organizationId === "string" && "subscriptionId" in value && typeof value.subscriptionId === "string" && "created" in value && typeof value.created === "boolean";
}

function isModuleResult(value: unknown): value is ChangeOrganizationModuleResult {
  return typeof value === "object" && value !== null && "organizationId" in value && typeof value.organizationId === "string" && "moduleCode" in value && isModuleCode(value.moduleCode) && "overrideMode" in value && isModuleOverrideMode(value.overrideMode) && "effectiveEnabled" in value && typeof value.effectiveEnabled === "boolean";
}
function isLimitResult(value: unknown): value is ChangeOrganizationLimitResult { return typeof value === "object" && value !== null && "organizationId" in value && typeof value.organizationId === "string" && "limitCode" in value && typeof value.limitCode === "string" && "action" in value && (value.action === "inherit" || value.action === "custom" || value.action === "delete") && "effectiveValue" in value && typeof value.effectiveValue === "number"; }

function isModuleCode(value: unknown): value is ChangeOrganizationModuleResult["moduleCode"] { return value === "transport_management" || value === "client_management" || value === "vehicle_management" || value === "pod_signature" || value === "electronic_delivery_notes" || value === "ocr" || value === "billing" || value === "time_tracking" || value === "leave_management" || value === "exports" || value === "reports" || value === "api_access" || value === "support_access" || value === "audit_access"; }
function isModuleOverrideMode(value: unknown): value is ChangeOrganizationModuleResult["overrideMode"] { return value === "inherit" || value === "enabled" || value === "disabled"; }

function isOrganizationStatus(value: unknown): value is ChangeOrganizationStatusResult["status"] {
  return value === "pending" || value === "active" || value === "maintenance" || value === "blocked" || value === "suspended" || value === "archived";
}

function isCommandErrorBody(value: unknown): value is OrganizationCommandErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = value.error;
  if (typeof error !== "object" || error === null || !("code" in error) || !("message" in error)) return false;
  return isCommandErrorCode(error.code) && typeof error.message === "string";
}

function isCommandErrorCode(value: unknown): value is OrganizationCommandErrorCode {
  return value === "invalid_request" || value === "unauthorized" || value === "forbidden" || value === "not_found" || value === "tax_id_conflict" || value === "invalid_transition" || value === "reason_required" || value === "plan_not_found" || value === "module_not_found" || value === "audit_failed" || value === "update_failed";
}
