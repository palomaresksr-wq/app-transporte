import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  addOrderAdjustment,
  addOrderSupplement,
  calculateOrderBilling,
  loadBillingSupplementDefinitions,
  loadTransportBillingView,
  reopenOrderBilling,
  validateOrderBilling,
  type BillingSupplementDefinitionRow,
  type TransportBillingView,
} from "../../data/billing-repository";

export function OrderValuationPanel({ organizationId, orderId }: { organizationId: string; orderId: string }) {
  const [view, setView] = useState<TransportBillingView | null>(null);
  const [supplementDefinitions, setSupplementDefinitions] = useState<BillingSupplementDefinitionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [supplement, setSupplement] = useState({ definitionId: "", quantity: "1" });
  const [adjustment, setAdjustment] = useState({ kind: "discount", sign: "-1", mode: "fixed", amount: "", quantity: "1", reason: "" });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [billingView, definitions] = await Promise.all([
        loadTransportBillingView(organizationId, orderId),
        loadBillingSupplementDefinitions(organizationId),
      ]);
      setView(billingView);
      setSupplementDefinitions(definitions.filter((definition) => definition.status === "active"));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar la valoración.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, orderId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const breakdown = useMemo(() => {
    const raw = view?.valuation?.breakdown_json;
    return typeof raw === "object" && raw !== null && !Array.isArray(raw) && Array.isArray((raw as { lines?: unknown[] }).lines)
      ? (raw as { lines: Array<{ label: string; amount: string; effectSign: -1 | 1; baseAmount?: string | null; percentageRate?: string | null }> }).lines
      : [];
  }, [view?.valuation?.breakdown_json]);

  if (loading) return <section className="detail-section"><h2>Valoración</h2><p aria-busy="true">Cargando valoración…</p></section>;
  if (!view) return <section className="detail-section"><h2>Valoración</h2><p>Sin datos de valoración.</p></section>;

  return (
    <section className="detail-section">
      <div className="section-heading">
        <h2>Valoración</h2>
        <div className="inline-actions">
          {view.order.economic_status !== "prefactured" && view.order.economic_status !== "invoiced" && view.order.economic_status !== "cancelled" && (
            <button className="button" disabled={busy} onClick={async () => {
              try {
                setBusy(true);
                setError("");
                await calculateOrderBilling({ organizationId, orderId });
                setSuccess("Valoración calculada.");
                await refresh();
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "No se pudo calcular la valoración.");
              } finally {
                setBusy(false);
              }
            }}>{view.order.economic_status === "unpriced" ? "Calcular" : "Recalcular"}</button>
          )}
          {view.order.economic_status === "calculated" && (
            <button className="button button-secondary" disabled={busy} onClick={async () => {
              try {
                setBusy(true);
                setError("");
                await validateOrderBilling({ organizationId, orderId, reason: "Validación económica" });
                setSuccess("Importe validado.");
                await refresh();
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "No se pudo validar la valoración.");
              } finally {
                setBusy(false);
              }
            }}>Validar importe</button>
          )}
          {view.order.economic_status === "validated" && (
            <button className="button button-secondary" disabled={busy} onClick={async () => {
              try {
                setBusy(true);
                setError("");
                await reopenOrderBilling({ organizationId, orderId, reason: "Reapertura económica manual" });
                setSuccess("Valoración reabierta.");
                await refresh();
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "No se pudo reabrir la valoración.");
              } finally {
                setBusy(false);
              }
            }}>Reabrir valoración</button>
          )}
        </div>
      </div>
      {error && <p role="alert" className="error-banner">{error}</p>}
      {success && <p role="status" className="success-banner">{success}</p>}
      <dl className="detail-grid">
        <Info label="Estado" value={view.order.economic_status} />
        <Info label="Km facturables" value={view.order.billable_km?.toString() ?? "—"} />
        <Info label="Tarifa aplicada" value={rateName(view)} />
        <Info label="Prefactura activa" value={view.activePreinvoice?.reference ?? "—"} />
      </dl>

      {view.valuation ? (
        <>
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Base</th>
                  <th>%</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((line, index) => (
                  <tr key={`${line.label}-${index}`}>
                    <td>{line.label}</td>
                    <td>{line.baseAmount ?? "—"}</td>
                    <td>{line.percentageRate ?? "—"}</td>
                    <td>{line.effectSign === -1 ? `-${line.amount}` : line.amount} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Base: {view.valuation.base_amount.toFixed(2)} € · Suplementos: {view.valuation.supplements_amount.toFixed(2)} € · Ajustes: {view.valuation.adjustments_amount.toFixed(2)} € · <strong>Total: {view.valuation.total_amount.toFixed(2)} €</strong>
          </p>
        </>
      ) : (
        <p>Sin valoración calculada todavía.</p>
      )}

      <div className="form-grid">
        <form className="panel compact-panel" onSubmit={async (event) => {
          event.preventDefault();
          const selected = supplementDefinitions.find((definition) => definition.id === supplement.definitionId);
          if (!selected) {
            setError("Selecciona un suplemento.");
            return;
          }
          try {
            setBusy(true);
            setError("");
            await addOrderSupplement({
              organizationId,
              orderId,
              supplementDefinitionId: selected.id,
              code: selected.code,
              name: selected.name,
              chargeMode: selected.charge_mode,
              amount: selected.amount,
              quantity: supplement.quantity,
              unitCode: selected.unit_code,
              percentageBase: selected.percentage_base,
            });
            setSuccess("Suplemento añadido.");
            setSupplement({ definitionId: "", quantity: "1" });
            await refresh();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "No se pudo añadir el suplemento.");
          } finally {
            setBusy(false);
          }
        }}>
          <h3>Añadir suplemento</h3>
          <label>
            Suplemento<select value={supplement.definitionId} onChange={(event) => setSupplement((current) => ({ ...current, definitionId: event.target.value }))}>
              <option value="">Seleccionar</option>
              {supplementDefinitions.map((definition) => <option key={definition.id} value={definition.id}>{definition.name}</option>)}
            </select>
          </label>
          <label>
            Cantidad<input type="number" step="any" value={supplement.quantity} onChange={(event) => setSupplement((current) => ({ ...current, quantity: event.target.value }))} />
          </label>
          <button className="button button-secondary" disabled={busy}>Añadir suplemento</button>
        </form>

        <form className="panel compact-panel" onSubmit={async (event: FormEvent) => {
          event.preventDefault();
          try {
            setBusy(true);
            setError("");
            await addOrderAdjustment({
              organizationId,
              orderId,
              adjustmentKind: adjustment.kind,
              effectSign: Number(adjustment.sign),
              chargeMode: adjustment.mode,
              amount: adjustment.amount,
              quantity: adjustment.quantity,
              reason: adjustment.reason,
              percentageBase: adjustment.mode === "percent" ? "subtotal_before_adjustments" : null,
            });
            setSuccess("Ajuste añadido.");
            setAdjustment({ kind: "discount", sign: "-1", mode: "fixed", amount: "", quantity: "1", reason: "" });
            await refresh();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "No se pudo añadir el ajuste.");
          } finally {
            setBusy(false);
          }
        }}>
          <h3>Añadir ajuste</h3>
          <label>
            Tipo<select value={adjustment.kind} onChange={(event) => setAdjustment((current) => ({ ...current, kind: event.target.value }))}>
              <option value="discount">Descuento</option>
              <option value="surcharge">Suplemento extraordinario</option>
              <option value="correction">Corrección</option>
            </select>
          </label>
          <label>
            Signo<select value={adjustment.sign} onChange={(event) => setAdjustment((current) => ({ ...current, sign: event.target.value }))}>
              <option value="-1">Resta</option>
              <option value="1">Suma</option>
            </select>
          </label>
          <label>
            Modo<select value={adjustment.mode} onChange={(event) => setAdjustment((current) => ({ ...current, mode: event.target.value }))}>
              <option value="fixed">Fijo</option>
              <option value="percent">Porcentaje</option>
              <option value="per_unit">Por unidad</option>
            </select>
          </label>
          <label>
            Importe<input type="number" step="any" value={adjustment.amount} onChange={(event) => setAdjustment((current) => ({ ...current, amount: event.target.value }))} required />
          </label>
          <label>
            Cantidad<input type="number" step="any" value={adjustment.quantity} onChange={(event) => setAdjustment((current) => ({ ...current, quantity: event.target.value }))} />
          </label>
          <label>
            Motivo<textarea value={adjustment.reason} onChange={(event) => setAdjustment((current) => ({ ...current, reason: event.target.value }))} required />
          </label>
          <button className="button button-secondary" disabled={busy}>Añadir ajuste</button>
        </form>
      </div>
    </section>
  );
}

function rateName(view: TransportBillingView) {
  if (!view.valuation) return "—";
  const snapshot = view.valuation.rate_snapshot_json;
  if (typeof snapshot !== "object" || snapshot === null || Array.isArray(snapshot)) return "Tarifa sin snapshot";
  const record = snapshot as Record<string, unknown>;
  return `${typeof record.name === "string" ? record.name : "Tarifa"}${typeof record.versionNumber === "number" ? ` · v${record.versionNumber}` : ""}`;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}