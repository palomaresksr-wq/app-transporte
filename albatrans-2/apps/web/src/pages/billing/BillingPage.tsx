import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  approveBillingPreinvoice,
  cancelBillingPreinvoice,
  createBillingPreinvoice,
  createBillingRate,
  createSupplementDefinition,
  deactivateBillingRate,
  loadBillingPreinvoiceLines,
  loadBillingPreinvoices,
  loadBillingRates,
  loadBillingSupplementDefinitions,
  loadPrefacturableOrders,
  summarizeRateComponents,
  type BillingPreinvoiceLineRow,
  type BillingRateView,
  type BillingSupplementDefinitionRow,
  type PrefacturableOrderRow,
} from "../../data/billing-repository";
import { loadTransportOptions, type TransportOption } from "../../data/transport-repository";

export function BillingPage({ organizationId, platform }: { organizationId: string; platform: boolean }) {
  const [clients, setClients] = useState<TransportOption[]>([]);
  const [clientFilter, setClientFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showHistorical, setShowHistorical] = useState(false);
  const [rates, setRates] = useState<BillingRateView[]>([]);
  const [supplements, setSupplements] = useState<BillingSupplementDefinitionRow[]>([]);
  const [preinvoices, setPreinvoices] = useState<Array<Awaited<ReturnType<typeof loadBillingPreinvoices>>[number]>>([]);
  const [prefacturableOrders, setPrefacturableOrders] = useState<PrefacturableOrderRow[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedPreinvoiceId, setSelectedPreinvoiceId] = useState("");
  const [selectedPreinvoiceLines, setSelectedPreinvoiceLines] = useState<BillingPreinvoiceLineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [creatingRate, setCreatingRate] = useState(false);
  const [creatingSupplement, setCreatingSupplement] = useState(false);
  const [creatingPreinvoice, setCreatingPreinvoice] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [clientRows, rateRows, supplementRows, preinvoiceRows, prefacturableRows] = await Promise.all([
        loadTransportOptions(organizationId, "clients"),
        loadBillingRates({ organizationId, clientId: clientFilter, includeHistorical: showHistorical, search }),
        loadBillingSupplementDefinitions(organizationId),
        loadBillingPreinvoices({ organizationId, clientId: clientFilter }),
        loadPrefacturableOrders({ organizationId, clientId: clientFilter }),
      ]);
      setClients(clientRows);
      setRates(rateRows);
      setSupplements(supplementRows);
      setPreinvoices(preinvoiceRows);
      setPrefacturableOrders(prefacturableRows);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los datos de facturación.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, clientFilter, showHistorical, search]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedPreinvoiceId) {
      setSelectedPreinvoiceLines([]);
      return;
    }
    void loadBillingPreinvoiceLines(organizationId, selectedPreinvoiceId)
      .then(setSelectedPreinvoiceLines)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "No se pudieron cargar las líneas de la prefactura."));
  }, [organizationId, selectedPreinvoiceId]);

  const selectedPreinvoice = preinvoices.find((preinvoice) => preinvoice.id === selectedPreinvoiceId) ?? null;
  const selectedPrefacturableOrders = useMemo(
    () => prefacturableOrders.filter((row) => selectedOrders.includes(row.orderId)),
    [prefacturableOrders, selectedOrders],
  );

  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Facturación</span>
          <h1>{platform ? "Prefacturación de empresa" : "Tarifas y prefacturas"}</h1>
        </div>
      </div>

      <div className="panel filters-row">
        <label>
          Buscar tarifa<input value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label>
          Cliente<select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
            <option value="all">Todos</option>
            {clients.map((client) => (
              <option key={client.value} value={client.value}>{client.label}</option>
            ))}
          </select>
        </label>
        <label className="checkbox-field">
          <input type="checkbox" checked={showHistorical} onChange={(event) => setShowHistorical(event.target.checked)} /> Históricas
        </label>
      </div>

      {error && <p role="alert" className="error-banner">{error}</p>}
      {success && <p role="status" className="success-banner">{success}</p>}

      <section className="detail-section">
        <div className="section-heading">
          <h2>Tarifas</h2>
          <button className="button" onClick={() => setCreatingRate((value) => !value)}>{creatingRate ? "Cerrar formulario" : "Nueva tarifa"}</button>
        </div>
        {creatingRate && (
          <RateForm
            clients={clients}
            save={async (payload) => {
              await createBillingRate({ organizationId, ...payload });
              setSuccess("Tarifa creada.");
              setCreatingRate(false);
              await refresh();
            }}
          />
        )}
        {loading ? <p aria-busy="true">Cargando tarifas…</p> : rates.length === 0 ? <p>Sin tarifas registradas.</p> : (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Tarifa</th>
                  <th>Modelo</th>
                  <th>Vigencia</th>
                  <th>Estado</th>
                  <th>Versión</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((rate) => (
                  <tr key={rate.id}>
                    <td>{rate.clientName}</td>
                    <td>{rate.name}</td>
                    <td>{summarizeRateComponents(rate.components_json)}</td>
                    <td>{rate.valid_from}{rate.valid_until ? ` → ${rate.valid_until}` : " · abierta"}</td>
                    <td>{rate.status}</td>
                    <td>{rate.version_number}</td>
                    <td>
                      <button
                        className="button button-secondary"
                        onClick={async () => {
                          await deactivateBillingRate({ organizationId, rateId: rate.id, reason: "Desactivación administrativa" });
                          setSuccess("Tarifa desactivada.");
                          await refresh();
                        }}
                      >Desactivar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="detail-section">
        <div className="section-heading">
          <h2>Suplementos configurables</h2>
          <button className="button button-secondary" onClick={() => setCreatingSupplement((value) => !value)}>{creatingSupplement ? "Cerrar formulario" : "Nuevo suplemento"}</button>
        </div>
        {creatingSupplement && (
          <SupplementDefinitionForm
            save={async (payload) => {
              await createSupplementDefinition({ organizationId, ...payload });
              setSuccess("Suplemento creado.");
              setCreatingSupplement(false);
              await refresh();
            }}
          />
        )}
        {supplements.length === 0 ? <p>Sin suplementos configurados.</p> : (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Modo</th>
                  <th>Importe</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {supplements.map((supplement) => (
                  <tr key={supplement.id}>
                    <td>{supplement.code}</td>
                    <td>{supplement.name}</td>
                    <td>{supplement.charge_mode}</td>
                    <td>{supplement.amount}</td>
                    <td>{supplement.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="detail-section">
        <div className="section-heading">
          <h2>Prefacturas</h2>
          <button className="button" onClick={() => setCreatingPreinvoice((value) => !value)}>{creatingPreinvoice ? "Cerrar creación" : "Crear prefactura"}</button>
        </div>
        {creatingPreinvoice && (
          <PreinvoiceForm
            clients={clients}
            clientFilter={clientFilter}
            selectedOrders={selectedPrefacturableOrders}
            prefacturableOrders={prefacturableOrders}
            toggleOrder={(orderId) => setSelectedOrders((current) => current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId])}
            create={async (payload) => {
              await createBillingPreinvoice({ organizationId, orderIds: selectedOrders, ...payload });
              setSelectedOrders([]);
              setCreatingPreinvoice(false);
              setSuccess("Prefactura creada.");
              await refresh();
            }}
          />
        )}

        {preinvoices.length === 0 ? <p>Sin prefacturas creadas.</p> : (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Referencia</th>
                  <th>Cliente</th>
                  <th>Periodo</th>
                  <th>Servicios</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {preinvoices.map((preinvoice) => (
                  <tr key={preinvoice.id}>
                    <td><button className="link-button" onClick={() => setSelectedPreinvoiceId(preinvoice.id)}>{preinvoice.reference}</button></td>
                    <td>{preinvoice.clientName}</td>
                    <td>{preinvoice.period_start} → {preinvoice.period_end}</td>
                    <td>{preinvoice.lineCount}</td>
                    <td>{preinvoice.total_amount.toFixed(2)} €</td>
                    <td>{preinvoice.status}</td>
                    <td>
                      {(preinvoice.status === "draft" || preinvoice.status === "review") && (
                        <button className="button button-secondary" onClick={async () => {
                          await approveBillingPreinvoice({ organizationId, preinvoiceId: preinvoice.id });
                          setSuccess("Prefactura aprobada.");
                          await refresh();
                        }}>Aprobar</button>
                      )}
                      {preinvoice.status !== "cancelled" && preinvoice.status !== "converted" && (
                        <button className="button button-secondary" onClick={async () => {
                          await cancelBillingPreinvoice({ organizationId, preinvoiceId: preinvoice.id, reason: "Cancelación administrativa" });
                          setSuccess("Prefactura cancelada.");
                          await refresh();
                        }}>Cancelar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedPreinvoice && (
          <div className="panel">
            <h3>{selectedPreinvoice.reference}</h3>
            <p>{selectedPreinvoice.clientName} · {selectedPreinvoice.period_start} → {selectedPreinvoice.period_end}</p>
            {selectedPreinvoiceLines.length === 0 ? <p>Sin líneas.</p> : (
              <ul>
                {selectedPreinvoiceLines.map((line) => (
                  <li key={line.id}>{line.description} · {line.line_amount.toFixed(2)} € · {line.removed_at ? `retirada (${line.remove_reason})` : "activa"}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </section>
  );
}

function RateForm({ clients, save }: { clients: TransportOption[]; save: (payload: Record<string, unknown>) => Promise<void> }) {
  const [values, setValues] = useState({ clientId: "", name: "", validFrom: new Date().toISOString().slice(0, 10), validUntil: "", serviceType: "General", currencyCode: "EUR", base: "", distance_km: "", delivery_stop: "", package: "", weight_kg: "", volume_m3: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      if (!values.clientId) throw new Error("Selecciona un cliente.");
      const rawComponents: Array<[string, string]> = [
        ["base", values.base],
        ["distance_km", values.distance_km],
        ["delivery_stop", values.delivery_stop],
        ["package", values.package],
        ["weight_kg", values.weight_kg],
        ["volume_m3", values.volume_m3],
      ];
      const components = rawComponents
        .filter(([, amount]) => amount.trim())
        .map(([componentKind, amount]) => ({ componentKind, amount }));
      if (components.length === 0) throw new Error("Define al menos un componente de tarifa.");
      await save({
        clientId: values.clientId,
        name: values.name,
        validFrom: values.validFrom,
        validUntil: values.validUntil || null,
        serviceType: values.serviceType || null,
        currencyCode: values.currencyCode,
        status: "active",
        components,
        supplementRules: [],
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear la tarifa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel master-data-form" onSubmit={submit}>
      <h3>Nueva tarifa</h3>
      {error && <p role="alert" className="error-banner">{error}</p>}
      <div className="form-grid">
        <label>
          Cliente<select value={values.clientId} onChange={(event) => setValues((current) => ({ ...current, clientId: event.target.value }))}>
            <option value="">Seleccionar</option>
            {clients.map((client) => <option key={client.value} value={client.value}>{client.label}</option>)}
          </select>
        </label>
        <label>
          Nombre<input value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} required />
        </label>
        <label>
          Servicio<input value={values.serviceType} onChange={(event) => setValues((current) => ({ ...current, serviceType: event.target.value }))} />
        </label>
        <label>
          Vigente desde<input type="date" value={values.validFrom} onChange={(event) => setValues((current) => ({ ...current, validFrom: event.target.value }))} required />
        </label>
        <label>
          Vigente hasta<input type="date" value={values.validUntil} onChange={(event) => setValues((current) => ({ ...current, validUntil: event.target.value }))} />
        </label>
        <label>
          Moneda<input value={values.currencyCode} maxLength={3} onChange={(event) => setValues((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))} required />
        </label>
        <label>Base €<input type="number" step="any" value={values.base} onChange={(event) => setValues((current) => ({ ...current, base: event.target.value }))} /></label>
        <label>€/km<input type="number" step="any" value={values.distance_km} onChange={(event) => setValues((current) => ({ ...current, distance_km: event.target.value }))} /></label>
        <label>€/parada<input type="number" step="any" value={values.delivery_stop} onChange={(event) => setValues((current) => ({ ...current, delivery_stop: event.target.value }))} /></label>
        <label>€/bulto<input type="number" step="any" value={values.package} onChange={(event) => setValues((current) => ({ ...current, package: event.target.value }))} /></label>
        <label>€/kg<input type="number" step="any" value={values.weight_kg} onChange={(event) => setValues((current) => ({ ...current, weight_kg: event.target.value }))} /></label>
        <label>€/m3<input type="number" step="any" value={values.volume_m3} onChange={(event) => setValues((current) => ({ ...current, volume_m3: event.target.value }))} /></label>
      </div>
      <div className="form-actions"><button className="button" disabled={saving}>{saving ? "Guardando…" : "Crear tarifa"}</button></div>
    </form>
  );
}

function SupplementDefinitionForm({ save }: { save: (payload: Record<string, unknown>) => Promise<void> }) {
  const [values, setValues] = useState({ code: "", name: "", chargeMode: "fixed", amount: "", unitCode: "", percentageBase: "subtotal_before_percentage" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      await save({
        code: values.code,
        name: values.name,
        chargeMode: values.chargeMode,
        amount: values.amount,
        unitCode: values.unitCode || null,
        percentageBase: values.chargeMode === "percent" ? values.percentageBase : null,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear el suplemento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel master-data-form" onSubmit={submit}>
      <h3>Nuevo suplemento</h3>
      {error && <p role="alert" className="error-banner">{error}</p>}
      <div className="form-grid">
        <label>Código<input value={values.code} onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))} required /></label>
        <label>Nombre<input value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} required /></label>
        <label>
          Modo<select value={values.chargeMode} onChange={(event) => setValues((current) => ({ ...current, chargeMode: event.target.value }))}>
            <option value="fixed">Fijo</option>
            <option value="percent">Porcentaje</option>
            <option value="per_unit">Por unidad</option>
          </select>
        </label>
        <label>Importe<input type="number" step="any" value={values.amount} onChange={(event) => setValues((current) => ({ ...current, amount: event.target.value }))} required /></label>
        <label>Unidad<input value={values.unitCode} onChange={(event) => setValues((current) => ({ ...current, unitCode: event.target.value }))} /></label>
        {values.chargeMode === "percent" && (
          <label>
            Base<select value={values.percentageBase} onChange={(event) => setValues((current) => ({ ...current, percentageBase: event.target.value }))}>
              <option value="subtotal_before_percentage">Subtotal antes de porcentajes</option>
              <option value="subtotal_before_adjustments">Subtotal antes de ajustes</option>
            </select>
          </label>
        )}
      </div>
      <div className="form-actions"><button className="button" disabled={saving}>{saving ? "Guardando…" : "Crear suplemento"}</button></div>
    </form>
  );
}

function PreinvoiceForm(
  { clients, clientFilter, selectedOrders, prefacturableOrders, toggleOrder, create }: {
    clients: TransportOption[];
    clientFilter: string;
    selectedOrders: PrefacturableOrderRow[];
    prefacturableOrders: PrefacturableOrderRow[];
    toggleOrder: (orderId: string) => void;
    create: (payload: Record<string, unknown>) => Promise<void>;
  },
) {
  const [values, setValues] = useState({
    clientId: clientFilter !== "all" ? clientFilter : "",
    periodStart: new Date().toISOString().slice(0, 10),
    periodEnd: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      if (!values.clientId) throw new Error("Selecciona un cliente.");
      if (selectedOrders.length === 0) throw new Error("Selecciona al menos una orden validada.");
      await create(values);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear la prefactura.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel master-data-form" onSubmit={submit}>
      <h3>Nueva prefactura</h3>
      {error && <p role="alert" className="error-banner">{error}</p>}
      <div className="form-grid">
        <label>
          Cliente<select value={values.clientId} onChange={(event) => setValues((current) => ({ ...current, clientId: event.target.value }))}>
            <option value="">Seleccionar</option>
            {clients.map((client) => <option key={client.value} value={client.value}>{client.label}</option>)}
          </select>
        </label>
        <label>Periodo inicio<input type="date" value={values.periodStart} onChange={(event) => setValues((current) => ({ ...current, periodStart: event.target.value }))} required /></label>
        <label>Periodo fin<input type="date" value={values.periodEnd} onChange={(event) => setValues((current) => ({ ...current, periodEnd: event.target.value }))} required /></label>
        <label className="full-field">Notas<textarea value={values.notes} onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))} /></label>
      </div>
      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Orden</th>
              <th>Cliente</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {prefacturableOrders.filter((row) => !values.clientId || row.customerId === values.clientId).map((row) => (
              <tr key={row.orderId}>
                <td><input type="checkbox" checked={selectedOrders.some((selected) => selected.orderId === row.orderId)} onChange={() => toggleOrder(row.orderId)} /></td>
                <td>{row.orderNumber}</td>
                <td>{row.customerName}</td>
                <td>{row.totalAmount.toFixed(2)} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="form-actions"><button className="button" disabled={saving}>{saving ? "Creando…" : "Crear prefactura"}</button></div>
    </form>
  );
}