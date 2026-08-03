import type { OrganizationListFilters, OrganizationListPage } from "@albatrans/contracts";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadOrganizations } from "../../data/organization-list-repository";

const INITIAL: OrganizationListFilters = { search: "", status: "all", plan: "all", paymentStatus: "all", page: 1, pageSize: 10 };

export function OrganizationsPage({ loader = loadOrganizations }: { loader?: (filters: OrganizationListFilters) => Promise<OrganizationListPage> }) {
  const [draft, setDraft] = useState(INITIAL);
  const [filters, setFilters] = useState(INITIAL);
  const [result, setResult] = useState<OrganizationListPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => { setLoading(true); setError(null); try { setResult(await loader(filters)); } catch (caught) { setResult(null); setError(caught instanceof Error ? caught.message : "No se pudieron cargar las empresas."); } finally { setLoading(false); } }, [filters, loader]);
  useEffect(() => { void refresh(); }, [refresh]);
  const filtered = Boolean(filters.search || filters.status !== "all" || filters.plan !== "all" || filters.paymentStatus !== "all");
  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  return <section aria-labelledby="organizations-title">
    <div className="page-heading"><div><p className="eyebrow">Superadmin</p><h1 id="organizations-title">Empresas</h1><p>Consulta organizaciones, planes y usuarios activos.</p></div><Link className="button" to="/platform/empresas/nueva">Nueva empresa</Link></div>
    <form className="list-filters" onSubmit={(event) => { event.preventDefault(); setFilters({ ...draft, page: 1 }); }}>
      <label><span>Buscar</span><input value={draft.search} onChange={(event) => setDraft({ ...draft, search: event.target.value })} placeholder="Nombre, razón social o NIF/CIF" /></label>
      <Filter label="Estado" value={draft.status} options={["all","pending","active","maintenance","blocked","suspended","archived"]} onChange={(value) => setDraft({ ...draft, status: statusValue(value) })} />
      <Filter label="Plan" value={draft.plan} options={["all","starter","professional","enterprise","custom"]} onChange={(value) => setDraft({ ...draft, plan: planValue(value) })} />
      <Filter label="Pago" value={draft.paymentStatus} options={["all","not_required","pending","paid","overdue","failed"]} onChange={(value) => setDraft({ ...draft, paymentStatus: paymentValue(value) })} />
      <button className="button" type="submit">Aplicar filtros</button>
    </form>
    {loading ? <div className="list-state" aria-busy="true">Cargando empresas…</div> : null}
    {!loading && error ? <div className="list-state list-error" role="alert"><p>{error}</p><button className="button" onClick={refresh}>Reintentar</button></div> : null}
    {!loading && result?.items.length === 0 ? <div className="list-state"><h2>{filtered ? "No hay resultados" : "Todavía no hay empresas"}</h2><p>{filtered ? "Prueba a cambiar los filtros." : "Crea la primera empresa para comenzar."}</p></div> : null}
    {!loading && result && result.items.length > 0 ? <><div className="organizations-table-wrap"><table className="organizations-table"><thead><tr><th>Empresa</th><th>NIF/CIF</th><th>Estado</th><th>Plan</th><th>Pago</th><th>Admins</th><th>Conductores</th><th>Alta</th><th>Actualización</th><th>Acciones</th></tr></thead><tbody>{result.items.map((item) => <tr key={item.id}><td data-label="Empresa"><strong>{item.tradeName ?? item.legalName}</strong><small>{item.tradeName ? item.legalName : "—"}</small></td><td data-label="NIF/CIF">{item.taxId ?? "—"}</td><td data-label="Estado"><span className={`status-badge status-${item.status}`}>{item.status}</span></td><td data-label="Plan">{item.planName ?? "Sin plan"}</td><td data-label="Pago">{item.paymentStatus ?? "—"}</td><td data-label="Admins">{item.activeAdminCount}</td><td data-label="Conductores">{item.activeDriverCount}</td><td data-label="Alta">{date(item.createdAt)}</td><td data-label="Actualización">{date(item.updatedAt)}</td><td data-label="Acciones"><div className="row-actions"><Link to={`/platform/organizations/${item.id}`}>Ver detalle</Link><Link to={`/platform/organizations/${item.id}/edit`}>Editar</Link></div></td></tr>)}</tbody></table></div><div className="pagination"><span>{result.total} empresas · Página {result.page} de {pages}</span><div><button className="button button-secondary" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Anterior</button><button className="button button-secondary" disabled={filters.page >= pages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Siguiente</button></div></div></> : null}
  </section>;
}

function Filter({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) { return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option value={option} key={option}>{option === "all" ? "Todos" : option}</option>)}</select></label>; }
function statusValue(value: string): OrganizationListFilters["status"] { switch (value) { case "pending": case "active": case "maintenance": case "blocked": case "suspended": case "archived": return value; default: return "all"; } }
function planValue(value: string): OrganizationListFilters["plan"] { switch (value) { case "starter": case "professional": case "enterprise": case "custom": return value; default: return "all"; } }
function paymentValue(value: string): OrganizationListFilters["paymentStatus"] { switch (value) { case "not_required": case "pending": case "paid": case "overdue": case "failed": return value; default: return "all"; } }
function date(value: string) { return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value)); }
