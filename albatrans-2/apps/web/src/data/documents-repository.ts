import type { BeginDocumentUpload, DocumentCommand, DocumentUploadResult } from "@albatrans/contracts";
import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../infrastructure/supabase/client";
import type { Database } from "../infrastructure/supabase/database.types";

type Client = SupabaseClient<Database>;
export type DocumentListItem = Database["public"]["Tables"]["documents"]["Row"] & {
  versions: Database["public"]["Tables"]["document_versions"]["Row"][];
  proofs: Database["public"]["Tables"]["proofs_of_delivery"]["Row"][];
  signatures: Database["public"]["Tables"]["document_signatures"]["Row"][];
};
export interface DocumentQuery { organizationId: string; transportOrderId?: string; transportStopId?: string; }

export async function loadDocuments(query: DocumentQuery, client: Client = requiredClient()): Promise<DocumentListItem[]> {
  let request = client.from("documents").select("*").eq("organization_id", query.organizationId).order("created_at", { ascending: false });
  if (query.transportOrderId) request = request.eq("transport_order_id", query.transportOrderId);
  if (query.transportStopId) request = request.eq("transport_stop_id", query.transportStopId);
  const documents = await request;
  if (documents.error) throw context("documentos", documents.error);
  if (documents.data.length === 0) return [];
  const ids = documents.data.map((row) => row.id);
  const [versions, proofs, signatures] = await Promise.all([
    client.from("document_versions").select("*").eq("organization_id", query.organizationId).in("document_id", ids).order("version_number", { ascending: false }),
    client.from("proofs_of_delivery").select("*").eq("organization_id", query.organizationId).in("document_id", ids),
    client.from("document_signatures").select("*").eq("organization_id", query.organizationId).in("document_id", ids).order("created_at", { ascending: false }),
  ]);
  if (versions.error) throw context("versiones", versions.error);
  if (proofs.error) throw context("POD", proofs.error);
  if (signatures.error) throw context("firmas", signatures.error);
  return documents.data.map((document) => ({
    ...document,
    versions: versions.data.filter((row) => row.document_id === document.id),
    proofs: proofs.data.filter((row) => row.document_id === document.id),
    signatures: signatures.data.filter((row) => row.document_id === document.id),
  }));
}

export async function uploadDocument(input: BeginDocumentUpload, file: File, client: Client = requiredClient()): Promise<DocumentUploadResult> {
  const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID();
  const begin = await invoke<DocumentUploadResult>(client, { action: "begin_upload", ...input, idempotencyKey });
  if (!begin.token) throw new Error("La subida firmada no devolvió token.");
  const uploaded = await client.storage.from("albatrans-documents").uploadToSignedUrl(begin.storagePath, begin.token, file, { contentType: file.type, upsert: false });
  if (uploaded.error) throw new Error(`No se pudo subir el archivo: ${uploaded.error.message}`, { cause: uploaded.error });
  return invoke<DocumentUploadResult>(client, { action: "confirm_upload", organizationId: input.organizationId, documentId: begin.documentId, versionId: begin.versionId, idempotencyKey: crypto.randomUUID() });
}
export async function downloadDocument(organizationId: string, versionId: string, client: Client = requiredClient()) {
  return invoke<{ signedUrl: string; expiresIn: number }>(client, { action: "signed_download", organizationId, versionId, idempotencyKey: crypto.randomUUID() });
}
export async function executeDocumentCommand(command: DocumentCommand, client: Client = requiredClient()) {
  return invoke<Record<string, unknown>>(client, { ...command, idempotencyKey: command.idempotencyKey ?? crypto.randomUUID() });
}
async function invoke<T>(client: Client, body: Record<string, unknown>): Promise<T> {
  const result = await client.functions.invoke<T>("documents", { body });
  if (result.error) {
    if (result.error instanceof FunctionsHttpError) { const errorBody: unknown = await result.error.context.json(); if (isErrorBody(errorBody)) throw new Error(errorBody.error.message); }
    throw result.error;
  }
  if (!result.data) throw new Error("La operación documental no devolvió datos.");
  return result.data;
}
function isErrorBody(value: unknown): value is { error: { message: string } } { return typeof value === "object" && value !== null && "error" in value && typeof value.error === "object" && value.error !== null && "message" in value.error && typeof value.error.message === "string"; }
function context(area: string, error: Error) { return new Error(`No se pudieron cargar ${area}: ${error.message}`, { cause: error }); }
function requiredClient() { const client = getSupabaseClient(); if (!client) throw new Error("Supabase no está configurado."); return client; }
