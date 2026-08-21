import { createClient } from "npm:@supabase/supabase-js@2.55.0";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type,idempotency-key",
  "Content-Type": "application/json",
};
const response = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
const fail = (status: number, code: string, message: string) => response(status, { error: { code, message } });
const client = (url: string, key: string, bearer?: string) =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: bearer ? { headers: { Authorization: bearer } } : undefined,
  });
type Db = ReturnType<typeof client>;
type Scope = "platform" | "organization";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return fail(405, "method", "Método no permitido.");
  const bearer = req.headers.get("Authorization");
  if (!bearer?.startsWith("Bearer ")) return fail(401, "unauthorized", "Sesión requerida.");
  const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return fail(500, "config", "Servicio no configurado.");
  const db = client(url, service),
    auth = await db.auth.getUser(bearer.slice(7));
  if (auth.error || !auth.data.user) return fail(401, "unauthorized", "Sesión no válida.");
  let body: Record<string, unknown>;
  try {
    const raw: unknown = await req.json();
    if (!record(raw)) throw new Error();
    body = raw;
  } catch {
    return fail(400, "payload", "JSON inválido.");
  }
  const action = text(body.action),
    org = text(body.organizationId),
    key = text(body.idempotencyKey) || req.headers.get("idempotency-key") || "";
  if (!uuid(org) || !uuid(key)) return fail(400, "payload", "organizationId e idempotencyKey deben ser UUID.");
  const orderId = typeof body.transportOrderId === "string" ? body.transportOrderId : null,
    documentId = typeof body.regulatoryDocumentId === "string" ? body.regulatoryDocumentId : null;
  const access = await authorize(db, auth.data.user.id, org, orderId, documentId, action);
  if (!access.ok) return fail(access.status, "forbidden", access.message);
  const correlation = crypto.randomUUID();
  try {
    if (action === "list") return await list(db, org, orderId);
    if (action === "detail") return await detail(db, org, requiredUuid(documentId));
    if (action === "validate") {
      const d = await regulatory(db, org, requiredUuid(documentId));
      const v = await db.rpc("validate_regulatory_snapshot", { p_snapshot: d.current_snapshot_json });
      if (v.error) return database(v.error);
      return response(200, v.data);
    }
    if (action === "create_draft") {
      return rpc(
        await db.rpc("create_regulatory_document", {
          p_actor: auth.data.user.id,
          p_scope: access.scope,
          p_org: org,
          p_order: requiredUuid(orderId),
          p_type: body.documentType === "ecmr_draft" ? "ecmr_draft" : "control_document",
          p_correlation: correlation,
          p_key: key,
        }),
      );
    }
    if (action === "issue") {
      return rpc(
        await db.rpc("issue_transport_regulatory_document", {
          p_actor: auth.data.user.id,
          p_scope: access.scope,
          p_org: org,
          p_document: requiredUuid(documentId),
          p_correlation: correlation,
          p_key: key,
        }),
      );
    }
    if (action === "create_revision") {
      return rpc(
        await db.rpc("create_regulatory_revision", {
          p_actor: auth.data.user.id,
          p_scope: access.scope,
          p_org: org,
          p_document: requiredUuid(documentId),
          p_reason: requiredText(body.reason),
          p_correlation: correlation,
          p_key: key,
        }),
      );
    }
    if (["complete", "cancel", "archive"].includes(action)) {
      return rpc(
        await db.rpc("transition_regulatory_document", {
          p_actor: auth.data.user.id,
          p_scope: access.scope,
          p_org: org,
          p_document: requiredUuid(documentId),
          p_target: action === "complete" ? "completed" : action === "cancel" ? "cancelled" : "archived",
          p_reason: typeof body.reason === "string" ? body.reason : null,
          p_correlation: correlation,
          p_key: key,
        }),
      );
    }
    if (action === "generate_pdf") {
      return await generatePdf(db, auth.data.user.id, access.scope, org, requiredUuid(documentId), key, correlation);
    }
    if (action === "download_pdf") return await downloadPdf(db, org, requiredUuid(documentId), req);
    if (action === "sign") {
      return await sign(
        db,
        auth.data.user.id,
        access.scope,
        org,
        requiredUuid(documentId),
        body,
        key,
        correlation,
        req,
      );
    }
    if (action === "export") return await exportV1(db, org, requiredUuid(documentId));
    return fail(400, "action", "Acción no soportada.");
  } catch (e) {
    return fail(400, "request", e instanceof Error ? e.message : "Operación inválida.");
  }
});
async function authorize(
  db: Db,
  user: string,
  org: string,
  order: string | null,
  document: string | null,
  action: string,
) {
  const [profile, platform, membership, organization, module] = await Promise.all([
    db.from("profiles").select("status").eq("user_id", user).maybeSingle(),
    db.from("platform_admins").select("role,status").eq("user_id", user).maybeSingle(),
    db.from("organization_memberships").select("id,role,status").eq("organization_id", org).eq("user_id", user)
      .maybeSingle(),
    db.from("organizations").select("status").eq("id", org).maybeSingle(),
    db.from("modules").select("id").eq("code", "electronic_delivery_notes").single(),
  ]);
  if (profile.data?.status !== "active" || organization.data?.status !== "active" || !module.data) {
    return { ok: false as const, status: 403, message: "Perfil, organización o módulo inactivo." };
  }
  if (platform.data?.role === "superadmin" && platform.data.status === "active") {
    return { ok: true as const, scope: "platform" as Scope, driver: false };
  }
  if (!membership.data || membership.data.status !== "active") {
    return { ok: false as const, status: 403, message: "Membership inactiva." };
  }
  const enabled = await moduleEnabled(db, org, module.data.id);
  if (!enabled) return { ok: false as const, status: 403, message: "Módulo electronic_delivery_notes desactivado." };
  if (membership.data.role === "admin_empresa") {
    return { ok: true as const, scope: "organization" as Scope, driver: false };
  }
  if (membership.data.role !== "conductor" || !["list", "detail", "download_pdf", "export", "sign"].includes(action)) {
    return { ok: false as const, status: 403, message: "Operación no autorizada." };
  }
  let targetOrder = order;
  if (!targetOrder && document) {
    const d = await db.from("transport_regulatory_documents").select("transport_order_id").eq("id", document).eq(
      "organization_id",
      org,
    ).maybeSingle();
    targetOrder = d.data?.transport_order_id ?? null;
  }
  const driver = await db.from("drivers").select("id,employment_status,archived_at").eq(
    "membership_id",
    membership.data.id,
  ).eq("organization_id", org).maybeSingle();
  if (!driver.data || driver.data.employment_status !== "active" || driver.data.archived_at) {
    return { ok: false as const, status: 403, message: "Conductor inactivo." };
  }
  if (targetOrder) {
    const assigned = await db.from("transport_orders").select("id").eq("id", targetOrder).eq("organization_id", org).eq(
      "assigned_driver_id",
      driver.data.id,
    ).maybeSingle();
    if (!assigned.data) return { ok: false as const, status: 404, message: "Documento no disponible." };
  }
  return { ok: true as const, scope: "organization" as Scope, driver: true };
}
async function moduleEnabled(db: Db, org: string, module: string) {
  const override = await db.from("organization_module_overrides").select("override_mode").eq("organization_id", org).eq(
    "module_id",
    module,
  ).maybeSingle();
  if (override.data) return override.data.override_mode === "enabled";
  const sub = await db.from("organization_subscriptions").select("plan_id").eq("organization_id", org).maybeSingle();
  if (!sub.data) return false;
  const plan = await db.from("plan_modules").select("enabled").eq("plan_id", sub.data.plan_id).eq("module_id", module)
    .maybeSingle();
  return plan.data?.enabled === true;
}
async function list(db: Db, org: string, order: string | null) {
  let q = db.from("transport_regulatory_documents").select("*").eq("organization_id", org).order("created_at", {
    ascending: false,
  });
  if (order) q = q.eq("transport_order_id", order);
  const r = await q;
  if (r.error) return database(r.error);
  return response(200, r.data);
}
async function detail(db: Db, org: string, id: string) {
  const d = await regulatory(db, org, id);
  const [revisions, evidences, signatures] = await Promise.all([
    db.from("transport_regulatory_revisions").select("*").eq("regulatory_document_id", id).order("revision_number", {
      ascending: false,
    }),
    db.from("transport_regulatory_evidence").select("*").eq("regulatory_document_id", id).order("created_at", {
      ascending: false,
    }),
    d.document_id
      ? db.from("document_signatures").select("*").eq("document_id", d.document_id).order("created_at", {
        ascending: false,
      })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (revisions.error || evidences.error || signatures.error) {
    return database(revisions.error || evidences.error || signatures.error!);
  }
  const validation = await db.rpc("validate_regulatory_snapshot", { p_snapshot: d.current_snapshot_json });
  return response(200, {
    document: d,
    revisions: revisions.data,
    evidences: evidences.data,
    signatures: signatures.data,
    validation: validation.data,
  });
}
async function regulatory(db: Db, org: string, id: string) {
  const r = await db.from("transport_regulatory_documents").select("*").eq("organization_id", org).eq("id", id)
    .single();
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
async function generatePdf(
  db: Db,
  actor: string,
  scope: Scope,
  org: string,
  id: string,
  key: string,
  correlation: string,
) {
  const d = await regulatory(db, org, id);
  if (!["issued", "in_execution", "completed"].includes(d.status)) {
    throw new Error("Emite el documento antes de generar PDF.");
  }
  const existing = await db.from("documents").select("id,current_version_id").eq("organization_id", org).eq(
    "transport_order_id",
    d.transport_order_id,
  ).eq("document_type", `regulatory_pdf:${id}:r${d.revision_number}`).eq("status", "available").maybeSingle();
  if (existing.data) {
    return response(200, {
      documentId: existing.data.id,
      versionId: existing.data.current_version_id,
      status: "available",
      idempotent: true,
    });
  }
  const bytes = pdfBytes(d),
    hash = await sha(bytes),
    documentId = crypto.randomUUID(),
    versionId = crypto.randomUUID(),
    path = `${org}/regulatory/${id}/revision-${d.revision_number}/${versionId}.pdf`;
  const up = await db.storage.from("albatrans-documents").upload(path, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (up.error) return database(up.error);
  const doc = await db.from("documents").insert({
    id: documentId,
    organization_id: org,
    transport_order_id: d.transport_order_id,
    document_type: `regulatory_pdf:${id}:r${d.revision_number}`,
    title: `${d.document_number} revisión ${d.revision_number}`,
    status: "pending_upload",
    source: "generated",
    created_by: actor,
  }).select().single();
  if (doc.error) return database(doc.error);
  const ver = await db.from("document_versions").insert({
    id: versionId,
    organization_id: org,
    document_id: documentId,
    version_number: 1,
    storage_bucket: "albatrans-documents",
    storage_path: path,
    original_filename: `${d.document_number}-R${d.revision_number}.pdf`,
    mime_type: "application/pdf",
    size_bytes: bytes.byteLength,
    sha256: hash,
    uploaded_by: actor,
    uploaded_at: new Date().toISOString(),
    status: "available",
    metadata: { regulatoryDocumentId: id, revision: d.revision_number, contentHash: d.content_hash },
  }).select().single();
  if (ver.error) return database(ver.error);
  await db.from("documents").update({ status: "available", current_version_id: versionId }).eq("id", documentId);
  await db.from("transport_regulatory_documents").update({ document_id: documentId }).eq("id", id);
  const revision = (await db.from("transport_regulatory_revisions").select("id").eq("regulatory_document_id", id).eq(
    "revision_number",
    d.revision_number,
  ).single()).data!;
  await Promise.all([
    db.from("transport_regulatory_evidence").insert({
      organization_id: org,
      regulatory_document_id: id,
      revision_id: revision.id,
      evidence_type: "document",
      document_id: documentId,
      document_version_id: versionId,
      actor_user_id: actor,
      evidence_json: { mimeType: "application/pdf", sha256: hash },
    }),
    db.from("transport_events").insert({
      organization_id: org,
      transport_order_id: d.transport_order_id,
      event_type: "regulatory_document.pdf_generated",
      actor_user_id: actor,
      entity_type: "regulatory_document",
      entity_id: id,
      payload: { revision: d.revision_number, documentId },
      correlation_id: correlation,
    }),
    db.from("audit_events").insert({
      organization_id: org,
      actor_user_id: actor,
      actor_scope: scope,
      action: "regulatory_document.pdf_generated",
      entity_type: "transport_regulatory_document",
      entity_id: id,
      after_data: { revision: d.revision_number, documentId, sha256: hash },
      correlation_id: correlation,
    }),
    db.from("regulatory_document_outbox").insert({
      organization_id: org,
      regulatory_document_id: id,
      event_type: "document.pdf_generated",
      payload: { revision: d.revision_number, documentId },
    }),
  ]);
  return response(200, { documentId, versionId, status: "available", sha256: hash, idempotencyKey: key });
}
async function downloadPdf(db: Db, org: string, id: string, req: Request) {
  const d = await regulatory(db, org, id);
  if (!d.document_id) return fail(404, "pdf_missing", "PDF no generado.");
  const doc = await db.from("documents").select("current_version_id").eq("id", d.document_id).single();
  const ver = await db.from("document_versions").select("storage_bucket,storage_path").eq(
    "id",
    doc.data!.current_version_id,
  ).single();
  const signed = await db.storage.from(ver.data!.storage_bucket).createSignedUrl(ver.data!.storage_path, 120);
  if (signed.error) return database(signed.error);
  return response(200, { signedUrl: publicSignedUrl(signed.data.signedUrl, req), expiresIn: 120 });
}

function publicSignedUrl(value: string, req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host || host === "kong" || host.startsWith("kong:")) return value;
  const protocol = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "") ?? "http";
  const forwardedPort = req.headers.get("x-forwarded-port");
  const publicHost = forwardedPort && !host.endsWith(`:${forwardedPort}`) ? `${host}:${forwardedPort}` : host;
  const signed = new URL(value);
  return `${protocol}://${publicHost}${signed.pathname}${signed.search}`;
}
async function sign(
  db: Db,
  actor: string,
  scope: Scope,
  org: string,
  id: string,
  body: Record<string, unknown>,
  key: string,
  correlation: string,
  req: Request,
) {
  const d = await regulatory(db, org, id);
  if (!d.document_id) throw new Error("Genera el PDF antes de firmar.");
  const doc = await db.from("documents").select("current_version_id").eq("id", d.document_id).single();
  const value = requiredText(body.signatureValue), hash = await sha(new TextEncoder().encode(value));
  const existingSignature = await db.from("document_signatures").select("id").eq("document_id", d.document_id).eq(
    "signature_hash",
    hash,
  ).is("revoked_at", null).maybeSingle();
  if (existingSignature.error) return database(existingSignature.error);
  if (existingSignature.data) {
    return response(200, {
      signatureId: existingSignature.data.id,
      status: "signed",
      contentHash: hash,
      idempotent: true,
    });
  }
  const signedAt = new Date().toISOString();
  const rpcResult = await db.rpc("command_document_signature", {
    p_actor: actor,
    p_scope: scope,
    p_org: org,
    p_action: "create",
    p_signature: null,
    p_document: d.document_id,
    p_version: doc.data!.current_version_id,
    p_values: {
      signatureType: body.signatureType === "typed" ? "typed" : "drawn",
      signerName: requiredText(body.signerName),
      signerRole: requiredText(body.signerRole),
      signedAt,
      signatureHash: hash,
      signatureDataPath: typeof body.signatureDataPath === "string" ? body.signatureDataPath : null,
      userAgent: req.headers.get("user-agent"),
    },
    p_correlation: correlation,
    p_key: key,
  });
  if (rpcResult.error) return database(rpcResult.error);
  const signature = await db.from("document_signatures").select("id").eq("document_id", d.document_id).eq(
    "signature_hash",
    hash,
  ).order("created_at", { ascending: false }).limit(1).single();
  const rev = await db.from("transport_regulatory_revisions").select("id").eq("regulatory_document_id", id).eq(
    "revision_number",
    d.revision_number,
  ).single();
  await db.from("transport_regulatory_evidence").upsert({
    organization_id: org,
    regulatory_document_id: id,
    revision_id: rev.data!.id,
    evidence_type: "signature",
    document_id: d.document_id,
    document_version_id: doc.data!.current_version_id,
    signature_id: signature.data!.id,
    actor_user_id: actor,
    evidence_json: { signerRole: body.signerRole, signedAt },
  }, { onConflict: "signature_id", ignoreDuplicates: true });
  await Promise.all([
    db.from("transport_events").insert({
      organization_id: org,
      transport_order_id: d.transport_order_id,
      event_type: "regulatory_document.signed",
      actor_user_id: actor,
      entity_type: "regulatory_document",
      entity_id: id,
      payload: { revision: d.revision_number, signerRole: body.signerRole },
      correlation_id: correlation,
    }),
    db.from("audit_events").insert({
      organization_id: org,
      actor_user_id: actor,
      actor_scope: scope,
      action: "regulatory_document.signed",
      entity_type: "transport_regulatory_document",
      entity_id: id,
      after_data: { revision: d.revision_number, signerRole: body.signerRole, signatureId: signature.data!.id },
      correlation_id: correlation,
    }),
    db.from("regulatory_document_outbox").insert({
      organization_id: org,
      regulatory_document_id: id,
      event_type: "document.signed",
      payload: { revision: d.revision_number, signerRole: body.signerRole },
    }),
  ]);
  return response(200, { signatureId: signature.data!.id, status: "signed", contentHash: hash });
}
async function exportV1(db: Db, org: string, id: string) {
  const d = await regulatory(db, org, id),
    revs = await db.from("transport_regulatory_revisions").select(
      "revision_number,content_hash,amendment_reason,created_at",
    ).eq("regulatory_document_id", id).order("revision_number"),
    evid = await db.from("transport_regulatory_evidence").select("*").eq("regulatory_document_id", id),
    sigs = d.document_id
      ? await db.from("document_signatures").select("signer_name,signer_role,signed_at,signature_type,signature_hash")
        .eq("document_id", d.document_id).is("revoked_at", null)
      : { data: [] };
  const s = d.current_snapshot_json as Record<string, unknown>;
  return response(200, {
    format: "albatrans.regulatory.v1",
    notice: "Internal structured export; not a certified eCMR standard.",
    header: {
      documentId: d.id,
      documentType: d.document_type,
      documentNumber: d.document_number,
      revision: d.revision_number,
      schemaVersion: d.schema_version,
      status: d.status,
      contentHash: d.content_hash,
    },
    parties: s.parties ?? [],
    transport: s.transport ?? {},
    stops: s.stops ?? [],
    goods: s.goods ?? [],
    signatures: (sigs.data ?? []).map((x) => ({
      signerName: x.signer_name,
      signerRole: x.signer_role,
      signedAt: x.signed_at,
      type: x.signature_type,
      hash: x.signature_hash,
    })),
    evidences: evid.data ?? [],
    revisions: (revs.data ?? []).map((x) => ({
      revision: x.revision_number,
      hash: x.content_hash,
      reason: x.amendment_reason,
      createdAt: x.created_at,
    })),
  });
}
function pdfBytes(d: Record<string, unknown>) {
  const snapshot = record(d.current_snapshot_json) ? d.current_snapshot_json : {},
    transport = record(snapshot.transport) ? snapshot.transport : {},
    parties = Array.isArray(snapshot.parties) ? snapshot.parties.filter(record) : [],
    goods = Array.isArray(snapshot.goods) ? snapshot.goods.filter(record) : [],
    safe = (v: unknown) =>
      String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "?").replace(
        /[()\\]/g,
        "\\$&",
      );
  const lines = [
    `DOCUMENTO DE CONTROL ${safe(d.document_number)}`,
    `Revision ${safe(d.revision_number)} - Esquema ${safe(d.schema_version)}`,
    `Orden: ${safe(transport.reference)}  Servicio: ${safe(transport.serviceType)}`,
    ...parties.map((p) => `${safe(p.role)}: ${safe(p.legalName)} - ${safe(p.taxId)}`),
    `Vehiculo: ${safe(transport.vehiclePlate)}  Conductor: ${safe(transport.driverName)}`,
    ...goods.slice(0, 18).map((g) =>
      `${safe(g.description)} | Pallets ${safe(g.pallets)} | Bultos ${safe(g.packages)} | Kg ${safe(g.grossWeightKg)}`
    ),
    `Hash integridad tecnica: ${safe(d.content_hash)}`,
    "Documento tecnico interno. Requiere validacion juridica externa; no certifica eCMR/eIDAS.",
  ];
  const commands = ["BT", "/F1 14 Tf", "50 800 Td"];
  lines.forEach((line, i) => {
    if (i) {
      commands.push("0 -20 Td");
      if (i === 1) commands.push("/F1 10 Tf");
    }
    commands.push(`(${safe(line).slice(0, 95)}) Tj`);
  });
  commands.push("ET");
  const stream = commands.join("\n"),
    objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
      `<< /Length ${new TextEncoder().encode(stream).byteLength} >>\nstream\n${stream}\nendstream`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(new TextEncoder().encode(pdf).byteLength);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = new TextEncoder().encode(pdf).byteLength;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${
    offsets.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n `).join("\n")
  }\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
async function sha(bytes: BufferSource) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((v) =>
    v.toString(16).padStart(2, "0")
  ).join("");
}
function rpc(r: { data: unknown; error: { code?: string; message: string } | null }) {
  return r.error ? database(r.error) : response(200, record(r.data) ? r.data : { result: r.data });
}
function database(e: { code?: string; message: string }) {
  return fail(e.code === "42501" ? 403 : e.code === "23505" ? 409 : 400, e.code ?? "database", e.message);
}
function record(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function text(v: unknown) {
  return typeof v === "string" ? v : "";
}
function uuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function requiredUuid(v: string | null) {
  if (!v || !uuid(v)) throw new Error("UUID inválido.");
  return v;
}
function requiredText(v: unknown) {
  if (typeof v !== "string" || !v.trim()) throw new Error("Texto requerido.");
  return v.trim();
}
