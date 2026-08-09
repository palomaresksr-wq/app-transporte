import { validateDocumentFile } from "@albatrans/domain";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  downloadDocument,
  executeDocumentCommand,
  loadDocuments,
  uploadDocument,
  type DocumentListItem,
} from "../../data/documents-repository";
import {
  approveOcrReview,
  correctOcrField,
  loadOcrJobsByDocumentIds,
  loadOcrQuotaSummary,
  processNextOcrJob,
  rejectOcrReview,
  requestOcr,
  startOcrReview,
  type OcrJobView,
  type OcrQuotaSummary,
} from "../../data/ocr-repository";

interface StopOption {
  id: string;
  position: number;
  stop_type: string;
}

const importantFields = [
  "document_number",
  "issue_date",
  "sender_name",
  "recipient_name",
  "carrier_name",
] as const;

export function DocumentManager({ organizationId, orderId, stops }: {
  organizationId: string;
  orderId: string;
  stops: StopOption[];
}) {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [ocrByDocument, setOcrByDocument] = useState<Map<string, OcrJobView[]>>(new Map());
  const [quota, setQuota] = useState<OcrQuotaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [corrections, setCorrections] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const docs = await loadDocuments({ organizationId, transportOrderId: orderId });
      setDocuments(docs);
      const [ocrMap, quotaSummary] = await Promise.all([
        loadOcrJobsByDocumentIds(organizationId, docs.map((doc) => doc.id)),
        loadOcrQuotaSummary(organizationId),
      ]);
      setOcrByDocument(ocrMap);
      setQuota(quotaSummary);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los documentos OCR.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, orderId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const cameraFile = data.get("cameraFile");
    const selectedFile = data.get("file");
    const file = cameraFile instanceof File && cameraFile.size > 0 ? cameraFile : selectedFile;

    if (!(file instanceof File) || file.size === 0) {
      setError("Selecciona un archivo.");
      return;
    }

    try {
      setBusy(true);
      setError("");
      setSuccess("");
      const validated = validateDocumentFile(file.type, file.size);
      await uploadDocument({
        organizationId,
        documentType: String(data.get("documentType")),
        title: String(data.get("title")),
        description: String(data.get("description") || "") || undefined,
        source: cameraFile instanceof File && cameraFile.size > 0 ? "camera" : "upload",
        originalFilename: file.name,
        mimeType: validated.mimeType,
        sizeBytes: validated.sizeBytes,
        relations: {
          transportOrderId: orderId,
          transportStopId: String(data.get("stopId") || "") || undefined,
        },
      }, file);
      event.currentTarget.reset();
      setSuccess("Documento confirmado y disponible.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo subir el documento. Puedes reintentarlo.");
    } finally {
      setBusy(false);
    }
  }

  async function command(
    action: "archive" | "create_pod" | "confirm_pod" | "reject_pod" | "create_signature" | "revoke_signature",
    documentId: string | undefined,
    values: Record<string, string | null> = {},
    entityId?: string,
    versionId?: string,
  ) {
    try {
      setBusy(true);
      setError("");
      await executeDocumentCommand({
        action,
        organizationId,
        documentId,
        entityId,
        versionId,
        transportOrderId: orderId,
        values,
        reason: action === "archive" ? values.reason ?? "Archivado administrativo" : undefined,
      });
      setSuccess("Operacion documental completada.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo completar la operacion.");
    } finally {
      setBusy(false);
    }
  }

  async function open(versionId: string) {
    try {
      const result = await downloadDocument(organizationId, versionId);
      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo abrir el documento.");
    }
  }

  async function triggerOcr(documentId: string, documentVersionId: string, providerMode?: "success" | "low_confidence" | "timeout" | "failure" | "invalid") {
    try {
      setBusy(true);
      setError("");
      setSuccess("");
      await requestOcr({
        organizationId,
        documentId,
        documentVersionId,
        providerCode: "mock_local",
        providerMode,
        importantFields: [...importantFields],
      });
      const workerResult = await processNextOcrJob(organizationId);
      if (workerResult.processed === false) {
        setSuccess("OCR solicitado. La cola local queda pendiente de procesar.");
      } else {
        setSuccess("OCR procesado y almacenado.");
      }
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo solicitar OCR.");
    } finally {
      setBusy(false);
    }
  }

  async function processQueue() {
    try {
      setBusy(true);
      setError("");
      const result = await processNextOcrJob(organizationId);
      if (result.processed === false) {
        setSuccess("No hay trabajos OCR pendientes.");
      } else {
        setSuccess("Se proceso un trabajo OCR de la cola local.");
      }
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo procesar la cola OCR.");
    } finally {
      setBusy(false);
    }
  }

  async function beginReview(job: OcrJobView) {
    if (!job.result) return;
    try {
      setBusy(true);
      await startOcrReview(organizationId, job.id, job.result.id, "Revision iniciada");
      setSuccess("Revision OCR iniciada.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo iniciar revision OCR.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCorrection(reviewId: string, fieldId: string | undefined, fieldCode: string) {
    const key = `${reviewId}:${fieldCode}`;
    const text = corrections[key];
    if (!text || !text.trim()) {
      setError("Escribe un valor corregido antes de guardar.");
      return;
    }

    let correctedValue: unknown = text;
    try {
      correctedValue = JSON.parse(text);
    } catch {
      correctedValue = text;
    }

    try {
      setBusy(true);
      setError("");
      await correctOcrField(organizationId, reviewId, fieldCode, correctedValue, {
        fieldResultId: fieldId,
        reason: "Correccion manual",
      });
      setSuccess("Correccion OCR registrada.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo registrar la correccion.");
    } finally {
      setBusy(false);
    }
  }

  async function approveReview(reviewId: string) {
    try {
      setBusy(true);
      await approveOcrReview(organizationId, reviewId, "Revision aprobada");
      setSuccess("Revision OCR aprobada.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo aprobar la revision.");
    } finally {
      setBusy(false);
    }
  }

  async function rejectReview(reviewId: string) {
    try {
      setBusy(true);
      await rejectOcrReview(organizationId, reviewId, "Revision rechazada por validacion humana");
      setSuccess("Revision OCR rechazada.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo rechazar la revision.");
    } finally {
      setBusy(false);
    }
  }

  const quotaLabel = useMemo(() => {
    if (!quota) return "Cuota OCR no disponible.";
    if (quota.limit === null) return `Uso ${quota.used} / limite no configurado`;
    return `Uso ${quota.used} + reservado ${quota.reserved} / limite ${quota.limit} (disponible ${quota.available ?? 0})`;
  }, [quota]);

  return (
    <section className="detail-section document-manager" aria-labelledby="documents-title">
      <div className="section-heading">
        <div>
          <h2 id="documents-title">Documentos, POD y OCR</h2>
          <p>
            Archivos privados. OCR conserva respuesta original, permite revision humana y no aplica cambios automaticos sobre ordenes.
          </p>
          <p className="field-hint">{quotaLabel}</p>
        </div>
        <button className="button button-secondary" disabled={busy} onClick={() => void processQueue()}>
          Procesar cola OCR local
        </button>
      </div>

      {error && <p role="alert" className="error-banner">{error}</p>}
      {success && <p role="status" className="success-banner">{success}</p>}

      <form className="panel master-data-form" onSubmit={upload} aria-label="Subir documento">
        <div className="form-grid">
          <label>
            Titulo
            <input name="title" required maxLength={200} />
          </label>
          <label>
            Tipo documental
            <input name="documentType" required maxLength={100} placeholder="albaran, fotografia, justificante" />
          </label>
          <label>
            Parada opcional
            <select name="stopId">
              <option value="">Toda la orden</option>
              {stops.map((stop) => (
                <option key={stop.id} value={stop.id}>
                  Parada {stop.position} - {stop.stop_type}
                </option>
              ))}
            </select>
          </label>
          <label className="full-field">
            Descripcion
            <textarea name="description" maxLength={1000} />
          </label>
          <label>
            Archivo
            <input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" />
          </label>
          <label>
            Captura con camara
            <input name="cameraFile" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-describedby="camera-help" />
          </label>
        </div>
        <p id="camera-help" className="field-hint">JPEG, PNG, WebP o PDF. Maximo 10 MiB.</p>
        <button className="button" disabled={busy}>{busy ? "Subiendo y confirmando..." : "Subir documento"}</button>
      </form>

      {loading && <p role="status" aria-busy="true">Cargando documentos...</p>}
      {!loading && documents.length === 0 && <p>Sin documentos asociados.</p>}

      {!loading && documents.length > 0 && (
        <div className="document-grid">
          {documents.map((document) => {
            const jobs = ocrByDocument.get(document.id) ?? [];
            return (
              <article className="panel document-card" key={document.id}>
                <header>
                  <div>
                    <h3>{document.title}</h3>
                    <p>{document.document_type} - {document.status}</p>
                  </div>
                  {document.status !== "archived" && (
                    <button
                      className="button button-secondary"
                      disabled={busy}
                      onClick={() => void command("archive", document.id, { reason: "Archivado administrativo" })}
                    >
                      Archivar
                    </button>
                  )}
                </header>

                <p>{document.description || "Sin descripcion."}</p>

                <h4>Versiones</h4>
                <ul>
                  {document.versions.map((version) => (
                    <li key={version.id}>
                      <span>v{version.version_number} - {version.mime_type} - {Math.ceil(version.size_bytes / 1024)} KiB - {version.status}</span>
                      <div className="inline-actions">
                        {version.status === "available" && (
                          <button className="link-button" onClick={() => void open(version.id)}>Vista previa segura</button>
                        )}
                        {version.status === "available" && (
                          <button className="button button-secondary" disabled={busy} onClick={() => void triggerOcr(document.id, version.id)}>
                            Procesar con OCR
                          </button>
                        )}
                        {version.status === "available" && (
                          <button className="button button-secondary" disabled={busy} onClick={() => void triggerOcr(document.id, version.id, "low_confidence")}>
                            Simular baja confianza
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                {document.status === "available" && document.proofs.length === 0 && (
                  <button
                    className="button button-secondary"
                    disabled={busy}
                    onClick={() => void command("create_pod", document.id, { deliveredAt: new Date().toISOString() })}
                  >
                    Crear POD
                  </button>
                )}

                {document.proofs.map((pod) => (
                  <div className="document-subsection" key={pod.id}>
                    <strong>POD - {pod.status}</strong>
                    {pod.status === "captured" && (
                      <div className="inline-actions">
                        <button className="button button-secondary" disabled={busy} onClick={() => void command("confirm_pod", document.id, {}, pod.id)}>Confirmar</button>
                        <button className="button button-secondary" disabled={busy} onClick={() => void command("reject_pod", document.id, {}, pod.id)}>Rechazar</button>
                      </div>
                    )}
                  </div>
                ))}

                {document.status === "available" && (
                  <SignatureForm
                    busy={busy}
                    submit={(values) => command("create_signature", document.id, values, undefined, document.current_version_id ?? undefined)}
                  />
                )}

                {document.signatures.length > 0 && (
                  <ul aria-label="Firmas">
                    {document.signatures.map((signature) => (
                      <li key={signature.id}>
                        <span>{signature.signature_type} - {signature.signer_name} - {new Date(signature.signed_at).toLocaleString()}</span>
                        {!signature.revoked_at && (
                          <button
                            className="button button-secondary"
                            disabled={busy}
                            onClick={() => void command("revoke_signature", document.id, { reason: "Revocacion administrativa" }, signature.id)}
                          >
                            Revocar
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="document-subsection">
                  <h4>OCR</h4>
                  {jobs.length === 0 && <p>Sin trabajos OCR para este documento.</p>}
                  {jobs.map((job) => (
                    <article className="ocr-job" key={job.id}>
                      <header>
                        <strong>{job.provider_code}</strong>
                        <span>{job.status} - intento {job.attempt_count}/{job.max_attempts}</span>
                      </header>
                      <p>Solicitado: {new Date(job.requested_at).toLocaleString()}</p>
                      {job.failure_message && <p className="error-text">{job.failure_code}: {job.failure_message}</p>}

                      {job.status === "needs_review" && job.result && (
                        <button className="button button-secondary" disabled={busy} onClick={() => void beginReview(job)}>
                          Iniciar revision
                        </button>
                      )}

                      {job.result && (
                        <div className="ocr-result">
                          <p>
                            Resultado {job.result.schema_version} - confianza global: {job.result.overall_confidence ?? "n/a"} -
                            tipo detectado: {job.result.detected_document_type ?? "sin clasificar"}
                          </p>
                          {Array.isArray(job.result.warnings_json) && job.result.warnings_json.length > 0 && (
                            <p className="warning-text">Warnings: {JSON.stringify(job.result.warnings_json)}</p>
                          )}

                          <details>
                            <summary>Datos normalizados</summary>
                            <pre>{JSON.stringify(job.result.normalized_data_json, null, 2)}</pre>
                          </details>

                          <h5>Campos extraidos</h5>
                          {job.result.fields.length === 0 && <p>Sin campos.</p>}
                          {job.result.fields.length > 0 && (
                            <ul className="ocr-field-list">
                              {job.result.fields.map((field) => {
                                const latestReview = job.reviews.find((review) => review.status === "in_progress" || review.status === "pending") ?? job.reviews[0];
                                const correctionKey = latestReview ? `${latestReview.id}:${field.field_code}` : "";
                                return (
                                  <li key={field.id}>
                                    <div>
                                      <strong>{field.field_code}</strong>
                                      <span>
                                        {field.validation_status} - confianza {field.confidence ?? "n/a"}
                                      </span>
                                      <p>Valor: {stringValue(field.normalized_value)}</p>
                                    </div>
                                    {latestReview && (latestReview.status === "pending" || latestReview.status === "in_progress") && (
                                      <div className="ocr-correction-form">
                                        <input
                                          value={corrections[correctionKey] ?? ""}
                                          onChange={(event) => {
                                            setCorrections((previous) => ({ ...previous, [correctionKey]: event.target.value }));
                                          }}
                                          placeholder="Nuevo valor (texto o JSON)"
                                          aria-label={`Correccion ${field.field_code}`}
                                        />
                                        <button
                                          className="button button-secondary"
                                          disabled={busy}
                                          onClick={() => void saveCorrection(latestReview.id, field.id, field.field_code)}
                                        >
                                          Guardar correccion
                                        </button>
                                      </div>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      )}

                      {job.reviews.length > 0 && (
                        <div className="ocr-review-list">
                          <h5>Revision humana</h5>
                          {job.reviews.map((review) => (
                            <article key={review.id}>
                              <strong>{review.status}</strong>
                              <p>Iniciada: {new Date(review.started_at).toLocaleString()}</p>
                              {review.notes && <p>Notas: {review.notes}</p>}
                              {review.corrections.length > 0 && (
                                <ul>
                                  {review.corrections.map((correction) => (
                                    <li key={correction.id}>
                                      {correction.field_code}: {stringValue(correction.corrected_value)}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {(review.status === "pending" || review.status === "in_progress") && (
                                <div className="inline-actions">
                                  <button className="button button-secondary" disabled={busy} onClick={() => void approveReview(review.id)}>
                                    Aprobar revision
                                  </button>
                                  <button className="button button-secondary" disabled={busy} onClick={() => void rejectReview(review.id)}>
                                    Rechazar revision
                                  </button>
                                </div>
                              )}
                            </article>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SignatureForm({ busy, submit }: {
  busy: boolean;
  submit: (values: Record<string, string | null>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [signature, setSignature] = useState("");

  return (
    <form
      className="document-subsection"
      onSubmit={(event) => {
        event.preventDefault();
        void submit({
          signatureType: "typed",
          signerName: name,
          signatureValue: signature,
          signedAt: new Date().toISOString(),
        }).then(() => {
          setName("");
          setSignature("");
        });
      }}
    >
      <h4>Firma tipada basica</h4>
      <label>
        Firmante
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label>
        Representacion de firma
        <input value={signature} onChange={(event) => setSignature(event.target.value)} required />
      </label>
      <button className="button button-secondary" disabled={busy}>Registrar firma</button>
    </form>
  );
}

function stringValue(value: unknown): string {
  if (value === null || value === undefined) return "n/a";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
