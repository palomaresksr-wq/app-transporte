import type { ManageOrganizationSubscriptionErrors, ManageOrganizationSubscriptionInput, ManageOrganizationSubscriptionResult, OrganizationDetailSubscription, PaymentStatus, PlanCode, SubscriptionStatus } from "@albatrans/contracts";
import { normalizeOrganizationSubscription, subscriptionDaysRemaining, subscriptionReasonRequired, validateOrganizationSubscription } from "@albatrans/domain";
import { useEffect, useState, type FormEvent } from "react";
import { manageOrganizationSubscription } from "../../data/organization-command-repository";

type Manager = (organizationId: string, input: ManageOrganizationSubscriptionInput) => Promise<ManageOrganizationSubscriptionResult>;
const planOptions: readonly { code: PlanCode; label: string }[] = [{ code: "starter", label: "Starter" }, { code: "professional", label: "Profesional" }, { code: "enterprise", label: "Enterprise" }, { code: "custom", label: "Personalizado" }];
const subscriptionStatuses: readonly SubscriptionStatus[] = ["trial", "active", "past_due", "suspended", "cancelled", "expired"];
const paymentStatuses: readonly PaymentStatus[] = ["not_required", "pending", "paid", "overdue", "failed"];

export function OrganizationSubscriptionManager({ organizationId, subscription, manager = manageOrganizationSubscription, onChanged }: { organizationId: string; subscription: OrganizationDetailSubscription | null; manager?: Manager; onChanged: () => Promise<void> }) {
  const [form, setForm] = useState(() => initial(subscription));
  const [errors, setErrors] = useState<ManageOrganizationSubscriptionErrors>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [planConfirmed, setPlanConfirmed] = useState(false);
  useEffect(() => { setForm(initial(subscription)); setPlanConfirmed(false); }, [subscription]);
  const planChanged = Boolean(subscription && form.planCode !== subscription.planCode);
  const reasonRequired = subscriptionReasonRequired(form);
  function update<K extends keyof ManageOrganizationSubscriptionInput>(field: K, value: ManageOrganizationSubscriptionInput[K]) { setForm((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: undefined })); setServerError(null); setSuccess(null); if (field === "planCode") setPlanConfirmed(false); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const normalized = normalizeOrganizationSubscription(form); const validation = validateOrganizationSubscription(normalized);
    if (!validation.valid) { setErrors(validation.errors); return; }
    if (planChanged && !planConfirmed) { setServerError("Confirma expresamente el cambio de plan."); return; }
    setSaving(true); setServerError(null); setSuccess(null);
    try { const result = await manager(organizationId, normalized); await onChanged(); setSuccess(result.created ? "Suscripción creada correctamente." : "Suscripción actualizada correctamente."); }
    catch (caught) { setServerError(caught instanceof Error ? caught.message : "No se pudo guardar la suscripción."); }
    finally { setSaving(false); }
  }
  return <section className="detail-section subscription-manager" aria-labelledby="subscription-manager-title"><h2 id="subscription-manager-title">Gestión comercial</h2>
    <SubscriptionNotices subscription={subscription} />
    <form className="organization-form" onSubmit={submit} noValidate><fieldset disabled={saving}><legend>Plan y estados</legend><div className="form-grid form-grid-three">
      <label className="form-field"><span>Plan actual *</span><select value={form.planCode} onChange={(event) => update("planCode", planCode(event.target.value))}>{planOptions.map((plan) => <option key={plan.code} value={plan.code}>{plan.label}</option>)}</select></label>
      <label className="form-field"><span>Estado de suscripción *</span><select value={form.status} onChange={(event) => update("status", subscriptionStatus(event.target.value))}>{subscriptionStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
      <label className="form-field"><span>Estado de pago *</span><select value={form.paymentStatus} onChange={(event) => update("paymentStatus", paymentStatus(event.target.value))}>{paymentStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
    </div></fieldset>
    <fieldset disabled={saving}><legend>Fechas y vencimiento</legend><div className="form-grid form-grid-three"><DateField label="Fecha de inicio" value={form.startsAt} error={errors.startsAt} required onChange={(value) => update("startsAt", value)} /><DateField label="Inicio del periodo actual" value={form.currentPeriodStartsAt} error={errors.currentPeriodStartsAt} onChange={(value) => update("currentPeriodStartsAt", value)} /><DateField label="Fin del periodo actual" value={form.currentPeriodEndsAt} error={errors.currentPeriodEndsAt} onChange={(value) => update("currentPeriodEndsAt", value)} /><DateField label="Pagada hasta" value={form.paidThrough} error={errors.paidThrough} onChange={(value) => update("paidThrough", value)} /><DateField label="Fin del periodo de gracia" value={form.gracePeriodEndsAt} error={errors.gracePeriodEndsAt} onChange={(value) => update("gracePeriodEndsAt", value)} /></div><label className="checkbox-field"><input type="checkbox" checked={form.cancelAtPeriodEnd} onChange={(event) => update("cancelAtPeriodEnd", event.target.checked)} /> Cancelar al final del periodo sin borrar datos</label></fieldset>
    <fieldset disabled={saving}><legend>Información interna</legend><label className="form-field"><span>Notas internas de suscripción</span><textarea rows={3} value={form.notes} onChange={(event) => update("notes", event.target.value)} />{errors.notes ? <small className="field-error">{errors.notes}</small> : null}</label><label className="form-field"><span>Motivo{reasonRequired ? " *" : " (opcional)"}</span><textarea rows={2} value={form.reason} onChange={(event) => update("reason", event.target.value)} />{errors.reason ? <small className="field-error">{errors.reason}</small> : null}</label></fieldset>
    {planChanged ? <label className="plan-confirmation"><input type="checkbox" checked={planConfirmed} onChange={(event) => setPlanConfirmed(event.target.checked)} /> Confirmo el cambio de {subscription?.planName} a {planOptions.find((plan) => plan.code === form.planCode)?.label} y que los overrides existentes se conservarán.</label> : null}
    {serverError ? <p className="form-server-error" role="alert">{serverError}</p> : null}{success ? <p className="success-banner" role="status">{success}</p> : null}<div className="form-actions"><button className="button" type="submit" disabled={saving}>{saving ? "Guardando suscripción…" : subscription ? "Guardar suscripción" : "Crear suscripción"}</button></div></form>
  </section>;
}

function SubscriptionNotices({ subscription }: { subscription: OrganizationDetailSubscription | null }) {
  if (!subscription) return <p className="commercial-notice">La empresa todavía no tiene suscripción.</p>;
  const days = subscriptionDaysRemaining(subscription.periodEndsAt); const now = Date.now(); const grace = subscription.gracePeriodEndsAt ? new Date(subscription.gracePeriodEndsAt).getTime() : null; const end = subscription.periodEndsAt ? new Date(subscription.periodEndsAt).getTime() : null;
  return <div className="commercial-summary"><p><strong>{subscription.planName}</strong> · {subscription.paymentStatus} · {days === null ? "Sin vencimiento" : days >= 0 ? `${days} días restantes` : `Vencida hace ${Math.abs(days)} días`}</p>{subscription.paymentStatus === "pending" ? <p className="commercial-notice warning">Pago pendiente.</p> : null}{subscription.paymentStatus === "overdue" || subscription.paymentStatus === "failed" ? <p className="commercial-notice danger">Pago vencido o fallido.</p> : null}{end !== null && grace !== null && now > end && now <= grace ? <p className="commercial-notice warning">La suscripción está dentro del periodo de gracia.</p> : null}{subscription.status === "cancelled" || subscription.status === "expired" ? <p className="commercial-notice danger">Suscripción {subscription.status}.</p> : null}</div>;
}
function DateField({ label, value, error, required, onChange }: { label: string; value: string; error?: string; required?: boolean; onChange: (value: string) => void }) { return <label className="form-field"><span>{label}{required ? " *" : ""}</span><input type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} />{error ? <small className="field-error">{error}</small> : null}</label>; }
function initial(subscription: OrganizationDetailSubscription | null): ManageOrganizationSubscriptionInput { return subscription ? { planCode: subscription.planCode, status: subscription.status, paymentStatus: subscription.paymentStatus, startsAt: localDate(subscription.startsAt), currentPeriodStartsAt: localDate(subscription.periodStartsAt), currentPeriodEndsAt: localDate(subscription.periodEndsAt), paidThrough: localDate(subscription.paidThrough), gracePeriodEndsAt: localDate(subscription.gracePeriodEndsAt), cancelAtPeriodEnd: subscription.cancelAtPeriodEnd, notes: subscription.notes ?? "", reason: "" } : { planCode: "starter", status: "trial", paymentStatus: "pending", startsAt: localDate(new Date().toISOString()), currentPeriodStartsAt: "", currentPeriodEndsAt: "", paidThrough: "", gracePeriodEndsAt: "", cancelAtPeriodEnd: false, notes: "", reason: "" }; }
function localDate(value: string | null): string { if (!value) return ""; const date = new Date(value); const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
function planCode(value: string): PlanCode { switch (value) { case "professional": case "enterprise": case "custom": return value; default: return "starter"; } }
function subscriptionStatus(value: string): SubscriptionStatus { switch (value) { case "active": case "past_due": case "suspended": case "cancelled": case "expired": return value; default: return "trial"; } }
function paymentStatus(value: string): PaymentStatus { switch (value) { case "pending": case "paid": case "overdue": case "failed": return value; default: return "not_required"; } }
