import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type",
  "Content-Type": "application/json",
};
const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
const fail = (status: number, code: string, message: string) => reply(status, { error: { code, message } });
const makeClient = (url: string, key: string) =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
type Db = ReturnType<typeof makeClient>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return fail(405, "method", "Método no permitido.");
  const bearer = req.headers.get("Authorization");
  if (!bearer?.startsWith("Bearer ")) return fail(401, "unauthorized", "Sesión requerida.");
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return fail(500, "config", "Servicio no configurado.");
  const db = makeClient(url, key), auth = await db.auth.getUser(bearer.slice(7));
  if (auth.error || !auth.data.user) return fail(401, "unauthorized", "Sesión no válida.");
  let body: Record<string, unknown>;
  try {
    const raw: unknown = await req.json();
    if (!record(raw)) throw new Error();
    body = raw;
  } catch {
    return fail(400, "payload", "JSON inválido.");
  }
  try {
    const forwardedHost = req.headers.get("x-forwarded-host");
    const forwardedProtocol = req.headers.get("x-forwarded-proto") ?? "http";
    const configuredPublicUrl = Deno.env.get("SUPABASE_PUBLIC_URL") ?? Deno.env.get("API_EXTERNAL_URL");
    const serviceUrl = new URL(url);
    const publicOrigin = configuredPublicUrl
      ? new URL(configuredPublicUrl).origin
      : serviceUrl.hostname === "kong"
      ? "http://127.0.0.1:54321"
      : forwardedHost
      ? `${forwardedProtocol}://${forwardedHost}`
      : new URL(req.url).origin;
    if (
      ["list_accesses", "create_access", "block_access", "reactivate_access", "reset_password"].includes(
        String(body.action),
      )
    ) {
      const admin = await authorizeAdmin(db, auth.data.user.id, optionalUuid(body.organizationId));
      if (!admin.ok) return fail(admin.status, "forbidden", admin.message);
      if (body.action === "list_accesses") return listAccesses(db, admin.organizationId, requiredUuid(body.customerId));
      if (body.action === "create_access") return createAccess(db, auth.data.user.id, admin.organizationId, body);
      return mutateAccess(
        db,
        auth.data.user.id,
        admin.organizationId,
        String(body.action),
        requiredUuid(body.userId),
        body,
      );
    }
    const access = await authorize(db, auth.data.user.id);
    if (!access.ok) return fail(access.status, "forbidden", access.message);
    if (body.action === "profile") return portalProfile(db, access);
    if (body.action === "transports") return portalTransports(db, access, optionalText(body.search));
    if (body.action === "transport_detail") return portalTransportDetail(db, access, requiredUuid(body.orderId));
    if (body.action === "documents") return portalDocuments(db, access);
    if (body.action === "invoices") return portalInvoices(db, access);
    if (body.action === "invoice_detail") return portalInvoiceDetail(db, access, requiredUuid(body.invoiceId));
    if (body.action === "regulatory_documents") return portalRegulatoryDocuments(db, access);
    if (body.action === "regulatory_document_detail") {
      return portalRegulatoryDocumentDetail(db, access, requiredUuid(body.regulatoryDocumentId));
    }
    if (body.action === "document_url") {
      return signedDocument(db, access, requiredUuid(body.documentId), publicOrigin);
    }
    if (body.action === "pod_url") return signedPod(db, access, requiredUuid(body.podId), publicOrigin);
    if (body.action === "invoice_pdf_url") {
      return signedInvoice(db, access, requiredUuid(body.invoiceId), publicOrigin);
    }
    if (body.action === "regulatory_document_url") {
      return signedRegulatoryDocument(db, access, requiredUuid(body.regulatoryDocumentId), publicOrigin);
    }
    return fail(400, "action", "Acción no permitida.");
  } catch (error) {
    return fail(400, "request", error instanceof Error ? error.message : "Solicitud inválida.");
  }
});

async function authorizeAdmin(db: Db, userId: string, requestedOrg: string | null) {
  const [profile, membership, platform] = await Promise.all([
    db.from("profiles").select("status").eq("user_id", userId).maybeSingle(),
    db.from("organization_memberships").select("organization_id,role,status").eq("user_id", userId).maybeSingle(),
    db.from("platform_admins").select("role,status").eq("user_id", userId).maybeSingle(),
  ]);
  if (profile.data?.status !== "active") return { ok: false as const, status: 403, message: "Perfil bloqueado." };
  const org = platform.data?.role === "superadmin" && platform.data.status === "active"
    ? requestedOrg
    : membership.data?.organization_id ?? null;
  if (
    !org || (!platform.data && !(membership.data?.role === "admin_empresa" && membership.data.status === "active")) ||
    (requestedOrg && requestedOrg !== org)
  ) return { ok: false as const, status: 403, message: "Administración no autorizada." };
  const enabled = await db.rpc("phase_l_module_enabled", { p_org: org });
  if (enabled.data !== true) return { ok: false as const, status: 403, message: "Módulo no disponible." };
  return { ok: true as const, organizationId: org };
}
async function listAccesses(db: Db, org: string, customer: string) {
  const result = await db.from("client_portal_memberships").select(
    "id,user_id,role,status,last_access_at,profiles!client_portal_memberships_user_id_fkey(display_name,phone)",
  ).eq("organization_id", org).eq("customer_id", customer).order("created_at");
  return result.error ? fail(400, "database", result.error.message) : reply(200, { items: result.data });
}
async function createAccess(db: Db, actor: string, org: string, body: Record<string, unknown>) {
  const customer = requiredUuid(body.customerId),
    email = requiredEmail(body.email),
    password = requiredPassword(body.password),
    first = requiredText(body.firstName),
    last = requiredText(body.lastName),
    role = body.role === "client_admin" ? "client_admin" : "client_viewer",
    key = requiredUuid(body.idempotencyKey),
    hash = await sha256(
      JSON.stringify({ customer, email, first, last, role, mustChange: body.mustChangePassword !== false }),
    );
  const prepared = await db.rpc("prepare_client_portal_user", {
    p_actor: actor,
    p_org: org,
    p_customer: customer,
    p_key: key,
    p_hash: hash,
  });
  if (prepared.error) throw new Error(prepared.error.message);
  if (prepared.data?.result) return reply(200, prepared.data.result);
  const created = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `${first} ${last}` },
  });
  if (created.error || !created.data.user) throw new Error(created.error?.message ?? "No se pudo crear la identidad.");
  const completed = await db.rpc("complete_client_portal_user", {
    p_actor: actor,
    p_command: prepared.data.commandId,
    p_user: created.data.user.id,
    p_role: role,
    p_first: first,
    p_last: last,
    p_phone: optionalText(body.phone),
    p_must_change: body.mustChangePassword !== false,
  });
  if (completed.error) {
    await db.auth.admin.deleteUser(created.data.user.id);
    throw new Error(completed.error.message);
  }
  return reply(201, completed.data);
}
async function mutateAccess(
  db: Db,
  actor: string,
  org: string,
  action: string,
  userId: string,
  body: Record<string, unknown>,
) {
  const membership = await db.from("client_portal_memberships").select("id,status").eq("organization_id", org).eq(
    "user_id",
    userId,
  ).maybeSingle();
  if (!membership.data) return fail(404, "not_found", "Acceso no encontrado.");
  if (action === "reset_password") {
    const password = requiredPassword(body.password);
    const result = await db.auth.admin.updateUserById(userId, { password });
    if (result.error) throw new Error(result.error.message);
    await db.from("company_user_lifecycle").update({ must_change_password: true, initial_password_changed_at: null })
      .eq("user_id", userId);
    await audit(db, org, actor, "client_portal.password_reset", userId);
    return reply(200, { userId });
  }
  const status = action === "block_access" ? "blocked" : "active";
  const updated = await db.from("client_portal_memberships").update({ status, revoked_at: null }).eq(
    "id",
    membership.data.id,
  );
  if (updated.error) throw new Error(updated.error.message);
  await audit(
    db,
    org,
    actor,
    status === "blocked" ? "client_portal.user_blocked" : "client_portal.user_reactivated",
    userId,
  );
  return reply(200, { userId, status });
}
async function audit(db: Db, org: string, actor: string, action: string, userId: string) {
  await db.from("audit_events").insert({
    organization_id: org,
    actor_user_id: actor,
    actor_scope: "organization",
    action,
    entity_type: "client_portal_user",
    entity_id: userId,
    after_data: { userId },
    correlation_id: crypto.randomUUID(),
  });
}

async function authorize(db: Db, userId: string) {
  const [profile, membership] = await Promise.all([
    db.from("profiles").select("status").eq("user_id", userId).maybeSingle(),
    db.from("client_portal_memberships").select("id,organization_id,customer_id,role,status").eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (profile.data?.status !== "active") return { ok: false as const, status: 403, message: "Perfil bloqueado." };
  if (!membership.data || membership.data.status !== "active") {
    return { ok: false as const, status: 403, message: "Acceso de cliente bloqueado." };
  }
  const [org, customer, module] = await Promise.all([
    db.from("organizations").select("status").eq("id", membership.data.organization_id).single(),
    db.from("clients").select("status,organization_id").eq("id", membership.data.customer_id).single(),
    db.rpc("phase_l_module_enabled", { p_org: membership.data.organization_id }),
  ]);
  if (
    org.data?.status !== "active" || customer.data?.status !== "active" ||
    customer.data.organization_id !== membership.data.organization_id || module.data !== true
  ) return { ok: false as const, status: 403, message: "Portal no disponible." };
  return { ok: true as const, userId, membership: membership.data };
}
type Access = Extract<Awaited<ReturnType<typeof authorize>>, { ok: true }>;
async function portalPolicy(db: Db, access: Access) {
  const value = await db.from("client_portal_visibility_policies").select(
    "transport_status,planned_dates,actual_dates,goods_summary,incidents,pod,regulatory_documents,invoices,signatures",
  ).eq(
    "organization_id",
    access.membership.organization_id,
  ).eq("customer_id", access.membership.customer_id).single();
  if (value.error || !value.data) throw new Error("Política no disponible.");
  return value.data;
}
async function portalProfile(db: Db, access: Access) {
  const [org, customer, branding, policy] = await Promise.all([
    db.from("organizations").select("legal_name,trade_name").eq("id", access.membership.organization_id).single(),
    db.from("clients").select("trade_name,legal_name").eq("id", access.membership.customer_id).single(),
    db.from("client_portal_branding").select("display_name,support_email,support_phone").eq(
      "organization_id",
      access.membership.organization_id,
    ).maybeSingle(),
    portalPolicy(db, access),
  ]);
  if (!org.data || !customer.data) return fail(404, "not_found", "Portal no encontrado.");
  return reply(200, {
    organizationName: branding.data?.display_name || org.data.trade_name || org.data.legal_name,
    customerName: customer.data.trade_name || customer.data.legal_name,
    supportEmail: branding.data?.support_email ?? null,
    supportPhone: branding.data?.support_phone ?? null,
    policy,
  });
}
async function portalTransports(db: Db, access: Access, search: string) {
  const policy = await portalPolicy(db, access);
  let query = db.from("transport_orders").select(
    "id,order_number,status,priority,planned_pickup_at,planned_delivery_at,created_at,transport_stops(position,locations(name,city)),proofs_of_delivery(id),documents(id)",
  ).eq("organization_id", access.membership.organization_id).eq("customer_id", access.membership.customer_id).neq(
    "status",
    "archived",
  ).order("created_at", { ascending: false }).limit(50);
  if (search) query = query.ilike("order_number", `%${search}%`);
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return reply(200, {
    items: (result.data ?? []).map((row) => ({
      id: row.id,
      order_number: row.order_number,
      status: policy.transport_status ? row.status : null,
      priority: row.priority,
      planned_pickup_at: policy.planned_dates ? row.planned_pickup_at : null,
      planned_delivery_at: policy.planned_dates ? row.planned_delivery_at : null,
      transport_stops: row.transport_stops,
      pod_available: policy.pod && row.proofs_of_delivery.length > 0,
      document_count: row.documents.filter((document) => document.id !== null).length,
    })),
  });
}
async function portalTransportDetail(db: Db, access: Access, orderId: string) {
  const order = await db.from("transport_orders").select("id").eq("id", orderId).eq(
    "organization_id",
    access.membership.organization_id,
  ).eq("customer_id", access.membership.customer_id).maybeSingle();
  if (!order.data) return fail(404, "not_found", "Transporte no encontrado.");
  const policy = await portalPolicy(db, access);
  const [items, incidents, events] = await Promise.all([
    policy.goods_summary
      ? db.from("transport_items").select("description,packages,pallets,weight_kg").eq("transport_order_id", orderId)
      : Promise.resolve({ data: [], error: null }),
    policy.incidents
      ? db.from("transport_incidents").select("id,title,description,reported_at").eq("transport_order_id", orderId).eq(
        "client_visibility",
        "client_visible",
      ).order("reported_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    db.from("transport_events").select("id,event_type,occurred_at").eq("transport_order_id", orderId).in("event_type", [
      "transport.planned",
      "transport.pickup_arrived",
      "transport.departed",
      "transport.destination_arrived",
      "transport.completed",
      "pod.available",
      "incident.client_visible",
    ]).order("occurred_at"),
  ]);
  return reply(200, { items: items.data ?? [], incidents: incidents.data ?? [], events: events.data ?? [] });
}
async function portalDocuments(db: Db, access: Access) {
  const policy = await portalPolicy(db, access);
  const orders = await db.from("transport_orders").select("id").eq("organization_id", access.membership.organization_id)
    .eq("customer_id", access.membership.customer_id);
  const ids = (orders.data ?? []).map((x) => x.id);
  if (!ids.length) return reply(200, { items: [] });
  const result = await db.from("documents").select("id,title,document_type,created_at,client_visible").in(
    "transport_order_id",
    ids,
  ).eq("status", "available").is("archived_at", null).order("created_at", { ascending: false });
  if (result.error) throw new Error(result.error.message);
  const allowed = [];
  for (const document of result.data) {
    if (document.client_visible) allowed.push(document);
    else if (
      policy.pod && (await db.from("proofs_of_delivery").select("id").eq("document_id", document.id).maybeSingle()).data
    ) allowed.push(document);
    else if (
      policy.regulatory_documents &&
      (await db.from("transport_regulatory_evidence").select("id").eq("document_id", document.id).maybeSingle()).data
    ) allowed.push(document);
  }
  return reply(200, {
    items: allowed.map((document) => ({
      id: document.id,
      title: document.title,
      document_type: document.document_type,
      created_at: document.created_at,
    })),
  });
}
async function portalInvoices(db: Db, access: Access) {
  const policy = await portalPolicy(db, access);
  if (!policy.invoices) return reply(200, { items: [] });
  const result = await db.from("invoices").select(
    "id,invoice_number,issue_date,due_date,status,currency_code,total,amount_due",
  ).eq("organization_id", access.membership.organization_id).eq("customer_id", access.membership.customer_id).neq(
    "status",
    "draft",
  ).order("issue_date", { ascending: false });
  if (result.error) throw new Error(result.error.message);
  return reply(200, { items: result.data });
}
async function portalInvoiceDetail(db: Db, access: Access, invoiceId: string) {
  const policy = await portalPolicy(db, access);
  if (!policy.invoices) return fail(404, "not_found", "Factura no encontrada.");
  const result = await db.from("invoices").select(
    "id,invoice_number,issue_date,due_date,status,currency_code,subtotal,tax_total,total,amount_paid,amount_due",
  ).eq("id", invoiceId).eq("organization_id", access.membership.organization_id).eq(
    "customer_id",
    access.membership.customer_id,
  ).neq("status", "draft").maybeSingle();
  return result.data ? reply(200, result.data) : fail(404, "not_found", "Factura no encontrada.");
}
async function portalRegulatoryDocuments(db: Db, access: Access) {
  const policy = await portalPolicy(db, access);
  if (!policy.regulatory_documents) return reply(200, { items: [] });
  const orders = await db.from("transport_orders").select("id").eq(
    "organization_id",
    access.membership.organization_id,
  ).eq("customer_id", access.membership.customer_id);
  const orderIds = (orders.data ?? []).map((order) => order.id);
  if (!orderIds.length) return reply(200, { items: [] });
  const result = await db.from("transport_regulatory_documents").select(
    "id,transport_order_id,document_number,document_type,status,issued_at,effective_at,revision_number",
  ).in("transport_order_id", orderIds).in("status", ["issued", "in_execution", "completed", "amended"]).order(
    "issued_at",
    { ascending: false },
  );
  if (result.error) throw new Error(result.error.message);
  return reply(200, { items: result.data });
}
async function portalRegulatoryDocumentDetail(db: Db, access: Access, regulatoryDocumentId: string) {
  const policy = await portalPolicy(db, access);
  if (!policy.regulatory_documents) return fail(404, "not_found", "Documento no encontrado.");
  const result = await db.from("transport_regulatory_documents").select(
    "id,transport_order_id,document_number,document_type,status,issued_at,effective_at,revision_number",
  ).eq("id", regulatoryDocumentId).in("status", ["issued", "in_execution", "completed", "amended"]).maybeSingle();
  if (!result.data) return fail(404, "not_found", "Documento no encontrado.");
  const order = await db.from("transport_orders").select("id").eq("id", result.data.transport_order_id).eq(
    "organization_id",
    access.membership.organization_id,
  ).eq("customer_id", access.membership.customer_id).maybeSingle();
  return order.data ? reply(200, result.data) : fail(404, "not_found", "Documento no encontrado.");
}
async function signedDocument(db: Db, access: Access, documentId: string, publicOrigin: string) {
  const result = await db.from("documents").select(
    "id,organization_id,transport_order_id,invoice_id,client_visible,current_version_id,archived_at,document_versions!documents_current_version_fk(storage_bucket,storage_path,status)",
  ).eq("id", documentId).maybeSingle();
  const doc = result.data;
  if (!doc || doc.archived_at || doc.organization_id !== access.membership.organization_id) {
    return fail(404, "not_found", "Documento no encontrado.");
  }
  let owned = false;
  let visible = false;
  if (doc.transport_order_id) {
    const order = await db.from("transport_orders").select("customer_id").eq("id", doc.transport_order_id).single();
    owned = order.data?.customer_id === access.membership.customer_id;
    if (owned) {
      const [policy, pod, regulatory] = await Promise.all([
        db.from("client_portal_visibility_policies").select("pod,regulatory_documents").eq(
          "organization_id",
          access.membership.organization_id,
        ).eq("customer_id", access.membership.customer_id).single(),
        db.from("proofs_of_delivery").select("id").eq("document_id", doc.id).maybeSingle(),
        db.from("transport_regulatory_evidence").select("id").eq("document_id", doc.id).maybeSingle(),
      ]);
      visible = doc.client_visible || (policy.data?.pod === true && pod.data !== null) ||
        (policy.data?.regulatory_documents === true && regulatory.data !== null);
    }
  }
  if (doc.invoice_id) {
    const invoice = await db.from("invoices").select("customer_id,status").eq("id", doc.invoice_id).single();
    owned = invoice.data !== null && invoice.data.customer_id === access.membership.customer_id &&
      invoice.data.status !== "draft";
    visible = owned;
  }
  const version = Array.isArray(doc.document_versions) ? doc.document_versions[0] : doc.document_versions;
  if (!owned || !visible || !version || version.status !== "available") {
    return fail(404, "not_found", "Documento no encontrado.");
  }
  const signed = await db.storage.from(version.storage_bucket).createSignedUrl(version.storage_path, 60);
  if (signed.error) return fail(404, "not_found", "Documento no disponible.");
  const publicUrl = new URL(signed.data.signedUrl);
  const origin = new URL(publicOrigin);
  publicUrl.protocol = origin.protocol;
  publicUrl.host = origin.host;
  return reply(200, { url: publicUrl.toString(), expiresIn: 60 });
}
async function signedInvoice(db: Db, access: Access, invoiceId: string, publicOrigin: string) {
  const invoice = await db.from("invoices").select("id,customer_id,status").eq("id", invoiceId).maybeSingle();
  if (!invoice.data || invoice.data.customer_id !== access.membership.customer_id || invoice.data.status === "draft") {
    return fail(404, "not_found", "Factura no encontrada.");
  }
  const doc = await db.from("documents").select("id").eq("invoice_id", invoiceId).eq("status", "available")
    .maybeSingle();
  if (!doc.data) return fail(404, "not_found", "PDF no disponible.");
  return signedDocument(db, access, doc.data.id, publicOrigin);
}
async function signedPod(db: Db, access: Access, podId: string, publicOrigin: string) {
  const pod = await db.from("proofs_of_delivery").select("document_id").eq("id", podId).maybeSingle();
  return pod.data
    ? signedDocument(db, access, pod.data.document_id, publicOrigin)
    : fail(404, "not_found", "Documento no encontrado.");
}
async function signedRegulatoryDocument(
  db: Db,
  access: Access,
  regulatoryDocumentId: string,
  publicOrigin: string,
) {
  const regulatory = await db.from("transport_regulatory_documents").select("document_id").eq(
    "id",
    regulatoryDocumentId,
  ).maybeSingle();
  return regulatory.data?.document_id
    ? signedDocument(db, access, regulatory.data.document_id, publicOrigin)
    : fail(404, "not_found", "Documento no encontrado.");
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function requiredUuid(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) throw new Error("Identificador inválido.");
  return value;
}
function optionalUuid(value: unknown) {
  return value == null ? null : requiredUuid(value);
}
function requiredText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Campo obligatorio.");
  return value.trim();
}
function optionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
function requiredEmail(value: unknown) {
  const email = requiredText(value).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Email inválido.");
  return email;
}
function requiredPassword(value: unknown) {
  const password = requiredText(value);
  if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error("La contraseña debe tener 12 caracteres, mayúscula, minúscula y número.");
  }
  return password;
}
async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
