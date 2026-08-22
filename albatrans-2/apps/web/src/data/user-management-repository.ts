import type { CompanyUserCommandResult, CompanyUserListItem, CreateCompanyUserInput } from "@albatrans/contracts";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { getSupabaseClient } from "../infrastructure/supabase/client";

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no está configurado.");
  const result = await client.functions.invoke<T>("user-management", { body });
  if (result.error) {
    if (result.error instanceof FunctionsHttpError) {
      const payload: unknown = await result.error.context.json();
      if (errorPayload(payload)) throw new Error(payload.error.message);
    }
    throw result.error;
  }
  if (result.data === null) throw new Error("Respuesta vacía.");
  return result.data;
}

export async function listCompanyUsers(organizationId?: string) {
  const result = await invoke<{ items: CompanyUserListItem[] }>({ action: "list", organizationId });
  return result.items;
}
export const createCompanyUser = (input: CreateCompanyUserInput) => invoke<CompanyUserCommandResult>({ action: "create_user", ...input });
export const updateCompanyUser = (userId: string, input: { firstName: string; lastName: string; phone: string; locale: string; timezone: string }, organizationId?: string) => invoke<CompanyUserCommandResult>({ action: "update_user", userId, organizationId, ...input });
export const companyUserAction = (action: "block_user" | "reactivate_user" | "deactivate_user", userId: string, organizationId?: string) => invoke<CompanyUserCommandResult>({ action, userId, organizationId });
export const resetCompanyUserPassword = (userId: string, password: string, mustChangePassword: boolean, organizationId?: string) => invoke<CompanyUserCommandResult>({ action: "reset_password", userId, password, mustChangePassword, organizationId });
export const confirmInitialPasswordChange = (organizationId?: string) => invoke<CompanyUserCommandResult>({ action: "confirm_initial_password", organizationId });
function errorPayload(value: unknown): value is { error: { message: string } } { return typeof value === "object" && value !== null && "error" in value && typeof value.error === "object" && value.error !== null && "message" in value.error && typeof value.error.message === "string"; }
