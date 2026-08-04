import { MasterDataValidationError, validAssignmentPeriod } from "@albatrans/domain";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  type AssignmentRow,
  commandMasterData,
  loadAssignments,
  loadMasterDataOptions,
  type MasterDataOption,
} from "../../data/master-data-repository";

export function AssignmentsPage(
  { organizationId }: { organizationId: string },
) {
  const [items, setItems] = useState<AssignmentRow[]>([]);
  const [drivers, setDrivers] = useState<MasterDataOption[]>([]);
  const [vehicles, setVehicles] = useState<MasterDataOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState({
    driverId: "",
    vehicleId: "",
    startsAt: "",
    endsAt: "",
    notes: "",
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await loadAssignments(organizationId, page, 20);
      setItems(result.items);
      setTotal(result.total);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudieron cargar las asignaciones.",
      );
    } finally {
      setLoading(false);
    }
  }, [organizationId, page]);

  useEffect(() => void refresh(), [refresh]);
  useEffect(() => {
    void Promise.all([
      loadMasterDataOptions(organizationId, "drivers"),
      loadMasterDataOptions(organizationId, "vehicles"),
    ]).then(([driverOptions, vehicleOptions]) => {
      setDrivers(driverOptions);
      setVehicles(vehicleOptions);
    }).catch((caught) =>
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudieron cargar las opciones.",
      )
    );
  }, [organizationId]);

  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      validAssignmentPeriod(values.startsAt, values.endsAt || null);
      if (!values.driverId || !values.vehicleId) {
        throw new MasterDataValidationError(
          "Selecciona un conductor y un vehículo.",
        );
      }
      await commandMasterData({
        action: "create",
        resource: "driver_vehicle_assignments",
        organizationId,
        values: {
          driver_id: values.driverId,
          vehicle_id: values.vehicleId,
          starts_at: values.startsAt,
          ends_at: values.endsAt || null,
          notes: values.notes.trim() || null,
        },
      });
      setCreating(false);
      setValues({
        driverId: "",
        vehicleId: "",
        startsAt: "",
        endsAt: "",
        notes: "",
      });
      setSuccess("Asignación creada.");
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo crear la asignación.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function finish(item: AssignmentRow) {
    try {
      setError("");
      const endsAt = new Date().toISOString();
      validAssignmentPeriod(item.startsAt, endsAt);
      await commandMasterData({
        action: "end_assignment",
        resource: "driver_vehicle_assignments",
        organizationId,
        entityId: item.id,
        values: { ends_at: endsAt },
      });
      setSuccess("Asignación finalizada; su historial se conserva.");
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo finalizar la asignación.",
      );
    }
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Datos maestros</span>
          <h1>Asignaciones conductor–vehículo</h1>
        </div>
        <button className="button" onClick={() => setCreating(true)}>
          Nueva asignación
        </button>
      </div>
      {error && <p className="error-banner" role="alert">{error}</p>}
      {success && <p className="success-banner" role="status">{success}</p>}
      {loading
        ? <div className="list-state" aria-busy="true">Cargando…</div>
        : items.length === 0
        ? <div className="panel empty-state">Todavía no hay asignaciones.</div>
        : (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Conductor</th>
                  <th>Vehículo</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.driverName}</td>
                    <td>{item.vehiclePlate}</td>
                    <td>{new Date(item.startsAt).toLocaleString("es-ES")}</td>
                    <td>
                      {item.endsAt
                        ? new Date(item.endsAt).toLocaleString("es-ES")
                        : "Vigente"}
                    </td>
                    <td>
                      {!item.endsAt && (
                        <button
                          className="button button-secondary"
                          onClick={() => void finish(item)}
                        >
                          Finalizar
                        </button>
                      )}
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
        <div
          className="dialog-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Nueva asignación"
        >
          <form
            className="panel dialog-panel master-data-form"
            onSubmit={create}
          >
            <h2>Nueva asignación</h2>
            <div className="form-grid">
              <label>
                Conductor<select
                  required
                  value={values.driverId}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      driverId: event.target.value,
                    }))}
                >
                  <option value="">Seleccionar</option>
                  {drivers.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Vehículo<select
                  required
                  value={values.vehicleId}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      vehicleId: event.target.value,
                    }))}
                >
                  <option value="">Seleccionar</option>
                  {vehicles.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Inicio<input
                  required
                  type="datetime-local"
                  value={values.startsAt}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      startsAt: event.target.value,
                    }))}
                />
              </label>
              <label>
                Fin opcional<input
                  type="datetime-local"
                  value={values.endsAt}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      endsAt: event.target.value,
                    }))}
                />
              </label>
              <label className="full-field">
                Notas<textarea
                  value={values.notes}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))}
                />
              </label>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setCreating(false)}
              >
                Cancelar
              </button>
              <button className="button" disabled={saving}>
                {saving ? "Guardando…" : "Crear asignación"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
