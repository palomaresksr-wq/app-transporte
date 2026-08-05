import { createClient, FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../infrastructure/supabase/database.types";

const url: string | undefined = import.meta.env.ALBATRANS_TEST_SUPABASE_URL;
const anonKey: string | undefined = import.meta.env.ALBATRANS_TEST_ANON_KEY;
const serviceKey: string | undefined = import.meta.env.ALBATRANS_TEST_SERVICE_ROLE_KEY;
const organizationId = "eb000000-0000-4000-8000-000000000001";
const clientId = "ec000000-0000-4000-8000-000000000001";
let service: SupabaseClient<Database>, platform: SupabaseClient<Database>;
let documentId = "", versionId = "", storagePath = "";

describe.skipIf(!url || !anonKey || !serviceKey)("documentos contra Storage local", () => {
  beforeAll(async () => {
    if (!url || !anonKey || !serviceKey) throw new Error("Entorno local incompleto.");
    service = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: "phase-d-service" } });
    platform = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: "phase-d-platform" } });
    const users = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (users.error) throw users.error;
    const superadmin = users.data.users.find((user) => user.email === "superadmin@albatrans.local");
    if (!superadmin) throw new Error("Falta el superadmin local preparado.");
    const organization = await service.from("organizations").insert({ id: organizationId, legal_name: "PHASED Storage", trade_name: "PHASED Storage", tax_id: "PHASED001", status: "active", created_by: superadmin.id });
    if (organization.error) throw organization.error;
    const client = await service.from("clients").insert({ id: clientId, organization_id: organizationId, legal_name: "PHASED Client", trade_name: "PHASED Client", created_by: superadmin.id });
    if (client.error) throw client.error;
    const login = await platform.auth.signInWithPassword({ email: "superadmin@albatrans.local", password: "AlbatransLocal2026!" });
    if (login.error) throw login.error;
  });
  afterAll(async () => {
    if (!service) return;
    if (storagePath) await service.storage.from("albatrans-documents").remove([storagePath]);
    await service.from("document_outbox").delete().eq("organization_id", organizationId);
    await service.from("document_command_idempotency").delete().eq("organization_id", organizationId);
    await service.from("document_signatures").delete().eq("organization_id", organizationId);
    await service.from("proofs_of_delivery").delete().eq("organization_id", organizationId);
    await service.from("documents").update({ current_version_id: null }).eq("organization_id", organizationId);
    await service.from("document_versions").delete().eq("organization_id", organizationId);
    await service.from("documents").delete().eq("organization_id", organizationId);
    await service.from("clients").delete().eq("organization_id", organizationId);
    await platform.auth.signOut();
  });
  it("completa la saga privada y emite URLs temporales", async () => {
    const bytes = new TextEncoder().encode("POD local de prueba");
    const begin = await invoke({ action: "begin_upload", organizationId, documentType: "proof", title: "Prueba Storage", source: "upload", originalFilename: "proof.pdf", mimeType: "application/pdf", sizeBytes: bytes.byteLength, relations: { clientId }, idempotencyKey: crypto.randomUUID() });
    documentId = text(begin.documentId); versionId = text(begin.versionId); storagePath = text(begin.storagePath);
    const token = text(begin.token);
    const uploadBody = new Uint8Array(bytes).buffer;
    const upload = await platform.storage.from("albatrans-documents").uploadToSignedUrl(storagePath, token, uploadBody, { contentType: "application/pdf" });
    if (upload.error) throw upload.error;
    const confirmed = await invoke({ action: "confirm_upload", organizationId, documentId, versionId, idempotencyKey: crypto.randomUUID() });
    expect(confirmed.eventType).toBe("document.upload_confirmed");
    const version = await service.from("document_versions").select("status,sha256").eq("id", versionId).single();
    if (version.error) throw version.error;
    expect(version.data.status).toBe("available"); expect(version.data.sha256).toMatch(/^[0-9a-f]{64}$/);
    const signed = await invoke({ action: "signed_download", organizationId, versionId });
    expect(signed.expiresIn).toBe(120); expect(text(signed.signedUrl)).toContain("token=");
    const unauthenticated = await fetch(`${url}/storage/v1/object/public/albatrans-documents/${storagePath}`);
    expect(unauthenticated.ok).toBe(false);
    const audit = await service.from("audit_events").select("action,after_data").eq("organization_id", organizationId).order("occurred_at");
    if (audit.error) throw audit.error;
    expect(audit.data).toHaveLength(3);
    expect(audit.data.map((row) => row.action)).toEqual(expect.arrayContaining(["document.created", "document.upload_started", "document.upload_confirmed"]));
    expect(JSON.stringify(audit.data)).not.toContain("signedUrl");
  }, 30_000);
});
async function invoke(body: object) { const result = await platform.functions.invoke("documents", { body }); if (result.error) { if (result.error instanceof FunctionsHttpError) { const payload: unknown = await result.error.context.json(); if (record(payload) && record(payload.error) && typeof payload.error.message === "string") throw new Error(payload.error.message); } throw result.error; } if (!record(result.data)) throw new Error("Respuesta Edge inválida."); return result.data; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function text(value: unknown) { if (typeof value !== "string" || !value) throw new Error("Campo de respuesta inválido."); return value; }
