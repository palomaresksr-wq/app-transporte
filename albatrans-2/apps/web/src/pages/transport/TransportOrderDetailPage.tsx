import type { TransportOrderStatus } from "@albatrans/contracts";
import {
  allowedTransportTransitions,
  nonNegativeDecimal,
  nonNegativeInteger,
  normalizeTransportType,
  validatePeriod,
} from "@albatrans/domain";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  loadTransportDetail,
  loadTransportOptions,
  transportCommand,
  type TransportDetail,
  type TransportOption,
} from "../../data/transport-repository";
import { OrderValuationPanel } from "../billing/OrderValuationPanel";
import { DocumentManager } from "./DocumentManager";
import { RegulatoryDocumentsPanel } from "./RegulatoryDocumentsPanel";
type Editor = {
  kind: "order" | "stop" | "item" | "assignment";
  id?: string;
  stopId?: string;
};
export function TransportOrderDetailPage(
  { organizationId, orderId, platform, executionEnabled = false }: {
    organizationId: string;
    orderId: string;
    platform: boolean;
    executionEnabled?: boolean;
  },
) {
  const [detail, setDetail] = useState<TransportDetail | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [editor, setEditor] = useState<Editor | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDetail(await loadTransportDetail(organizationId, orderId));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo cargar la orden.",
      );
    } finally {
      setLoading(false);
    }
  }, [organizationId, orderId]);
  useEffect(() => void refresh(), [refresh]);
  const base = platform
    ? `/platform/organizations/${organizationId}/transport`
    : "/empresa/transport";
  const executionPath = platform
    ? `/platform/organizations/${organizationId}/transport/${orderId}/execution`
    : `/empresa/transport/${orderId}/execution`;
  if (loading) {
    return <div className="list-state" aria-busy="true">Cargando…</div>;
  }
  if (error && !detail) {
    return <p role="alert" className="error-banner">{error}</p>;
  }
  if (!detail) {
    return (
      <section className="panel empty-state">
        <h1>Orden inexistente</h1>
        <Link to={base}>Volver al listado</Link>
      </section>
    );
  }
  const transition = async (status: TransportOrderStatus) => {
    try {
      setError("");
      await transportCommand({
        action: "transition",
        resource: "order",
        organizationId,
        entityId: orderId,
        targetStatus: status,
        values: {},
      });
      setSuccess(`Estado actualizado a ${status}.`);
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo cambiar el estado.",
      );
    }
  };
  return (
    <section className="detail-page">
      <div className="page-heading">
        <div>
          <Link to={base}>← Volver</Link>
          <span className="eyebrow">Orden {detail.order.order_number}</span>
          <h1>{detail.customerName}</h1>
        </div>
        <div className="action-row">
          {(platform || executionEnabled) && (
            <Link className="button" to={executionPath}>Ejecución operativa</Link>
          )}
          <button
            className="button button-secondary"
            disabled={["completed", "cancelled", "archived"].includes(detail.order.status)}
            onClick={() => setEditor({ kind: "order", id: orderId })}
          >Editar orden</button>
        </div>
      </div>
      {error && <p role="alert" className="error-banner">{error}</p>}
      {success && <p role="status" className="success-banner">{success}</p>}
      <section className="detail-section">
        <h2>Resumen y estado</h2>
        <dl className="detail-grid">
          <Info label="Estado" value={detail.order.status} />
          <Info label="Estado económico" value={detail.order.economic_status} />
          <Info label="Prioridad" value={detail.order.priority} />
          <Info label="Tipo" value={detail.order.transport_type} />
          <Info label="Km facturables" value={detail.order.billable_km?.toString() ?? "—"} />
          <Info
            label="Recogida"
            value={format(detail.order.planned_pickup_at)}
          />
          <Info
            label="Entrega"
            value={format(detail.order.planned_delivery_at)}
          />
          <Info label="Actualizada" value={format(detail.order.updated_at)} />
        </dl>
        <div className="form-actions">
          {allowedTransportTransitions(detail.order.status).map((status) => (
            <button
              key={status}
              className={status === "cancelled" || status === "archived"
                ? "button button-secondary"
                : "button"}
              onClick={() => void transition(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </section>
      <OrderValuationPanel organizationId={organizationId} orderId={orderId} />
      <RegulatoryDocumentsPanel organizationId={organizationId} orderId={orderId} />
      <section className="detail-section">
        <div className="section-heading">
          <h2>Paradas</h2>
          <button
            className="button"
            disabled={terminal(detail)}
            onClick={() => setEditor({ kind: "stop" })}
          >
            Añadir parada
          </button>
        </div>
        {detail.stops.length === 0
          ? <p>Sin paradas.</p>
          : (
            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Posición</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Ventana</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.stops.map((stop) => (
                    <tr key={stop.id}>
                      <td>{stop.position}</td>
                      <td>{stop.stop_type}</td>
                      <td>{stop.status}</td>
                      <td>
                        {format(stop.window_starts_at)} –{" "}
                        {format(stop.window_ends_at)}
                      </td>
                      <td>
                        <button
                          className="button button-secondary"
                          disabled={terminal(detail)}
                          onClick={() =>
                            setEditor({ kind: "stop", id: stop.id })}
                        >
                          Editar
                        </button>
                        <button
                          className="button button-secondary"
                          disabled={terminal(detail)}
                          onClick={() =>
                            setEditor({ kind: "item", stopId: stop.id })}
                        >
                          Añadir mercancía
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
      <section className="detail-section">
        <h2>Mercancías</h2>
        {detail.items.length === 0
          ? <p>Sin mercancías.</p>
          : (
            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Referencia</th>
                    <th>Palets</th>
                    <th>Bultos</th>
                    <th>Peso</th>
                    <th>ADR</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td>{item.reference ?? "—"}</td>
                      <td>{item.pallets}</td>
                      <td>{item.packages}</td>
                      <td>{item.weight_kg ?? "—"}</td>
                      <td>{item.is_adr ? "Sí" : "No"}</td>
                      <td>
                        <button
                          className="button button-secondary"
                          disabled={terminal(detail)}
                          onClick={() =>
                            setEditor({
                              kind: "item",
                              id: item.id,
                              stopId: item.stop_id,
                            })}
                        >
                          Editar
                        </button>
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
          <h2>Asignaciones</h2>
          <button
            className="button"
            disabled={detail.order.status !== "planned"}
            onClick={() => setEditor({ kind: "assignment" })}
          >
            Asignar
          </button>
        </div>
        {detail.assignments.length === 0
          ? <p>Sin asignaciones.</p>
          : (
            <ul className="member-list">
              {detail.assignments.map((assignment) => (
                <li key={assignment.id}>
                  <div>
                    <strong>{assignment.driver_id}</strong>
                    <span>
                      {format(assignment.starts_at)} –{" "}
                      {format(assignment.ends_at)}
                    </span>
                  </div>
                  {!assignment.unassigned_at &&
                    detail.order.status === "assigned" && (
                    <button
                      className="button button-secondary"
                      onClick={async () => {
                        try {
                          await transportCommand({
                            action: "unassign",
                            resource: "assignment",
                            organizationId,
                            orderId,
                            entityId: assignment.id,
                            values: {},
                            reason: "Retirada administrativa",
                          });
                          setSuccess(
                            "Asignación retirada; historial conservado.",
                          );
                          await refresh();
                        } catch (caught) {
                          setError(
                            caught instanceof Error
                              ? caught.message
                              : "No se pudo retirar.",
                          );
                        }
                      }}
                    >
                      Retirar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
      </section>
      <DocumentManager
        organizationId={organizationId}
        orderId={orderId}
        stops={detail.stops.map((stop) => ({
          id: stop.id,
          position: stop.position,
          stop_type: stop.stop_type,
        }))}
      />
      <section className="detail-section">
        <h2>Timeline</h2>
        {detail.events.length === 0
          ? <p>Sin eventos.</p>
          : (
            <ol className="transport-timeline">
              {detail.events.map((event) => (
                <li key={event.id}>
                  <time>{format(event.occurred_at)}</time>
                  <strong>{event.event_type}</strong>
                  <span>{event.entity_type}</span>
                </li>
              ))}
            </ol>
          )}
      </section>
      {editor && (
        <EntityEditor
          editor={editor}
          detail={detail}
          organizationId={organizationId}
          close={() => setEditor(null)}
          saved={async (message) => {
            setEditor(null);
            setSuccess(message);
            await refresh();
          }}
        />
      )}
    </section>
  );
}
function EntityEditor(
  { editor, detail, organizationId, close, saved }: {
    editor: Editor;
    detail: TransportDetail;
    organizationId: string;
    close: () => void;
    saved: (message: string) => Promise<void>;
  },
) {
  const [options, setOptions] = useState<Record<string, TransportOption[]>>({}),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const existing = editor.kind === "stop"
    ? detail.stops.find((row) => row.id === editor.id)
    : editor.kind === "item"
    ? detail.items.find((row) => row.id === editor.id)
    : null;
  const [values, setValues] = useState<
    Record<string, string | number | boolean | null>
  >(() => initial(editor, detail, existing));
  useEffect(() => {
    const kinds = editor.kind === "order"
      ? ["clients"]
      : editor.kind === "stop"
      ? ["clients", "locations"]
      : editor.kind === "assignment"
      ? ["drivers", "vehicles"]
      : [];
    for (const kind of kinds) {
      void loadTransportOptions(
        organizationId,
        kind as "clients" | "locations" | "drivers" | "vehicles",
      ).then((rows) => setOptions((current) => ({ ...current, [kind]: rows })))
        .catch((caught) =>
          setError(
            caught instanceof Error
              ? caught.message
              : "No se pudieron cargar las opciones.",
          )
        );
    }
  }, [editor.kind, organizationId]);
  const set = (key: string, value: string | number | boolean | null) =>
    setValues((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      const clean = validate(editor.kind, values);
      await transportCommand({
        action: editor.kind === "assignment"
          ? "assign"
          : editor.id
          ? "update"
          : "create",
        resource: editor.kind,
        organizationId,
        orderId: detail.order.id,
        entityId: editor.id,
        values: clean,
      });
      await saved(
        editor.id
          ? "Cambios guardados."
          : editor.kind === "assignment"
          ? "Orden asignada."
          : "Registro creado.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo guardar.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Editar ${editor.kind}`}
    >
      <form className="panel dialog-panel master-data-form" onSubmit={submit}>
        <h2>{editor.id ? "Editar" : "Crear"} {editor.kind}</h2>
        {error && <p role="alert" className="error-banner">{error}</p>}
        <div className="form-grid">
          {editor.kind === "order" && (
            <>
              <Select
                label="Cliente"
                value={text(values.customer_id)}
                options={options.clients ?? []}
                set={(value) => set("customer_id", value)}
              />
              <label>
                Prioridad<select
                  value={text(values.priority)}
                  onChange={(event) => set("priority", event.target.value)}
                >
                  {["low", "normal", "high", "urgent"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <Input
                label="Tipo de transporte"
                value={text(values.transport_type)}
                set={(value) => set("transport_type", value)}
              />
              <Input
                label="Km facturables"
                type="number"
                value={text(values.billable_km)}
                set={(value) => set("billable_km", value ? Number(value) : null)}
              />
              <DateInputs values={values} set={set} />
            </>
          )}
          {editor.kind === "stop" && (
            <>
              <Input
                label="Posición"
                type="number"
                value={text(values.position)}
                set={(value) => set("position", Number(value))}
              />
              <label>
                Tipo<select
                  value={text(values.stop_type)}
                  onChange={(event) => set("stop_type", event.target.value)}
                >
                  {["pickup", "delivery", "waypoint", "cross_dock", "return"]
                    .map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
              <Select
                label="Ubicación"
                value={text(values.location_id)}
                options={options.locations ?? []}
                set={(value) => set("location_id", value)}
              />
              <Select
                label="Cliente opcional"
                value={text(values.customer_id)}
                options={options.clients ?? []}
                set={(value) => set("customer_id", value || null)}
                optional
              />
              <Input
                label="Inicio ventana"
                type="datetime-local"
                value={text(values.window_starts_at)}
                set={(value) => set("window_starts_at", value || null)}
              />
              <Input
                label="Fin ventana"
                type="datetime-local"
                value={text(values.window_ends_at)}
                set={(value) => set("window_ends_at", value || null)}
              />
            </>
          )}
          {editor.kind === "item" && (
            <>
              <Input
                label="Descripción"
                value={text(values.description)}
                set={(value) => set("description", value)}
              />
              <Input
                label="Referencia"
                value={text(values.reference)}
                set={(value) => set("reference", value || null)}
              />
              <Input
                label="Palets"
                type="number"
                value={text(values.pallets)}
                set={(value) => set("pallets", Number(value))}
              />
              <Input
                label="Bultos"
                type="number"
                value={text(values.packages)}
                set={(value) => set("packages", Number(value))}
              />
              <Input
                label="Peso kg"
                type="number"
                value={text(values.weight_kg)}
                set={(value) => set("weight_kg", value ? Number(value) : null)}
              />
              <Input
                label="Volumen m³"
                type="number"
                value={text(values.volume_m3)}
                set={(value) => set("volume_m3", value ? Number(value) : null)}
              />
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={values.is_adr === true}
                  onChange={(event) => set("is_adr", event.target.checked)}
                />{" "}
                ADR
              </label>
              <Input
                label="Temperatura mínima"
                type="number"
                value={text(values.temperature_min_c)}
                set={(value) =>
                  set("temperature_min_c", value ? Number(value) : null)}
              />
              <Input
                label="Temperatura máxima"
                type="number"
                value={text(values.temperature_max_c)}
                set={(value) =>
                  set("temperature_max_c", value ? Number(value) : null)}
              />
            </>
          )}
          {editor.kind === "assignment" && (
            <>
              <Select
                label="Conductor"
                value={text(values.driver_id)}
                options={options.drivers ?? []}
                set={(value) => set("driver_id", value)}
              />
              <Select
                label="Vehículo"
                value={text(values.vehicle_id)}
                options={options.vehicles ?? []}
                set={(value) => set("vehicle_id", value)}
              />
              <Input
                label="Inicio"
                type="datetime-local"
                value={text(values.starts_at)}
                set={(value) => set("starts_at", value)}
              />
              <Input
                label="Fin"
                type="datetime-local"
                value={text(values.ends_at)}
                set={(value) => set("ends_at", value)}
              />
            </>
          )}
          <label className="full-field">
            Notas<textarea
              value={text(values.notes)}
              onChange={(event) => set("notes", event.target.value || null)}
            />
          </label>
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={close}
          >
            Cancelar
          </button>
          <button className="button" disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
function initial(
  editor: Editor,
  detail: TransportDetail,
  existing: Record<string, unknown> | null | undefined,
): Record<string, string | number | boolean | null> {
  if (existing) {
    const values: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(existing)) {
      if (
        typeof value === "string" || typeof value === "number" ||
        typeof value === "boolean" || value === null
      ) values[key] = value;
    }
    return values;
  }
  if (editor.kind === "order") {
    return {
      customer_id: detail.order.customer_id,
      priority: detail.order.priority,
      transport_type: detail.order.transport_type,
      billable_km: detail.order.billable_km,
      planned_pickup_at: local(detail.order.planned_pickup_at),
      planned_delivery_at: local(detail.order.planned_delivery_at),
      requested_pickup_at: local(detail.order.requested_pickup_at),
      requested_delivery_at: local(detail.order.requested_delivery_at),
      notes: detail.order.notes,
    };
  }
  if (editor.kind === "stop") {
    return {
      position: detail.stops.length + 1,
      stop_type: "pickup",
      location_id: "",
      customer_id: detail.order.customer_id,
      window_starts_at: null,
      window_ends_at: null,
      status: "pending",
      notes: null,
    };
  }
  if (editor.kind === "item") {
    return {
      stop_id: editor.stopId ?? "",
      description: "",
      reference: null,
      pallets: 0,
      packages: 0,
      weight_kg: null,
      volume_m3: null,
      is_adr: false,
      temperature_min_c: null,
      temperature_max_c: null,
      notes: null,
    };
  }
  return {
    driver_id: "",
    vehicle_id: "",
    starts_at: local(detail.order.planned_pickup_at),
    ends_at: local(detail.order.planned_delivery_at),
    notes: null,
  };
}
function validate(
  kind: Editor["kind"],
  values: Record<string, string | number | boolean | null>,
) {
  const clean = { ...values };
  if (kind === "order") {
    clean.transport_type = normalizeTransportType(clean.transport_type);
    clean.billable_km = nonNegativeDecimal(clean.billable_km, "Km facturables");
    validatePeriod(
      clean.planned_pickup_at,
      clean.planned_delivery_at,
      "periodo planificado",
    );
    validatePeriod(
      clean.requested_pickup_at,
      clean.requested_delivery_at,
      "periodo solicitado",
    );
  }
  if (kind === "stop") {
    clean.position = nonNegativeInteger(clean.position, "Posición");
    if (clean.position === 0) {
      throw new Error("La posición debe ser mayor que cero.");
    }
    validatePeriod(
      clean.window_starts_at,
      clean.window_ends_at,
      "ventana horaria",
    );
  }
  if (kind === "item") {
    clean.pallets = nonNegativeInteger(clean.pallets, "Palets");
    clean.packages = nonNegativeInteger(clean.packages, "Bultos");
    clean.weight_kg = nonNegativeDecimal(clean.weight_kg, "Peso");
    clean.volume_m3 = nonNegativeDecimal(clean.volume_m3, "Volumen");
    if (typeof clean.description !== "string" || !clean.description.trim()) {
      throw new Error("La descripción es obligatoria.");
    }
    if (
      clean.temperature_min_c !== null && clean.temperature_max_c !== null &&
      Number(clean.temperature_max_c) < Number(clean.temperature_min_c)
    ) {
      throw new Error(
        "La temperatura máxima no puede ser inferior a la mínima.",
      );
    }
  }
  if (kind === "assignment") {
    validatePeriod(clean.starts_at, clean.ends_at, "periodo de asignación");
  }
  return clean;
}
function Input(
  { label, value, set, type = "text" }: {
    label: string;
    value: string;
    set: (value: string) => void;
    type?: string;
  },
) {
  return (
    <label>
      {label}
      <input
        required={!label.includes("opcional") && !label.includes("Peso") &&
          !label.includes("Volumen") && !label.includes("Temperatura")}
        type={type}
        step={type === "number" ? "any" : undefined}
        value={value}
        onChange={(event) => set(event.target.value)}
      />
    </label>
  );
}
function Select(
  { label, value, options, set, optional = false }: {
    label: string;
    value: string;
    options: TransportOption[];
    set: (value: string) => void;
    optional?: boolean;
  },
) {
  return (
    <label>
      {label}
      <select
        required={!optional}
        value={value}
        onChange={(event) => set(event.target.value)}
      >
        <option value="">{optional ? "Sin seleccionar" : "Seleccionar"}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function DateInputs(
  { values, set }: {
    values: Record<string, string | number | boolean | null>;
    set: (key: string, value: string | number | boolean | null) => void;
  },
) {
  return (
    <>
      {([
        ["Recogida planificada", "planned_pickup_at"],
        ["Entrega planificada", "planned_delivery_at"],
        ["Recogida solicitada", "requested_pickup_at"],
        ["Entrega solicitada", "requested_delivery_at"],
      ] as const).map(([label, key]) => (
        <Input
          key={key}
          label={label}
          type="datetime-local"
          value={text(values[key])}
          set={(value) => set(key, value || null)}
        />
      ))}
    </>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
function terminal(detail: TransportDetail) {
  return ["completed", "cancelled", "archived"].includes(detail.order.status);
}
function format(value: string | null) {
  return value ? new Date(value).toLocaleString("es-ES") : "—";
}
function local(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}
function text(value: string | number | boolean | null | undefined) {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}
