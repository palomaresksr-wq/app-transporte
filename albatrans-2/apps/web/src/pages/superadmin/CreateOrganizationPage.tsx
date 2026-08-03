import type { CreateOrganizationErrors, CreateOrganizationInput } from "@albatrans/contracts";
import { normalizeCreateOrganization, validateCreateOrganization } from "@albatrans/domain";
import { useState, type FormEvent, type ReactElement } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createOrganization } from "../../data/organization-command-repository";

const INITIAL: CreateOrganizationInput = { legalName: "", tradeName: "", taxId: "", email: "", phone: "", countryCode: "ES", timezone: "Europe/Madrid", currencyCode: "EUR", status: "pending", internalNotes: "" };

export function CreateOrganizationPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState<CreateOrganizationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  function update<K extends keyof CreateOrganizationInput>(field: K, value: CreateOrganizationInput[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeCreateOrganization(form);
    const validation = validateCreateOrganization(normalized);
    if (!validation.valid) { setErrors(validation.errors); return; }
    setSubmitting(true); setServerError(null);
    try { await createOrganization(normalized); navigate("/platform?organizationCreated=1", { replace: true }); }
    catch (caught) { setServerError(caught instanceof Error ? caught.message : "No se pudo crear la empresa."); }
    finally { setSubmitting(false); }
  }
  return (
    <section aria-labelledby="new-company-title">
      <div className="page-heading form-heading"><div><p className="eyebrow">Empresas</p><h1 id="new-company-title">Nueva empresa</h1><p>Crea el tenant y define sus datos básicos de operación.</p></div><Link className="button button-secondary" to="/platform">Cancelar</Link></div>
      <form className="organization-form" onSubmit={submit} noValidate>
        <fieldset disabled={submitting}><legend>Identificación</legend><div className="form-grid">
          <Field label="Razón social" error={errors.legalName} required><input value={form.legalName} onChange={(e) => update("legalName", e.target.value)} /></Field>
          <Field label="Nombre comercial" error={errors.tradeName}><input value={form.tradeName} onChange={(e) => update("tradeName", e.target.value)} /></Field>
          <Field label="NIF / CIF" error={errors.taxId}><input value={form.taxId} onChange={(e) => update("taxId", e.target.value)} /></Field>
          <Field label="Estado inicial" error={errors.status} required><select value={form.status} onChange={(e) => update("status", e.target.value === "active" ? "active" : "pending")}><option value="pending">Pendiente</option><option value="active">Activa</option></select></Field>
        </div></fieldset>
        <fieldset disabled={submitting}><legend>Contacto</legend><div className="form-grid">
          <Field label="Correo electrónico" error={errors.email}><input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></Field>
          <Field label="Teléfono" error={errors.phone}><input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} /></Field>
        </div></fieldset>
        <fieldset disabled={submitting}><legend>Configuración regional</legend><div className="form-grid form-grid-three">
          <Field label="País" error={errors.countryCode} required><input maxLength={2} value={form.countryCode} onChange={(e) => update("countryCode", e.target.value)} /></Field>
          <Field label="Zona horaria" error={errors.timezone} required><input value={form.timezone} onChange={(e) => update("timezone", e.target.value)} /></Field>
          <Field label="Moneda" error={errors.currencyCode} required><input maxLength={3} value={form.currencyCode} onChange={(e) => update("currencyCode", e.target.value)} /></Field>
        </div></fieldset>
        <fieldset disabled={submitting}><legend>Información interna</legend><Field label="Notas internas" error={errors.internalNotes} hint="Solo visibles para superadministración."><textarea rows={5} value={form.internalNotes} onChange={(e) => update("internalNotes", e.target.value)} /></Field></fieldset>
        {serverError ? <p className="form-server-error" role="alert">{serverError}</p> : null}
        <div className="form-actions"><Link className="button button-secondary" to="/platform">Cancelar</Link><button className="button" type="submit" disabled={submitting}>{submitting ? "Creando empresa…" : "Crear empresa"}</button></div>
      </form>
    </section>
  );
}

function Field({ label, error, hint, required, children }: { label: string; error?: string; hint?: string; required?: boolean; children: ReactElement }) {
  return <label className="form-field"><span>{label}{required ? " *" : ""}</span>{children}{error ? <small className="field-error">{error}</small> : hint ? <small>{hint}</small> : null}</label>;
}
