import type { MasterDataResource } from "@albatrans/contracts";
import {
  MasterDataValidationError,
  nonNegative,
  requiredText,
  validCoordinates,
} from "@albatrans/domain";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  commandMasterData,
  loadMasterData,
  loadMasterDataOptions,
  loadMasterDataRecord,
  type MasterDataOption,
  type MasterDataRow,
  type MasterDataValues,
} from "../../data/master-data-repository";

type Resource = Exclude<MasterDataResource, "driver_vehicle_assignments">;
type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "date"
    | "number"
    | "textarea"
    | "checkbox"
    | "select";
  required?: boolean;
  options?: readonly { value: string; label: string }[];
  optionKind?: "clients" | "memberships";
};
const commonStatus = [{ value: "active", label: "Activo" }, {
  value: "inactive",
  label: "Inactivo",
}, { value: "archived", label: "Archivado" }] as const;
const fleetStatus = [...commonStatus.slice(0, 2), {
  value: "maintenance",
  label: "Mantenimiento",
}, commonStatus[2]] as const;
const driverStatus = [
  "pending",
  "active",
  "inactive",
  "on_leave",
  "terminated",
  "archived",
].map((value) => ({ value, label: value.replace("_", " ") }));
const configs: Record<
  Resource,
  { title: string; singular: string; fields: readonly Field[] }
> = {
  drivers: {
    title: "Conductores operativos",
    singular: "conductor",
    fields: [
      { name: "first_name", label: "Nombre", required: true },
      { name: "last_name", label: "Apellidos", required: true },
      { name: "display_name", label: "Nombre visible", required: true },
      { name: "employee_number", label: "Número de empleado" },
      { name: "internal_reference", label: "Referencia interna" },
      {
        name: "membership_id",
        label: "Cuenta de acceso vinculada",
        type: "select",
        optionKind: "memberships",
      },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Teléfono" },
      { name: "license_number", label: "Permiso de conducir" },
      {
        name: "license_expires_at",
        label: "Vencimiento del permiso",
        type: "date",
      },
      {
        name: "employment_status",
        label: "Estado laboral",
        type: "select",
        options: driverStatus,
        required: true,
      },
      { name: "active_from", label: "Activo desde", type: "date" },
      { name: "active_until", label: "Activo hasta", type: "date" },
      { name: "notes", label: "Notas", type: "textarea" },
    ],
  },
  clients: {
    title: "Clientes",
    singular: "cliente",
    fields: [
      { name: "legal_name", label: "Razón social", required: true },
      { name: "trade_name", label: "Nombre comercial", required: true },
      { name: "tax_id", label: "NIF/CIF" },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Teléfono" },
      { name: "billing_email", label: "Email de facturación", type: "email" },
      { name: "payment_terms_days", label: "Días de pago", type: "number" },
      {
        name: "status",
        label: "Estado",
        type: "select",
        options: commonStatus,
        required: true,
      },
      { name: "external_reference", label: "Referencia externa" },
      { name: "notes", label: "Notas", type: "textarea" },
    ],
  },
  client_contacts: {
    title: "Contactos de clientes",
    singular: "contacto",
    fields: [
      {
        name: "client_id",
        label: "Cliente",
        type: "select",
        optionKind: "clients",
        required: true,
      },
      { name: "name", label: "Nombre", required: true },
      { name: "role", label: "Cargo" },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Teléfono" },
      { name: "is_primary", label: "Contacto principal", type: "checkbox" },
      { name: "notes", label: "Notas", type: "textarea" },
    ],
  },
  locations: {
    title: "Ubicaciones",
    singular: "ubicación",
    fields: [
      {
        name: "client_id",
        label: "Cliente",
        type: "select",
        optionKind: "clients",
      },
      { name: "name", label: "Nombre", required: true },
      { name: "address_line_1", label: "Dirección", required: true },
      { name: "address_line_2", label: "Dirección adicional" },
      { name: "postal_code", label: "Código postal", required: true },
      { name: "city", label: "Ciudad", required: true },
      { name: "region", label: "Provincia o región" },
      { name: "country_code", label: "País (ISO 2)", required: true },
      { name: "latitude", label: "Latitud", type: "number" },
      { name: "longitude", label: "Longitud", type: "number" },
      { name: "instructions", label: "Instrucciones", type: "textarea" },
      {
        name: "status",
        label: "Estado",
        type: "select",
        options: commonStatus,
        required: true,
      },
    ],
  },
  vehicles: {
    title: "Vehículos",
    singular: "vehículo",
    fields: fleetFields("vehicle_type", "Tipo de vehículo"),
  },
  trailers: {
    title: "Remolques",
    singular: "remolque",
    fields: fleetFields("trailer_type", "Tipo de remolque"),
  },
};
function fleetFields(typeName: string, typeLabel: string): readonly Field[] {
  return [
    { name: "registration_plate", label: "Matrícula", required: true },
    { name: "internal_code", label: "Código interno" },
    { name: typeName, label: typeLabel, required: true },
    { name: "brand", label: "Marca" },
    { name: "model", label: "Modelo" },
    { name: "capacity_kg", label: "Capacidad (kg)", type: "number" },
    { name: "capacity_m3", label: "Capacidad (m³)", type: "number" },
    {
      name: "status",
      label: "Estado",
      type: "select",
      options: fleetStatus,
      required: true,
    },
    { name: "inspection_expires_at", label: "Vencimiento ITV", type: "date" },
    { name: "insurance_expires_at", label: "Vencimiento seguro", type: "date" },
    { name: "notes", label: "Notas", type: "textarea" },
  ];
}

export function MasterDataPage(
  { organizationId, resource }: { organizationId: string; resource: Resource },
) {
  const config = configs[resource],
    [items, setItems] = useState<MasterDataRow[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [editor, setEditor] = useState<
      { id?: string; values: MasterDataValues } | null
    >(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await loadMasterData({
        organizationId,
        resource,
        search,
        status,
        page,
        pageSize: 20,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudieron cargar los datos.",
      );
    } finally {
      setLoading(false);
    }
  }, [organizationId, resource, search, status, page]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function edit(item: MasterDataRow) {
    setError("");
    try {
      const values = await loadMasterDataRecord(resource, item.id);
      if (!values) throw new Error("El registro ya no existe.");
      setEditor({ id: item.id, values });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo cargar el registro.",
      );
    }
  }
  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Datos maestros</span>
          <h1>{config.title}</h1>
        </div>
        <button
          className="button"
          onClick={() => setEditor({ values: defaults(resource) })}
        >
          Nuevo {config.singular}
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
        {resource !== "client_contacts" && (
          <label>
            Estado<select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Todos</option>
              {(resource === "drivers"
                ? driverStatus
                : resource === "vehicles" || resource === "trailers"
                ? fleetStatus
                : commonStatus).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>
      {error && <p className="error-banner" role="alert">{error}</p>}
      {success && <p className="success-banner" role="status">{success}</p>}
      {loading
        ? <div className="list-state" aria-busy="true">Cargando…</div>
        : items.length === 0
        ? (
          <div className="panel empty-state">
            {search || status !== "all"
              ? "No hay resultados para los filtros."
              : "Todavía no hay registros."}
          </div>
        )
        : (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Referencia</th>
                  <th>Estado</th>
                  <th>Actualizado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>{item.subtitle}</td>
                    <td>
                      <span className="status-pill">{item.status}</span>
                    </td>
                    <td>
                      {new Date(item.updatedAt).toLocaleDateString("es-ES")}
                    </td>
                    <td>
                      <button
                        className="button button-secondary"
                        onClick={() => void edit(item)}
                      >
                        Editar
                      </button>
                      {item.status !== "archived" &&
                        resource !== "client_contacts" && (
                        <button
                          className="button button-secondary"
                          onClick={async () => {
                            try {
                              await commandMasterData({
                                action: "archive",
                                resource,
                                organizationId,
                                entityId: item.id,
                                reason: "Archivado desde Datos Maestros",
                              });
                              setSuccess("Registro archivado.");
                              await refresh();
                            } catch (caught) {
                              setError(
                                caught instanceof Error
                                  ? caught.message
                                  : "No se pudo archivar.",
                              );
                            }
                          }}
                        >
                          Archivar
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
      {editor && (
        <Editor
          organizationId={organizationId}
          resource={resource}
          current={editor}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null);
            setSuccess("Cambios guardados.");
            await refresh();
          }}
        />
      )}
    </section>
  );
}

function Editor({
  organizationId,
  resource,
  current,
  onClose,
  onSaved,
}: {
  organizationId: string;
  resource: Resource;
  current: { id?: string; values: MasterDataValues };
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const config = configs[resource],
    [values, setValues] = useState(current.values),
    [options, setOptions] = useState<
      Partial<Record<"clients" | "memberships", MasterDataOption[]>>
    >({}),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const kinds = [
      ...new Set(
        config.fields.flatMap((field) =>
          field.optionKind ? [field.optionKind] : []
        ),
      ),
    ];
    for (const kind of kinds) {
      void loadMasterDataOptions(organizationId, kind).then((result) =>
        setOptions((existing) => ({ ...existing, [kind]: result }))
      ).catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "No se pudieron cargar las opciones.",
        )
      );
    }
  }, [config.fields, organizationId]);
  function set(name: string, value: string | number | boolean | null) {
    setValues((existing) => ({ ...existing, [name]: value }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      const validated = validate(resource, config.fields, values);
      await commandMasterData({
        action: current.id ? "update" : "create",
        resource,
        organizationId,
        entityId: current.id,
        values: validated,
      });
      await onSaved();
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
      aria-label={`${current.id ? "Editar" : "Crear"} ${config.singular}`}
    >
      <form className="panel dialog-panel master-data-form" onSubmit={submit}>
        <h2>{current.id ? "Editar" : "Crear"} {config.singular}</h2>
        {error && <p role="alert" className="error-banner">{error}</p>}
        <div className="form-grid">
          {config.fields.map((field) => (
            <FieldControl
              key={field.name}
              field={field}
              value={values[field.name] ?? null}
              options={field.optionKind
                ? options[field.optionKind] ?? []
                : field.options ?? []}
              set={(value) => set(field.name, value)}
            />
          ))}
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
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
function FieldControl(
  { field, value, options, set }: {
    field: Field;
    value: string | number | boolean | null;
    options: readonly MasterDataOption[];
    set: (value: string | number | boolean | null) => void;
  },
) {
  if (field.type === "checkbox") {
    return (
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) => set(event.target.checked)}
        />
        {field.label}
      </label>
    );
  }
  if (field.type === "select") {
    return (
      <label>
        {field.label}
        <select
          required={field.required}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => set(event.target.value || null)}
        >
          <option value="">Sin seleccionar</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (field.type === "textarea") {
    return (
      <label className="full-field">
        {field.label}
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(event) => set(event.target.value)}
        />
      </label>
    );
  }
  return (
    <label>
      {field.label}
      <input
        type={field.type ?? "text"}
        step={field.type === "number" ? "any" : undefined}
        required={field.required}
        value={typeof value === "string" || typeof value === "number"
          ? value
          : ""}
        onChange={(event) =>
          set(
            field.type === "number"
              ? (event.target.value === "" ? null : Number(event.target.value))
              : event.target.value,
          )}
      />
    </label>
  );
}
function defaults(resource: Resource): MasterDataValues {
  if (resource === "drivers") return { employment_status: "pending" };
  if (resource === "client_contacts") return { is_primary: false };
  if (resource === "locations") return { status: "active", country_code: "ES" };
  if (
    resource === "clients" || resource === "vehicles" || resource === "trailers"
  ) return { status: "active" };
  return {};
}
function validate(
  resource: Resource,
  fields: readonly Field[],
  values: MasterDataValues,
): MasterDataValues {
  const clean: MasterDataValues = {};
  for (const field of fields) {
    const value = values[field.name];
    if (field.required) {
      clean[field.name] = requiredText(
        value,
        field.label,
        field.name.endsWith("type") ? 100 : 250,
      );
    } else if (field.type === "number") {
      clean[field.name] = nonNegative(value, field.label);
    } else {
      clean[field.name] = typeof value === "string"
        ? (value.trim() || null)
        : value ?? null;
    }
    const cleanValue = clean[field.name];
    if (
      field.type === "email" && typeof cleanValue === "string" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanValue)
    ) throw new MasterDataValidationError(`${field.label} no es válido.`);
  }
  if (resource === "locations") {
    const coordinates = validCoordinates(clean.latitude, clean.longitude);
    clean.latitude = coordinates.latitude;
    clean.longitude = coordinates.longitude;
    clean.country_code = requiredText(clean.country_code, "País", 2)
      .toUpperCase();
    if (clean.country_code.length !== 2) {
      throw new MasterDataValidationError("El país debe tener dos letras.");
    }
  }
  if (
    resource === "drivers" && typeof clean.active_from === "string" &&
    typeof clean.active_until === "string" &&
    clean.active_until < clean.active_from
  ) {
    throw new MasterDataValidationError(
      "La fecha final no puede ser anterior a la inicial.",
    );
  }
  return clean;
}
