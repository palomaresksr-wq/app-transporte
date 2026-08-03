import type { PlatformDashboardMetrics } from "@albatrans/contracts";
import { hasPlatformActivity } from "@albatrans/domain";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadPlatformDashboardMetrics } from "../../data/platform-dashboard-repository";

interface DashboardPageProps {
  loadMetrics?: () => Promise<PlatformDashboardMetrics>;
}

const METRICS: readonly {
  key: keyof PlatformDashboardMetrics;
  label: string;
  detail: string;
  tone: "default" | "success" | "warning";
}[] = [
  {
    key: "totalOrganizations",
    label: "Organizaciones",
    detail: "Total registrado",
    tone: "default"
  },
  {
    key: "activeOrganizations",
    label: "Activas",
    detail: "Operativas ahora",
    tone: "success"
  },
  {
    key: "restrictedOrganizations",
    label: "Restringidas",
    detail: "Bloqueadas o suspendidas",
    tone: "warning"
  },
  {
    key: "totalUsers",
    label: "Usuarios",
    detail: "Perfiles totales",
    tone: "default"
  },
  {
    key: "organizationAdmins",
    label: "Administradores",
    detail: "Administradores de empresa",
    tone: "default"
  },
  {
    key: "drivers",
    label: "Conductores",
    detail: "Membresías de conductor",
    tone: "default"
  }
];

export function DashboardPage({
  loadMetrics = loadPlatformDashboardMetrics
}: DashboardPageProps) {
  const [metrics, setMetrics] = useState<PlatformDashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMetrics(await loadMetrics());
    } catch (caught) {
      setMetrics(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudieron cargar las métricas."
      );
    } finally {
      setLoading(false);
    }
  }, [loadMetrics]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section aria-labelledby="dashboard-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Vista general</p>
          <h1 id="dashboard-title">Buenos días</h1>
          <p>
            Estado actual de organizaciones y usuarios en Albatrans 2.0.
          </p>
        </div>
        <div className="heading-actions">
        <Link className="button" to="/platform/empresas/nueva">
          Nueva empresa
        </Link>
        <button
          className="button button-secondary"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
        </div>
      </div>

      {loading ? <DashboardSkeleton /> : null}
      {!loading && error ? (
        <DashboardError message={error} retry={refresh} />
      ) : null}
      {!loading && metrics ? (
        <>
          {!hasPlatformActivity(metrics) ? (
            <div className="dashboard-empty" role="status">
              <span aria-hidden="true">◇</span>
              <div>
                <h2>La plataforma aún está vacía</h2>
                <p>
                  Las métricas aparecerán cuando existan organizaciones y
                  usuarios.
                </p>
              </div>
            </div>
          ) : null}
          <div className="metrics-grid" aria-label="Métricas de plataforma">
            {METRICS.map(({ key, label, detail, tone }) => (
              <article className={`metric-card metric-${tone}`} key={key}>
                <div className="metric-icon" aria-hidden="true">
                  {tone === "warning" ? "!" : "•"}
                </div>
                <span>{label}</span>
                <strong>{metrics[key].toLocaleString("es-ES")}</strong>
                <small>{detail}</small>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="metrics-grid" aria-label="Cargando métricas" aria-busy="true">
      {METRICS.map(({ key }) => (
        <div className="metric-card metric-skeleton" key={key}>
          <span />
          <strong />
          <small />
        </div>
      ))}
    </div>
  );
}

function DashboardError({
  message,
  retry
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="dashboard-error" role="alert">
      <span aria-hidden="true">!</span>
      <div>
        <h2>No se pudo cargar el resumen</h2>
        <p>{message}</p>
        <button className="button" onClick={retry}>
          Reintentar
        </button>
      </div>
    </div>
  );
}
