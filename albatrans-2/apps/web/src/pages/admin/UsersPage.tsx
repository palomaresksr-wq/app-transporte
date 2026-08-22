import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "../../auth/AuthContext";
import {
  companyUserAction,
  createCompanyUser,
  listCompanyUsers,
  resetCompanyUserPassword,
  updateCompanyUser,
} from "../../data/user-management-repository";
import type {
  CompanyUserListItem,
  OrganizationRole,
} from "@albatrans/contracts";
import { useParams } from "react-router-dom";

export function UsersRoute({ platform = false }: { platform?: boolean }) {
  const params = useParams();
  return (
    <UsersPage organizationId={platform ? params.organizationId : undefined} />
  );
}

export function UsersPage({ organizationId }: { organizationId?: string }) {
  const { access } = useAuth();
  const org = organizationId ?? access?.organization?.id;
  const [items, setItems] = useState<CompanyUserListItem[]>([]),
    [query, setQuery] = useState(""),
    [role, setRole] = useState(""),
    [status, setStatus] = useState(""),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<CompanyUserListItem | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = useCallback(
    async () => setItems(await listCompanyUsers(org)),
    [org],
  );
  useEffect(() => {
    refresh().catch((cause: unknown) => setError(message(cause)));
  }, [refresh]);
  const filtered = useMemo(
    () =>
      items.filter((item) =>
        (!query ||
          `${item.displayName} ${item.email}`.toLowerCase().includes(
            query.toLowerCase(),
          )) &&
        (!role || item.role === role) &&
        (!status || item.lifecycleStatus === status)
      ),
    [items, query, role, status],
  );
  async function action(
    item: CompanyUserListItem,
    operation: "block_user" | "reactivate_user" | "deactivate_user",
  ) {
    if (
      operation !== "reactivate_user" && !confirm(
        operation === "block_user"
          ? "¿Bloquear el acceso de este usuario?"
          : "¿Dar de baja conservando todo su histórico?",
      )
    ) return;
    setBusy(true);
    try {
      await companyUserAction(operation, item.userId, org);
      await refresh();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  async function reset(item: CompanyUserListItem) {
    const password = prompt("Nueva contraseña temporal (mínimo 12 caracteres)");
    if (!password) return;
    try {
      await resetCompanyUserPassword(item.userId, password, true, org);
      alert(
        "Contraseña temporal establecida. No se almacenará ni volverá a mostrarse.",
      );
    } catch (cause) {
      setError(message(cause));
    }
  }
  return (
    <main className="platform-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Administración</span>
          <h1>Usuarios</h1>
          <p>Altas directas, sin correo de confirmación.</p>
        </div>
        <button className="button" onClick={() => setOpen(true)}>
          + Crear usuario
        </button>
      </div>
      {error && <p role="alert" className="error-banner">{error}</p>}
      <div className="filter-bar">
        <input
          aria-label="Buscar usuarios"
          placeholder="Nombre o email"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="Filtrar por rol"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        >
          <option value="">Todos los roles</option>
          <option value="admin_empresa">Administrador</option>
          <option value="conductor">Conductor</option>
        </select>
        <select
          aria-label="Filtrar por estado"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="blocked">Bloqueado</option>
          <option value="deactivated">Baja</option>
        </select>
      </div>
      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Último acceso</th>
              <th>Alta</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.userId}>
                <td>{item.displayName}</td>
                <td>{item.email}</td>
                <td>
                  {item.role === "admin_empresa"
                    ? "Administrador"
                    : "Conductor"}
                </td>
                <td>{item.lifecycleStatus}</td>
                <td>
                  {item.lastAccessAt
                    ? new Date(item.lastAccessAt).toLocaleString("es-ES")
                    : "—"}
                </td>
                <td>{new Date(item.createdAt).toLocaleDateString("es-ES")}</td>
                <td className="action-row">
                  <button
                    className="button button-secondary"
                    onClick={() => setEditing(item)}
                  >
                    Editar
                  </button>
                  {item.lifecycleStatus === "active"
                    ? (
                      <button
                        disabled={busy}
                        className="button button-secondary"
                        onClick={() => void action(item, "block_user")}
                      >
                        Bloquear
                      </button>
                    )
                    : (
                      <button
                        disabled={busy}
                        className="button button-secondary"
                        onClick={() => void action(item, "reactivate_user")}
                      >
                        Reactivar
                      </button>
                    )}
                  <button
                    className="button button-secondary"
                    onClick={() => void reset(item)}
                  >
                    Restablecer contraseña
                  </button>
                  <button
                    disabled={busy || item.lifecycleStatus === "deactivated"}
                    className="button button-secondary"
                    onClick={() => void action(item, "deactivate_user")}
                  >
                    Dar de baja
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <CreateUserDialog
          organizationId={org}
          close={() => setOpen(false)}
          created={refresh}
        />
      )}
      {editing && (
        <EditUserDialog
          item={editing}
          organizationId={org}
          close={() => setEditing(null)}
          saved={refresh}
        />
      )}
    </main>
  );
}

function EditUserDialog(
  { item, organizationId, close, saved }: {
    item: CompanyUserListItem;
    organizationId?: string;
    close: () => void;
    saved: () => Promise<void>;
  },
) {
  const [firstName, setFirstName] = useState(item.firstName),
    [lastName, setLastName] = useState(item.lastName),
    [phone, setPhone] = useState(item.phone ?? ""),
    [locale, setLocale] = useState("es"),
    [timezone, setTimezone] = useState("Europe/Madrid"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await updateCompanyUser(item.userId, {
        firstName,
        lastName,
        phone,
        locale,
        timezone,
      }, organizationId);
      await saved();
      close();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop" role="presentation">
      <form
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Editar usuario"
        onSubmit={submit}
      >
        <div className="section-heading">
          <h2>Editar usuario</h2>
          <button
            type="button"
            className="button button-secondary"
            onClick={close}
          >
            Cerrar
          </button>
        </div>
        {error && <p role="alert" className="error-banner">{error}</p>}
        <label>
          Nombre<input
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </label>
        <label>
          Apellidos<input
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </label>
        <label>
          Email<input disabled value={item.email} />
        </label>
        <label>
          Rol<input
            disabled
            value={item.role === "admin_empresa"
              ? "Administrador"
              : "Conductor"}
          />
        </label>
        <label>
          Teléfono<input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
        <label>
          Idioma<input
            value={locale}
            onChange={(event) => setLocale(event.target.value)}
          />
        </label>
        <label>
          Zona horaria<input
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          />
        </label>
        <button className="button" disabled={busy}>
          {busy ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}

function CreateUserDialog(
  { organizationId, close, created }: {
    organizationId?: string;
    close: () => void;
    created: () => Promise<void>;
  },
) {
  const [firstName, setFirst] = useState(""),
    [lastName, setLast] = useState(""),
    [email, setEmail] = useState(""),
    [phone, setPhone] = useState(""),
    [role, setRole] = useState<OrganizationRole>("conductor"),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirm] = useState(""),
    [must, setMust] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      return setError("Las contraseñas no coinciden.");
    }
    setBusy(true);
    try {
      await createCompanyUser({
        organizationId,
        firstName,
        lastName,
        email,
        phone,
        role,
        password,
        mustChangePassword: must,
        idempotencyKey: crypto.randomUUID(),
      });
      await created();
      close();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop" role="presentation">
      <form
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Crear usuario"
        onSubmit={submit}
      >
        <div className="section-heading">
          <h2>Crear usuario</h2>
          <button
            type="button"
            className="button button-secondary"
            onClick={close}
          >
            Cerrar
          </button>
        </div>
        {error && <p role="alert" className="error-banner">{error}</p>}
        <label>
          Nombre<input
            required
            value={firstName}
            onChange={(event) => setFirst(event.target.value)}
          />
        </label>
        <label>
          Apellidos<input
            required
            value={lastName}
            onChange={(event) => setLast(event.target.value)}
          />
        </label>
        <label>
          Email<input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Teléfono opcional<input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
        <label>
          Rol<select
            value={role}
            onChange={(event) =>
              setRole(event.target.value as OrganizationRole)}
          >
            <option value="conductor">Conductor</option>
            <option value="admin_empresa">Administrador empresa</option>
          </select>
        </label>
        <label>
          Contraseña inicial<input
            required
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label>
          Confirmar contraseña<input
            required
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={must}
            onChange={(event) => setMust(event.target.checked)}
          />Obligar cambio al primer acceso
        </label>
        <button className="button" disabled={busy}>
          {busy ? "Creando…" : "Crear usuario"}
        </button>
      </form>
    </div>
  );
}
function message(cause: unknown) {
  return cause instanceof Error ? cause.message : "Operación no disponible.";
}
