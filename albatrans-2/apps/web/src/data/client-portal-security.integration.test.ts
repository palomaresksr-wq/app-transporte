import { createClient, FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../infrastructure/supabase/database.types";

const enabled = process.env.PHASE_L_INTEGRATION === "true";
const run = enabled ? describe : describe.skip;
const bucket = "albatrans-documents";
const fixtureEmails = ["client-a1@albatrans.local", "client-a2@albatrans.local", "client-b1@albatrans.local"];
const fixtureNames = ["Demo Client Portal A", "Demo Client Portal B"];
const password = process.env.PHASE_L_DEMO_PASSWORD ?? "";

type DbClient = SupabaseClient<Database>;
interface Fixture {
  email: string;
  userId: string;
  organizationId: string;
  customerId: string;
  orderId: string;
  documentId: string;
  podId: string;
  podDocumentId: string;
  invoiceId: string;
  invoiceDocumentId: string;
  regulatoryId: string;
  regulatoryDocumentId: string;
  paths: string[];
  client: DbClient;
}

let service: DbClient;
const fixtures: Fixture[] = [];

run("client portal signed URLs and cross-tenant IDOR", () => {
  beforeAll(async () => {
    const url = requiredEnv("VITE_SUPABASE_URL");
    const anon = requiredEnv("VITE_SUPABASE_ANON_KEY");
    const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!password) throw new Error("PHASE_L_DEMO_PASSWORD required");
    service = createClient<Database>(url, serviceKey, authOptions("phase-l-security-service"));
    await cleanup();
    const orgA = await createOrganization("Demo Client Portal A", "L-A");
    const orgB = await createOrganization("Demo Client Portal B", "L-B");
    fixtures.push(
      await createFixture(orgA, "Cliente A1", fixtureEmails[0]!, "A1", anon),
      await createFixture(orgA, "Cliente A2", fixtureEmails[1]!, "A2", anon),
      await createFixture(orgB, "Cliente B1", fixtureEmails[2]!, "B1", anon),
    );
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  }, 60_000);

  it("returns only explicit DTO allowlists while direct ERP reads stay empty", async () => {
    for (const fixture of fixtures) {
      const direct = await Promise.all([
        fixture.client.from("clients").select("*"), fixture.client.from("locations").select("*"),
        fixture.client.from("vehicles").select("*"), fixture.client.from("transport_orders").select("*"),
        fixture.client.from("transport_stops").select("*"), fixture.client.from("transport_items").select("*"),
        fixture.client.from("transport_incidents").select("*"), fixture.client.from("transport_events").select("*"),
        fixture.client.from("documents").select("*"), fixture.client.from("document_versions").select("*"),
        fixture.client.from("proofs_of_delivery").select("*"), fixture.client.from("document_signatures").select("*"),
        fixture.client.from("invoices").select("*"), fixture.client.from("invoice_lines").select("*"),
        fixture.client.from("invoice_payments").select("*"),
        fixture.client.from("transport_regulatory_documents").select("*"),
        fixture.client.from("transport_regulatory_revisions").select("*"),
        fixture.client.from("transport_regulatory_evidence").select("*"),
      ]);
      for (const result of direct) {
        expect(result.error).toBeNull();
        expect(result.data).toEqual([]);
      }
      const profile = await invoke(fixture.client, { action: "profile" });
      expect(keys(profile)).toEqual(["customerName", "organizationName", "policy", "supportEmail", "supportPhone"]);
      const transports = await invoke(fixture.client, { action: "transports" });
      const transport = firstItem(transports);
      expect(keys(transport)).toEqual(["document_count", "id", "order_number", "planned_delivery_at", "planned_pickup_at", "pod_available", "priority", "status", "transport_stops"]);
      expect(transport.id).toBe(fixture.orderId);
      const detail = await invoke(fixture.client, { action: "transport_detail", orderId: fixture.orderId });
      expect(keys(detail)).toEqual(["events", "incidents", "items"]);
      const documents = await invoke(fixture.client, { action: "documents" });
      for (const document of items(documents)) expect(keys(document)).toEqual(["created_at", "document_type", "id", "title"]);
      const invoices = await invoke(fixture.client, { action: "invoices" });
      expect(keys(firstItem(invoices))).toEqual(["amount_due", "currency_code", "due_date", "id", "invoice_number", "issue_date", "status", "total"]);
      const invoice = await invoke(fixture.client, { action: "invoice_detail", invoiceId: fixture.invoiceId });
      expect(keys(invoice)).toEqual(["amount_due", "amount_paid", "currency_code", "due_date", "id", "invoice_number", "issue_date", "status", "subtotal", "tax_total", "total"]);
      const regulatory = await invoke(fixture.client, { action: "regulatory_documents" });
      expect(keys(firstItem(regulatory))).toEqual(["document_number", "document_type", "effective_at", "id", "issued_at", "revision_number", "status", "transport_order_id"]);
      const regulatoryDetail = await invoke(fixture.client, { action: "regulatory_document_detail", regulatoryDocumentId: fixture.regulatoryId });
      expect(keys(regulatoryDetail)).toEqual(["document_number", "document_type", "effective_at", "id", "issued_at", "revision_number", "status", "transport_order_id"]);
      expect(JSON.stringify({ profile, transports, detail, documents, invoices, invoice, regulatory, regulatoryDetail })).not.toMatch(/cost|pricing|tariff|margin|internal_notes|raw_ocr|audit|storage_path|service_role|snapshot_json|metadata/i);
    }
  }, 60_000);

  it("downloads own private objects through 60-second signed URLs", async () => {
    const a1 = fixtures[0]!;
    for (const request of [
      { action: "document_url", documentId: a1.documentId },
      { action: "pod_url", podId: a1.podId },
      { action: "invoice_pdf_url", invoiceId: a1.invoiceId },
      { action: "regulatory_document_url", regulatoryDocumentId: a1.regulatoryId },
    ]) {
      const signed = await invoke(a1.client, request);
      expect(signed.expiresIn).toBe(60);
      expect(typeof signed.url).toBe("string");
      const response = await fetch(String(signed.url));
      expect(response.ok).toBe(true);
      expect(response.headers.get("content-type")).toContain("application/pdf");
    }
    const bucketInfo = await service.storage.getBucket(bucket);
    expect(bucketInfo.error).toBeNull();
    expect(bucketInfo.data?.public).toBe(false);
    const persisted = await service.from("document_versions").select("metadata").in("document_id", [a1.documentId, a1.podDocumentId, a1.invoiceDocumentId, a1.regulatoryDocumentId]);
    expect(JSON.stringify(persisted.data)).not.toContain("token=");
    const audits = await service.from("audit_events").select("before_data,after_data,metadata").eq("organization_id", a1.organizationId);
    expect(JSON.stringify(audits.data)).not.toContain("token=");
  }, 60_000);

  it("rejects same-tenant and cross-tenant real IDs with neutral responses", async () => {
    const [a1, a2, b1] = fixtures as [Fixture, Fixture, Fixture];
    for (const attacker of [a1, a2]) {
      const foreign = attacker === a1 ? a2 : a1;
      await expectNeutral(attacker.client, { action: "transport_detail", orderId: foreign.orderId });
      await expectNeutral(attacker.client, { action: "document_url", documentId: foreign.documentId });
      await expectNeutral(attacker.client, { action: "pod_url", podId: foreign.podId });
      await expectNeutral(attacker.client, { action: "invoice_pdf_url", invoiceId: foreign.invoiceId });
      await expectNeutral(attacker.client, { action: "regulatory_document_url", regulatoryDocumentId: foreign.regulatoryId });
    }
    for (const request of [
      { action: "transport_detail", orderId: b1.orderId },
      { action: "document_url", documentId: b1.documentId },
      { action: "pod_url", podId: b1.podId },
      { action: "invoice_pdf_url", invoiceId: b1.invoiceId },
      { action: "regulatory_document_url", regulatoryDocumentId: b1.regulatoryId },
    ]) await expectNeutral(a1.client, request);
  }, 60_000);

  it("revokes DTO and signed URL issuance immediately and restores access", async () => {
    const a1 = fixtures[0]!;
    expect((await invoke(a1.client, { action: "documents" })).items).toBeDefined();
    expect((await invoke(a1.client, { action: "document_url", documentId: a1.documentId })).expiresIn).toBe(60);
    await checked(service.from("client_portal_memberships").update({ status: "blocked" }).eq("user_id", a1.userId));
    await expectForbidden(a1.client, { action: "documents" });
    await expectForbidden(a1.client, { action: "document_url", documentId: a1.documentId });
    await checked(service.from("client_portal_memberships").update({ status: "active" }).eq("user_id", a1.userId));
    expect((await invoke(a1.client, { action: "documents" })).items).toBeDefined();
  }, 60_000);
});

async function createOrganization(name: string, taxId: string) {
  const creator = await service.auth.admin.createUser({ email: `phase-l-owner-${crypto.randomUUID()}@albatrans.local`, password, email_confirm: true });
  if (creator.error || !creator.data.user) throw creator.error ?? new Error("owner auth failed");
  await checked(service.from("profiles").insert({ user_id: creator.data.user.id, display_name: `${name} Owner` }));
  const org = await service.from("organizations").insert({ legal_name: name, trade_name: name, tax_id: `${taxId}-${crypto.randomUUID().slice(0, 8)}`, status: "active", created_by: creator.data.user.id }).select("id").single();
  if (org.error) throw org.error;
  const plan = await service.from("plans").select("id").eq("code", "enterprise").single();
  if (plan.error) throw plan.error;
  await checked(service.from("organization_subscriptions").insert({ organization_id: org.data.id, plan_id: plan.data.id, status: "active", payment_status: "paid", starts_at: new Date().toISOString() }));
  return { id: org.data.id, creatorId: creator.data.user.id };
}

async function createFixture(org: { id: string; creatorId: string }, customerName: string, email: string, code: string, anon: string): Promise<Fixture> {
  const auth = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (auth.error || !auth.data.user) throw auth.error ?? new Error("client auth failed");
  const userId = auth.data.user.id;
  await checked(service.from("profiles").insert({ user_id: userId, display_name: customerName, status: "active" }));
  const customer = await service.from("clients").insert({ organization_id: org.id, legal_name: customerName, trade_name: customerName, created_by: org.creatorId }).select("id").single();
  if (customer.error) throw customer.error;
  await checked(service.from("client_portal_memberships").insert({ organization_id: org.id, customer_id: customer.data.id, user_id: userId, role: "client_viewer", status: "active", created_by: org.creatorId }));
  await checked(service.from("client_portal_visibility_policies").insert({ organization_id: org.id, customer_id: customer.data.id, incidents: true, signatures: true, updated_by: org.creatorId }));
  const order = await service.from("transport_orders").insert({ organization_id: org.id, order_number: `L-${code}-${crypto.randomUUID().slice(0, 8)}`, customer_id: customer.data.id, transport_type: "general", status: "planned", created_by: org.creatorId }).select("id").single();
  if (order.error) throw order.error;
  const paths: string[] = [];
  const generic = await createDocument(org, customer.data.id, order.data.id, null, `${code}-document`, "client_document", true, paths);
  const podDocument = await createDocument(org, customer.data.id, order.data.id, null, `${code}-pod`, "proof", false, paths);
  const pod = await service.from("proofs_of_delivery").insert({ organization_id: org.id, transport_order_id: order.data.id, document_id: podDocument.documentId, status: "confirmed", delivered_at: new Date().toISOString(), recipient_name: `Receiver ${code}`, created_by: org.creatorId }).select("id").single();
  if (pod.error) throw pod.error;
  const series = await service.from("invoice_series").insert({ organization_id: org.id, code: `S-${code}`, name: `Series ${code}`, prefix: code, is_primary: code.endsWith("1"), created_by: org.creatorId }).select("id").single();
  if (series.error) throw series.error;
  const invoice = await service.from("invoices").insert({ organization_id: org.id, customer_id: customer.data.id, invoice_series_id: series.data.id, invoice_number: `INV-${code}`, issue_date: "2026-08-31", due_date: "2026-09-30", status: "issued", subtotal: 100, tax_total: 21, total: 121, amount_paid: 20, amount_due: 101, fiscal_snapshot_json: { customer: customerName }, billing_snapshot_json: {}, correlation_id: crypto.randomUUID(), idempotency_key: crypto.randomUUID(), created_by: org.creatorId, issued_by: org.creatorId, issued_at: new Date().toISOString() }).select("id").single();
  if (invoice.error) throw invoice.error;
  await checked(service.from("invoice_lines").insert({ organization_id: org.id, invoice_id: invoice.data.id, position: 1, description: `Transport ${code}`, quantity: 1, unit_price: 100, subtotal: 100, tax_code: "IVA21", tax_name: "IVA 21", tax_kind: "standard", tax_rate: 21, tax_amount: 21, total: 121, snapshot_json: {}, transport_order_id: order.data.id }));
  const invoiceDocument = await createDocument(org, customer.data.id, null, invoice.data.id, `${code}-invoice`, "invoice", false, paths);
  const regulatoryDocument = await createDocument(org, customer.data.id, order.data.id, null, `${code}-regulatory`, "regulatory", false, paths);
  const regulatory = await service.from("transport_regulatory_documents").insert({ organization_id: org.id, transport_order_id: order.data.id, document_id: regulatoryDocument.documentId, document_type: "control_document", status: "issued", document_number: `DC-2026-${code.padStart(6, "0")}`, revision_number: 1, current_snapshot_json: {}, content_hash: "a".repeat(64), issued_at: new Date().toISOString(), effective_at: new Date().toISOString(), correlation_id: crypto.randomUUID(), idempotency_key: crypto.randomUUID(), created_by: org.creatorId }).select("id").single();
  if (regulatory.error) throw regulatory.error;
  const revision = await service.from("transport_regulatory_revisions").insert({ organization_id: org.id, regulatory_document_id: regulatory.data.id, revision_number: 1, snapshot_json: {}, content_hash: "a".repeat(64), created_by: org.creatorId }).select("id").single();
  if (revision.error) throw revision.error;
  await checked(service.from("transport_regulatory_evidence").insert({ organization_id: org.id, regulatory_document_id: regulatory.data.id, revision_id: revision.data.id, evidence_type: "document", document_id: regulatoryDocument.documentId, document_version_id: regulatoryDocument.versionId, actor_user_id: org.creatorId }));
  const client = createClient<Database>(requiredEnv("VITE_SUPABASE_URL"), anon, authOptions(`phase-l-${code}`));
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  return { email, userId, organizationId: org.id, customerId: customer.data.id, orderId: order.data.id, documentId: generic.documentId, podId: pod.data.id, podDocumentId: podDocument.documentId, invoiceId: invoice.data.id, invoiceDocumentId: invoiceDocument.documentId, regulatoryId: regulatory.data.id, regulatoryDocumentId: regulatoryDocument.documentId, paths, client };
}

async function createDocument(org: { id: string; creatorId: string }, customerId: string, orderId: string | null, invoiceId: string | null, name: string, type: string, clientVisible: boolean, paths: string[]) {
  const document = await service.from("documents").insert({ organization_id: org.id, client_id: customerId, transport_order_id: orderId, invoice_id: invoiceId, document_type: type, title: name, source: "upload", status: "available", client_visible: clientVisible, created_by: org.creatorId }).select("id").single();
  if (document.error) throw document.error;
  const path = `phase-l/${org.id}/${document.data.id}/${name}.pdf`;
  const bytes = new TextEncoder().encode(`%PDF-1.4\n${name}\n%%EOF`);
  const upload = await service.storage.from(bucket).upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (upload.error) throw upload.error;
  paths.push(path);
  const version = await service.from("document_versions").insert({ organization_id: org.id, document_id: document.data.id, version_number: 1, storage_bucket: bucket, storage_path: path, original_filename: `${name}.pdf`, mime_type: "application/pdf", size_bytes: bytes.byteLength, sha256: "b".repeat(64), status: "available", uploaded_at: new Date().toISOString(), uploaded_by: org.creatorId }).select("id").single();
  if (version.error) throw version.error;
  await checked(service.from("documents").update({ current_version_id: version.data.id }).eq("id", document.data.id));
  return { documentId: document.data.id, versionId: version.data.id };
}

async function cleanup() {
  if (!service) return;
  for (const fixture of fixtures) {
    if (fixture.paths.length) await service.storage.from(bucket).remove(fixture.paths);
    await fixture.client.auth.signOut();
  }
  const organizations = await service.from("organizations").select("id").in("legal_name", fixtureNames);
  const orgIds = (organizations.data ?? []).map((org) => org.id);
  if (orgIds.length) {
    const versions = await service.from("document_versions").select("storage_path").in("organization_id", orgIds);
    const paths = (versions.data ?? []).map((version) => version.storage_path);
    if (paths.length) await service.storage.from(bucket).remove(paths);
    await service.from("documents").update({ current_version_id: null }).in("organization_id", orgIds);
    const tables = ["transport_regulatory_evidence", "transport_regulatory_revisions", "transport_regulatory_documents", "proofs_of_delivery", "document_versions", "documents", "invoice_payments", "invoice_lines", "invoices", "invoice_series", "transport_orders", "client_portal_visibility_policies", "client_portal_memberships", "clients", "organization_module_overrides", "organization_subscriptions"] as const;
    for (const table of tables) await service.from(table).delete().in("organization_id", orgIds);
    await service.from("organizations").delete().in("id", orgIds);
  }
  const users = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (!users.error) {
    for (const user of users.data.users.filter((candidate) => fixtureEmails.includes(candidate.email ?? "") || candidate.email?.startsWith("phase-l-owner-") && candidate.email.endsWith("@albatrans.local"))) {
      await service.from("profiles").delete().eq("user_id", user.id);
      await service.auth.admin.deleteUser(user.id);
    }
  }
  fixtures.length = 0;
}

async function invoke(client: DbClient, body: object): Promise<Record<string, unknown>> {
  const result = await client.functions.invoke("client-portal", { body });
  if (result.error instanceof FunctionsHttpError) {
    const payload = await result.error.context.text();
    throw new Error(`${record(body) ? String(body.action) : "unknown"}: ${payload}`);
  }
  if (result.error) throw result.error;
  if (!record(result.data)) throw new Error("Invalid Edge DTO");
  return result.data;
}
async function expectNeutral(client: DbClient, body: object) {
  const result = await client.functions.invoke("client-portal", { body });
  expect(result.error).toBeInstanceOf(FunctionsHttpError);
  if (result.error instanceof FunctionsHttpError) expect(result.error.context.status).toBe(404);
  expect(result.data).toBeNull();
}
async function expectForbidden(client: DbClient, body: object) {
  const result = await client.functions.invoke("client-portal", { body });
  expect(result.error).toBeInstanceOf(FunctionsHttpError);
  if (result.error instanceof FunctionsHttpError) expect(result.error.context.status).toBe(403);
}
async function checked(operation: PromiseLike<{ error: { message: string } | null }>) {
  const result = await operation;
  if (result.error) throw result.error;
}
function authOptions(storageKey: string) {
  return { auth: { persistSession: false, autoRefreshToken: false, storageKey } };
}
function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} required`);
  return value;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>) {
  return Object.keys(value).sort();
}
function items(value: Record<string, unknown>) {
  if (!Array.isArray(value.items) || !value.items.every(record)) throw new Error("Invalid item list");
  return value.items;
}
function firstItem(value: Record<string, unknown>) {
  const first = items(value)[0];
  if (!first) throw new Error("Missing item");
  return first;
}
