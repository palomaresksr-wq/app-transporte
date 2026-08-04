import type { ExecutionCommand, ExecutionCommandResult } from "@albatrans/contracts";
import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../infrastructure/supabase/client";
import type { Database } from "../infrastructure/supabase/database.types";
type Client = SupabaseClient<Database>;
export interface ExecutionDetail {
  execution: Database["public"]["Tables"]["transport_executions"]["Row"] | null;
  waiting: Database["public"]["Views"]["transport_waiting_times"]["Row"] | null;
  incidents: Database["public"]["Tables"]["transport_incidents"]["Row"][];
  notes: Database["public"]["Tables"]["transport_notes"]["Row"][];
  timeline: Database["public"]["Tables"]["transport_events"]["Row"][];
}
export async function loadExecution(organizationId: string, orderId: string, client: Client = requiredClient()): Promise<ExecutionDetail> {
  const executionResult = await client.from("transport_executions").select("*").eq("organization_id", organizationId).eq("transport_order_id", orderId).maybeSingle();
  if (executionResult.error) throw context("ejecución", executionResult.error);
  const incidentsResult = await client.from("transport_incidents").select("*").eq("organization_id", organizationId).eq("transport_order_id", orderId).order("reported_at", { ascending: false });
  if (incidentsResult.error) throw context("incidencias", incidentsResult.error);
  const notesResult = await client.from("transport_notes").select("*").eq("organization_id", organizationId).eq("transport_order_id", orderId).is("archived_at", null).order("created_at", { ascending: false });
  if (notesResult.error) throw context("notas", notesResult.error);
  const timelineResult = await client.from("transport_events").select("*").eq("organization_id", organizationId).eq("transport_order_id", orderId).order("occurred_at", { ascending: false });
  if (timelineResult.error) throw context("timeline", timelineResult.error);
  let waiting: ExecutionDetail["waiting"] = null;
  if (executionResult.data) {
    const waitingResult = await client.from("transport_waiting_times").select("*").eq("execution_id", executionResult.data.id).maybeSingle();
    if (waitingResult.error) throw context("tiempos", waitingResult.error);
    waiting = waitingResult.data;
  }
  return { execution: executionResult.data, waiting, incidents: incidentsResult.data, notes: notesResult.data, timeline: timelineResult.data };
}
export async function executeExecutionCommand(command: ExecutionCommand, client: Client = requiredClient()): Promise<ExecutionCommandResult> {
  const result = await client.functions.invoke<ExecutionCommandResult>("transport-execution", { body: command });
  if (result.error) {
    if (result.error instanceof FunctionsHttpError) { const body: unknown = await result.error.context.json(); if (isErrorBody(body)) throw new Error(body.error.message); }
    throw result.error;
  }
  if (!result.data) throw new Error("La operación no devolvió resultado.");
  return result.data;
}
function isErrorBody(value: unknown): value is { error: { message: string } } { return typeof value === "object" && value !== null && "error" in value && typeof value.error === "object" && value.error !== null && "message" in value.error && typeof value.error.message === "string"; }
function context(area: string, error: Error) { return new Error(`No se pudo cargar ${area}: ${error.message}`, { cause: error }); }
function requiredClient() { const client = getSupabaseClient(); if (!client) throw new Error("Supabase no está configurado."); return client; }
