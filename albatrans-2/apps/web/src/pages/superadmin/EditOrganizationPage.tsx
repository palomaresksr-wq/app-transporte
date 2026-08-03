import type { UpdateOrganizationErrors, UpdateOrganizationInput } from "@albatrans/contracts";
import { normalizeUpdateOrganization, validateUpdateOrganization } from "@albatrans/domain";
import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { loadOrganizationForEdit, OrganizationCommandError, updateOrganization } from "../../data/organization-command-repository";

type Loader = (organizationId: string) => Promise<UpdateOrganizationInput | null>;
type Saver = (organizationId: string, input: UpdateOrganizationInput) => Promise<{ organizationId: string }>;

export function EditOrganizationPage({ loader = loadOrganizationForEdit, saver = updateOrganization }: { loader?: Loader; saver?: Saver }) {
  const { organizationId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<UpdateOrganizationInput | null>(null);
  const [errors, setErrors] = useState<UpdateOrganizationErrors>({});
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [taxConflict, setTaxConflict] = useState(false);

  useEffect(() => {
    let active = true;
    if (!organizationId) { setMissing(true); setLoading(false); return; }
    setLoading(true); setServerError(null);
    void loader(organizationId).then((value) => { if (active) { setForm(value); setMissing(!value); } }).catch((caught) => { if (active) setServerError(caught instanceof Error ? caught.message : "No se pudo cargar la empresa."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loader, organizationId]);

  function update<K extends keyof UpdateOrganizationInput>(field: K, value: UpdateOrganizationInput[K]) {
    setForm((current) => current ? { ...current, [field]: value } : current);
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (field === "taxId") setTaxConflict(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !organizationId) return;
    const normalized = normalizeUpdateOrganization(form);
    const validation = validateUpdateOrganization(normalized);
    if (!validation.valid) { setErrors(validation.errors); return; }
    setSubmitting(true); setServerError(null); setTaxConflict(false);
    try { await saver(organizationId, normalized); navigate(`/platform/organizations/${organizationId}?updated=1`, { replace: true }); }
    catch (caught) { if (caught instanceof OrganizationCommandError && caught.code === "tax_id_conflict") setTaxConflict(true); setServerError(caught instanceof Error ? caught.message : "No se pudo actualizar la empresa."); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div className="list-state" aria-busy="true">Cargando datos de la empresa…</div>;
  if (missing || (!form && !serverError)) return <div className="list-state"><h1>Empresa no encontrada</h1><Link className="button" to="/platform/organizations">Volver al listado</Link></div>;
  if (!form) return <div className="list-state list-error" role="alert"><h1>No se pudo cargar la empresa</h1><p>{serverError}</p></div>;
  const cancelTo = `/platform/organizations/${organizationId}`;
  return <section aria-labelledby="edit-company-title"><div className="page-heading form-heading"><div><p className="eyebrow">Empresas</p><h1 id="edit-company-title">Editar empresa</h1><p>Actualiza exclusivamente sus datos generales.</p></div><Link className="button button-secondary" to={cancelTo}>Cancelar</Link></div>
    <form className="organization-form" onSubmit={submit} noValidate>
      <fieldset disabled={submitting}><legend>Identificación</legend><div className="form-grid"><Field label="Razón social" error={errors.legalName} required><input value={form.legalName} onChange={(event) => update("legalName", event.target.value)} /></Field><Field label="Nombre comercial" error={errors.tradeName} required><input value={form.tradeName} onChange={(event) => update("tradeName", event.target.value)} /></Field><Field label="NIF / CIF" error={errors.taxId ?? (taxConflict ? "Ya existe una empresa con ese NIF/CIF en el país indicado." : undefined)} required><input value={form.taxId} onChange={(event) => update("taxId", event.target.value)} /></Field></div></fieldset>
      <fieldset disabled={submitting}><legend>Contacto</legend><div className="form-grid"><Field label="Correo electrónico" error={errors.email}><input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></Field><Field label="Teléfono" error={errors.phone}><input type="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} /></Field></div></fieldset>
      <fieldset disabled={submitting}><legend>Configuración regional</legend><div className="form-grid form-grid-three"><Field label="País" error={errors.countryCode} required><input maxLength={2} value={form.countryCode} onChange={(event) => update("countryCode", event.target.value)} /></Field><Field label="Zona horaria" error={errors.timezone} required><input value={form.timezone} onChange={(event) => update("timezone", event.target.value)} /></Field><Field label="Moneda" error={errors.currencyCode} required><input maxLength={3} value={form.currencyCode} onChange={(event) => update("currencyCode", event.target.value)} /></Field></div></fieldset>
      <fieldset disabled={submitting}><legend>Información interna</legend><Field label="Notas internas" error={errors.internalNotes} hint="Solo visibles para superadministración."><textarea rows={5} value={form.internalNotes} onChange={(event) => update("internalNotes", event.target.value)} /></Field></fieldset>
      {serverError ? <p className="form-server-error" role="alert">{serverError}</p> : null}<div className="form-actions"><Link className="button button-secondary" to={cancelTo}>Cancelar</Link><button className="button" type="submit" disabled={submitting}>{submitting ? "Guardando cambios…" : "Guardar cambios"}</button></div>
    </form>
  </section>;
}

function Field({ label, error, hint, required, children }: { label: string; error?: string; hint?: string; required?: boolean; children: ReactElement }) { return <label className="form-field"><span>{label}{required ? " *" : ""}</span>{children}{error ? <small className="field-error">{error}</small> : hint ? <small>{hint}</small> : null}</label>; }
