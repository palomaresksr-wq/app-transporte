import { normalizeTransportType, validatePeriod } from "@albatrans/domain";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  loadTransportOptions,
  loadTransportOrders,
  transportCommand,
  type TransportOption,
  type TransportOrderRow,
} from "../../data/transport-repository";
const statuses = [
  "draft",
  "planned",
  "assigned",
  "loading",
  "in_transit",
  "unloading",
  "completed",
  "cancelled",
  "archived",
];
const priorities = ["low", "normal", "high", "urgent"];
export function TransportOrdersPage(
  { organizationId, platform }: { organizationId: string; platform: boolean },
) {
  const navigate = useNavigate(),
    [items, setItems] = useState<TransportOrderRow[]>([]),
    [customers, setCustomers] = useState<TransportOption[]>([]),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [priority, setPriority] = useState("all"),
    [customerId, setCustomerId] = useState("all"),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [creating, setCreating] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await loadTransportOrders({
        organizationId,
        search,
        status,
        priority,
        customerId,
        page,
        pageSize: 20,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudieron cargar las órdenes.",
      );
    } finally {
      setLoading(false);
    }
  }, [organizationId, search, status, priority, customerId, page]);
  useEffect(() => void refresh(), [refresh]);
  useEffect(() => {
    void loadTransportOptions(organizationId, "clients").then(setCustomers)
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "No se pudieron cargar los clientes.",
        )
      );
  }, [organizationId]);
  const base = platform
    ? `/platform/organizations/${organizationId}/transport`
    : `/empresa/transport`;
  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Núcleo operativo</span>
          <h1>Órdenes de transporte</h1>
        </div>
        <button className="button" onClick={() => setCreating(true)}>
          Nueva orden
        </button>
      </div>
      <div className="panel filters-row">
        <label>
          Buscar<input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <Filter
          label="Estado"
          value={status}
          options={statuses}
          set={setStatus}
        />
        <Filter
          label="Prioridad"
          value={priority}
          options={priorities}
          set={setPriority}
        />
        <label>
          Cliente<select
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
          >
            <option value="all">Todos</option>
            {customers.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p role="alert" className="error-banner">{error}</p>}
      {success && <p role="status" className="success-banner">{success}</p>}
      {loading
        ? <div aria-busy="true" className="list-state">Cargando…</div>
        : items.length === 0
        ? (
          <div className="panel empty-state">
            {search || status !== "all" || priority !== "all" ||
                customerId !== "all"
              ? "No hay resultados para los filtros."
              : "Todavía no hay órdenes."}
          </div>
        )
        : (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Prioridad</th>
                  <th>Recogida</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.orderNumber}</td>
                    <td>{item.customerName}</td>
                    <td>{item.transportType}</td>
                    <td>
                      <span className="status-pill">{item.status}</span>
                    </td>
                    <td>{item.priority}</td>
                    <td>
                      {item.plannedPickupAt
                        ? new Date(item.plannedPickupAt).toLocaleString("es-ES")
                        : "Sin planificar"}
                    </td>
                    <td>
                      <Link
                        className="button button-secondary"
                        to={`${base}/${item.id}`}
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      <div className="pagination">
        <button
          disabled={page === 1}
          onClick={() => setPage((value) => value - 1)}
        >
          Anterior
        </button>
        <span>Página {page} · {total} registros</span>
        <button
          disabled={page * 20 >= total}
          onClick={() => setPage((value) => value + 1)}
        >
          Siguiente
        </button>
      </div>
      {creating && (
        <OrderForm
          customers={customers}
          close={() => setCreating(false)}
          save={async (values) => {
            const result = await transportCommand({
              action: "create",
              resource: "order",
              organizationId,
              values,
            });
            setCreating(false);
            setSuccess("Orden creada.");
            await refresh();
            navigate(`${base}/${result.orderId}`);
          }}
        />
      )}
    </section>
  );
}
function Filter(
  { label, value, options, set }: {
    label: string;
    value: string;
    options: string[];
    set: (value: string) => void;
  },
) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => set(event.target.value)}>
        <option value="all">Todos</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
function OrderForm(
  { customers, close, save }: {
    customers: TransportOption[];
    close: () => void;
    save: (values: Record<string, string | null>) => Promise<void>;
  },
) {
  const [values, setValues] = useState({
      customer_id: "",
      priority: "normal",
      transport_type: "General",
      planned_pickup_at: "",
      planned_delivery_at: "",
      requested_pickup_at: "",
      requested_delivery_at: "",
      notes: "",
    }),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      if (!values.customer_id) throw new Error("Selecciona un cliente.");
      validatePeriod(
        values.planned_pickup_at || null,
        values.planned_delivery_at || null,
        "periodo planificado",
      );
      validatePeriod(
        values.requested_pickup_at || null,
        values.requested_delivery_at || null,
        "periodo solicitado",
      );
      await save({
        ...values,
        transport_type: normalizeTransportType(values.transport_type),
        planned_pickup_at: values.planned_pickup_at || null,
        planned_delivery_at: values.planned_delivery_at || null,
        requested_pickup_at: values.requested_pickup_at || null,
        requested_delivery_at: values.requested_delivery_at || null,
        notes: values.notes.trim() || null,
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo crear la orden.",
      );
    } finally {
      setSaving(false);
    }
  }
  const change = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Nueva orden"
    >
      <form className="panel dialog-panel master-data-form" onSubmit={submit}>
        <h2>Nueva orden</h2>
        {error && <p role="alert" className="error-banner">{error}</p>}
        <div className="form-grid">
          <label>
            Cliente<select
              required
              value={values.customer_id}
              onChange={(event) => change("customer_id", event.target.value)}
            >
              <option value="">Seleccionar</option>
              {customers.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prioridad<select
              value={values.priority}
              onChange={(event) => change("priority", event.target.value)}
            >
              {priorities.map((option) => <option key={option}>{option}
              </option>)}
            </select>
          </label>
          <label>
            Tipo de transporte<input
              required
              value={values.transport_type}
              onChange={(event) => change("transport_type", event.target.value)}
            />
          </label>
          <DateField
            label="Recogida planificada"
            value={values.planned_pickup_at}
            set={(value) => change("planned_pickup_at", value)}
          />
          <DateField
            label="Entrega planificada"
            value={values.planned_delivery_at}
            set={(value) => change("planned_delivery_at", value)}
          />
          <DateField
            label="Recogida solicitada"
            value={values.requested_pickup_at}
            set={(value) => change("requested_pickup_at", value)}
          />
          <DateField
            label="Entrega solicitada"
            value={values.requested_delivery_at}
            set={(value) => change("requested_delivery_at", value)}
          />
          <label className="full-field">
            Notas<textarea
              value={values.notes}
              onChange={(event) => change("notes", event.target.value)}
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
            {saving ? "Guardando…" : "Crear orden"}
          </button>
        </div>
      </form>
    </div>
  );
}
function DateField(
  { label, value, set }: {
    label: string;
    value: string;
    set: (value: string) => void;
  },
) {
  return (
    <label>
      {label}
      <input
        type="datetime-local"
        value={value}
        onChange={(event) => set(event.target.value)}
      />
    </label>
  );
}
