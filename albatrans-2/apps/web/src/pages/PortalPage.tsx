import type { EffectiveRole } from "@albatrans/contracts";
import { useAuth } from "../auth/AuthContext";

const CONTENT: Record<
  EffectiveRole,
  { label: string; title: string; description: string }
> = {
  conductor: {
    label: "Portal conductor",
    title: "Tu jornada, preparada",
    description:
      "Las entregas, fichajes, vacaciones y albaranes se incorporarán por fases sin retirar Albatrans 1."
  },
  admin_empresa: {
    label: "Administración de empresa",
    title: "Todo preparado para tu empresa",
    description:
      "Esta base limita el portal al rol, la membresía activa y la empresa activa del usuario autenticado."
  },
  superadmin: {
    label: "Superadministración",
    title: "Control seguro de la plataforma",
    description:
      "La gestión de empresas y usuarios se incorporará sobre el acceso de plataforma validado."
  }
};

export function PortalPage({
  expectedRole
}: {
  expectedRole: EffectiveRole;
}) {
  const { access, signOut } = useAuth();
  const content = CONTENT[expectedRole];

  return (
    <main className="portal-shell">
      <header className="portal-header">
        <a className="wordmark" href="/">
          Albatrans
        </a>
        <div className="user-actions">
          <span>{access?.profile.displayName}</span>
          <button className="button button-secondary" onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <section className="portal-content">
        <p className="eyebrow">{content.label}</p>
        <h1>{content.title}</h1>
        <p className="lead">{content.description}</p>

        <div className="status-grid">
          <article className="panel status-card">
            <span className="status-dot" aria-hidden="true" />
            <div>
              <h2>Acceso autenticado</h2>
              <p>La sesión procede de Supabase Auth.</p>
            </div>
          </article>
          <article className="panel status-card">
            <span className="status-dot" aria-hidden="true" />
            <div>
              <h2>Rol verificado</h2>
              <p>{access?.effectiveRole}</p>
            </div>
          </article>
          <article className="panel status-card">
            <span className="status-dot" aria-hidden="true" />
            <div>
              <h2>Estado verificado</h2>
              <p>
                {access?.organization
                  ? `Empresa ${access.organization.status}`
                  : "Acceso de plataforma"}
              </p>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
