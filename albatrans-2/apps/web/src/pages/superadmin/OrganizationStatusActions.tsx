import type { ChangeOrganizationStatusInput, ChangeOrganizationStatusResult, Organization, OrganizationStatus } from "@albatrans/contracts";
import { organizationStatusTransitions, requiresOrganizationStatusReason } from "@albatrans/domain";
import { useState } from "react";
import { changeOrganizationStatus, OrganizationCommandError } from "../../data/organization-command-repository";

type Changer = (organizationId: string, input: ChangeOrganizationStatusInput) => Promise<ChangeOrganizationStatusResult>;

export function OrganizationStatusActions({ organization, changer = changeOrganizationStatus, onChanged }: { organization: Organization; changer?: Changer; onChanged: () => Promise<void> }) {
  const [target, setTarget] = useState<OrganizationStatus | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const transitions = organizationStatusTransitions(organization.status);
  const expectedConfirmation = organization.tradeName ?? organization.legalName;
  const reasonRequired = target ? requiresOrganizationStatusReason(target) : false;
  const archiveConfirmed = target !== "archived" || confirmation.trim() === expectedConfirmation;

  function choose(status: OrganizationStatus) { setTarget(status); setReason(""); setConfirmation(""); setError(null); setSuccess(null); }
  async function confirm() {
    if (!target) return;
    if (reasonRequired && !reason.trim()) { setError("El motivo es obligatorio para este estado."); return; }
    if (!archiveConfirmed) { setError(`Escribe “${expectedConfirmation}” para confirmar el archivo.`); return; }
    setChanging(true); setError(null); setSuccess(null);
    try {
      await changer(organization.id, { status: target, reason: reason.trim() });
      await onChanged();
      setSuccess(`Estado actualizado a ${target}.`);
      setTarget(null); setReason(""); setConfirmation("");
    } catch (caught) {
      if (caught instanceof OrganizationCommandError && caught.code === "invalid_transition") setError(`Transición no permitida: ${caught.message}`);
      else setError(caught instanceof Error ? caught.message : "No se pudo cambiar el estado.");
    } finally { setChanging(false); }
  }

  return <section className="detail-section status-actions" aria-labelledby="status-actions-title"><h2 id="status-actions-title">Gestionar estado</h2>
    {transitions.length === 0 ? <p>La empresa está archivada y no puede reactivarse.</p> : <div className="status-action-buttons">{transitions.map((status) => <button className="button button-secondary" type="button" key={status} disabled={changing} onClick={() => choose(status)}>{actionLabel(organization.status, status)}</button>)}</div>}
    {target ? <div className="status-confirmation" role="dialog" aria-labelledby="status-confirmation-title"><h3 id="status-confirmation-title">{actionLabel(organization.status, target)}</h3>
      {target === "archived" ? <p className="archive-warning"><strong>Esta acción es irreversible.</strong> La empresa no podrá reactivarse y sus datos se conservarán.</p> : null}
      <label className="form-field"><span>Motivo{reasonRequired ? " *" : " (opcional)"}</span><textarea rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      {target === "archived" ? <label className="form-field"><span>Escribe “{expectedConfirmation}” para confirmar</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label> : null}
      <div className="form-actions"><button className="button button-secondary" type="button" disabled={changing} onClick={() => setTarget(null)}>Cancelar</button><button className="button" type="button" disabled={changing || (reasonRequired && !reason.trim()) || !archiveConfirmed} onClick={() => void confirm()}>{changing ? "Cambiando estado…" : "Confirmar cambio"}</button></div>
    </div> : null}
    {error ? <p className="form-server-error" role="alert">{error}</p> : null}{success ? <p className="success-banner" role="status">{success}</p> : null}
  </section>;
}

function actionLabel(current: OrganizationStatus, target: OrganizationStatus): string {
  if (target === "active") return current === "pending" ? "Activar" : "Reactivar";
  if (target === "maintenance") return "Poner en mantenimiento";
  if (target === "blocked") return "Bloquear";
  if (target === "suspended") return "Suspender";
  if (target === "archived") return "Archivar";
  return target;
}
