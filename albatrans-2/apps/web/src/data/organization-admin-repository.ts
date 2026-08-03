import type { AdministratorAction, AdministratorCommandResult, AdministratorIdentityInput, OrganizationAdministrator, OrganizationAdministratorsResult } from "@albatrans/contracts";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { getSupabaseClient } from "../infrastructure/supabase/client";

export class AdministratorCommandError extends Error { constructor(readonly code: string, message: string) { super(message); this.name = "AdministratorCommandError"; } }
export async function loadOrganizationAdministrators(organizationId: string): Promise<OrganizationAdministratorsResult> { return invoke({ action: "list", organizationId }, isListResult, "No se pudieron cargar los administradores."); }
export async function createOrganizationAdministrator(organizationId: string, administrator: AdministratorIdentityInput): Promise<AdministratorCommandResult> { return invoke({ action: "create", organizationId, administrator }, isCommandResult, "No se pudo crear el administrador."); }
export async function updateOrganizationAdministrator(organizationId: string, userId: string, administrator: AdministratorIdentityInput): Promise<AdministratorCommandResult> { return invoke({ action: "update", organizationId, userId, administrator }, isCommandResult, "No se pudo editar el administrador."); }
export async function runOrganizationAdministratorAction(organizationId: string, userId: string, action: AdministratorAction): Promise<AdministratorCommandResult> { return invoke({ action, organizationId, userId }, isCommandResult, "No se pudo ejecutar la acción."); }

async function invoke<T>(body: object, validator: (value: unknown) => value is T, fallback: string): Promise<T> {
  const client = getSupabaseClient(); if (!client) throw new Error("Supabase no está configurado."); const result = await client.functions.invoke("platform-organization-admins", { body });
  if (result.error) { if (result.error instanceof FunctionsHttpError) { const value: unknown = await result.error.context.json().catch(() => null); const parsed = commandError(value); if (parsed) throw new AdministratorCommandError(parsed.code, parsed.message); } throw new Error(result.error.message || fallback); }
  if (!validator(result.data)) throw new Error("La API devolvió una respuesta de administradores inválida."); return result.data;
}
function isCommandResult(value: unknown): value is AdministratorCommandResult { return record(value) && typeof value.userId === "string"; }
function isListResult(value: unknown): value is OrganizationAdministratorsResult { return record(value) && Array.isArray(value.items) && value.items.every(isAdministrator) && typeof value.assignedCount === "number" && (value.effectiveLimit === null || typeof value.effectiveLimit === "number"); }
function isAdministrator(value: unknown): value is OrganizationAdministrator { return record(value) && typeof value.membershipId === "string" && typeof value.userId === "string" && typeof value.organizationId === "string" && typeof value.email === "string" && typeof value.displayName === "string" && typeof value.phone === "string" && typeof value.locale === "string" && typeof value.timezone === "string" && profileStatus(value.profileStatus) && membershipStatus(value.membershipStatus) && nullableString(value.lastAccessAt) && typeof value.createdAt === "string" && nullableString(value.createdByUserId) && nullableString(value.createdByDisplayName); }
function commandError(value: unknown): { code: string; message: string } | null { if (!record(value) || !record(value.error) || typeof value.error.code !== "string" || typeof value.error.message !== "string") return null; return { code: value.error.code, message: value.error.message }; }
function membershipStatus(value: unknown): value is OrganizationAdministrator["membershipStatus"] { return value === "invited" || value === "active" || value === "blocked" || value === "suspended" || value === "revoked"; }
function profileStatus(value: unknown): value is OrganizationAdministrator["profileStatus"] { return value === "active" || value === "blocked"; }
function nullableString(value: unknown): value is string | null { return value === null || typeof value === "string"; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
