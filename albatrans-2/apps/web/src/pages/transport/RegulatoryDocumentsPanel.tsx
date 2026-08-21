import type { RegulatoryDocumentExportV1 } from "@albatrans/contracts";
import { useCallback, useEffect, useState } from "react";
import {
  createRegulatoryDraft,
  downloadRegulatoryPdf,
  executeRegulatoryAction,
  exportRegulatoryDocument,
  listRegulatoryDocuments,
  loadRegulatoryDocument,
  type RegulatoryDetail,
  type RegulatoryListItem,
} from "../../data/regulatory-documents-repository";

export function RegulatoryDocumentsPanel({ organizationId, orderId }: { organizationId: string; orderId: string }) {
  const [items, setItems] = useState<RegulatoryListItem[]>([]);
  const [selected, setSelected] = useState<RegulatoryDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    setItems(await listRegulatoryDocuments(organizationId, orderId));
  }, [organizationId, orderId]);

  useEffect(() => {
    refresh().catch((cause: unknown) => setError(message(cause)));
  }, [refresh]);

  async function run(action: "issue" | "generate_pdf" | "complete" | "cancel" | "archive", id: string) {
    setBusy(true);
    setError("");
    try {
      await executeRegulatoryAction(action, organizationId, id, action === "cancel" ? { reason: "Cancelación administrativa" } : {});
      await refresh();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  async function revision(id: string) {
    const reason = prompt("Motivo obligatorio de la revisión");
    if (!reason) return;
    setBusy(true);
    try {
      await executeRegulatoryAction("create_revision", organizationId, id, { reason });
      await refresh();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  async function download(id: string) {
    try {
      open(await downloadRegulatoryPdf(organizationId, id), "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(message(cause));
    }
  }

  async function exportJson(id: string) {
    try {
      const value: RegulatoryDocumentExportV1 = await exportRegulatoryDocument(organizationId, id);
      const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${value.header.documentNumber ?? "regulatory"}-R${value.header.revision}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(message(cause));
    }
  }

  return <section className="detail-section">
    <div className="section-heading">
      <div><h2>Documentos reglamentarios</h2><p>Documento de Control y preparación estructural eCMR. Sin certificación normativa.</p></div>
      <button className="button" disabled={busy || items.some((item) => item.documentType === "control_document" && !["cancelled", "archived"].includes(item.status))} onClick={() => {
        setBusy(true);
        createRegulatoryDraft(organizationId, orderId).then(refresh).catch((cause: unknown) => setError(message(cause))).finally(() => setBusy(false));
      }}>Crear borrador</button>
    </div>
    {error && <p role="alert" className="error-banner">{error}</p>}
    {!items.length ? <p>Sin documentos reglamentarios.</p> : <div className="table-shell"><table>
      <thead><tr><th>Tipo</th><th>Número</th><th>Rev.</th><th>Estado</th><th>Emisión</th><th>Acciones</th></tr></thead>
      <tbody>{items.map((item) => <tr key={item.id}>
        <td>{item.documentType}</td><td>{item.documentNumber ?? "Pendiente"}</td><td>{item.revisionNumber}</td><td>{item.status}</td>
        <td>{item.issuedAt ? new Date(item.issuedAt).toLocaleString("es-ES") : "—"}</td>
        <td className="action-row">
          <button className="button button-secondary" onClick={() => loadRegulatoryDocument(organizationId, item.id).then(setSelected).catch((cause: unknown) => setError(message(cause)))}>Revisar</button>
          {["draft", "ready"].includes(item.status) && <button className="button" disabled={busy} onClick={() => void run("issue", item.id)}>Emitir</button>}
          {["issued", "in_execution", "completed"].includes(item.status) && <button className="button button-secondary" onClick={() => void run("generate_pdf", item.id)}>Generar PDF</button>}
          {item.documentId && <button className="button button-secondary" onClick={() => void download(item.id)}>Descargar</button>}
          <button className="button button-secondary" onClick={() => void exportJson(item.id)}>Export JSON</button>
          {["issued", "in_execution", "completed"].includes(item.status) && <button className="button button-secondary" onClick={() => void revision(item.id)}>Nueva revisión</button>}
        </td>
      </tr>)}</tbody>
    </table></div>}
    {selected && <RegulatoryDetailView detail={selected} close={() => setSelected(null)} />}
  </section>;
}

function RegulatoryDetailView({ detail, close }: { detail: RegulatoryDetail; close: () => void }) {
  const snapshot = (detail.document.currentSnapshot ?? detail.document.current_snapshot_json) as Record<string, unknown>;
  const sections = ["Documento", "Participantes", "Transporte", "Paradas", "Mercancía", "Firmas", "Evidencias", "Historial de revisiones"];
  return <div className="modal-backdrop" role="presentation"><article className="modal-card regulatory-detail" role="dialog" aria-modal="true" aria-label="Documento reglamentario">
    <div className="section-heading"><h2>{detail.document.documentNumber ?? "Borrador"} · Revisión {detail.document.revisionNumber}</h2><button className="button button-secondary" onClick={close}>Cerrar</button></div>
    {detail.validation.errors.length > 0 && <div className="error-banner"><strong>Errores antes de emisión</strong><ul>{detail.validation.errors.map((error) => <li key={error.code}>{error.message}</li>)}</ul></div>}
    {sections.map((title) => <section key={title}><h3>{title}</h3><pre>{JSON.stringify(section(snapshot, detail, title), null, 2)}</pre></section>)}
    <p className="driver-muted">Hash de integridad técnica; no es firma legal ni acreditación eCMR/eIDAS.</p>
  </article></div>;
}

function section(snapshot: Record<string, unknown>, detail: RegulatoryDetail, title: string) {
  if (title === "Participantes") return snapshot.parties;
  if (title === "Transporte") return snapshot.transport;
  if (title === "Paradas") return snapshot.stops;
  if (title === "Mercancía") return snapshot.goods;
  if (title === "Firmas") return detail.signatures;
  if (title === "Evidencias") return detail.evidences;
  if (title === "Historial de revisiones") return detail.revisions;
  return detail.document;
}

function message(cause: unknown) {
  return cause instanceof Error ? cause.message : "Operación reglamentaria fallida.";
}
