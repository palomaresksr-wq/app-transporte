import type { OrganizationDetail } from "@albatrans/contracts";
import { formatLimitUsage } from "@albatrans/domain";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { loadOrganizationDetail } from "../../data/organization-detail-repository";
import { OrganizationStatusActions } from "./OrganizationStatusActions";
import { OrganizationSubscriptionManager } from "./OrganizationSubscriptionManager";
import { OrganizationModulesManager } from "./OrganizationModulesManager";
import { OrganizationAdministratorsManager } from "./OrganizationAdministratorsManager";
import { OrganizationDriversManager } from "./OrganizationDriversManager";
import { OrganizationLimitsManager } from "./OrganizationLimitsManager";

export function OrganizationDetailPage(
  { loader = loadOrganizationDetail }: {
    loader?: (id: string) => Promise<OrganizationDetail | null>;
  },
) {
  const { organizationId } = useParams();
  const [searchParams] = useSearchParams();
  const [detail, setDetail] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let active = true;
    if (!organizationId) {
      setMissing(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    void loader(organizationId).then((value) => {
      if (active) {
        setDetail(value);
        setMissing(!value);
      }
    }).catch((caught) => {
      if (active) {
        setError(
          caught instanceof Error
            ? caught.message
            : "No se pudo cargar la empresa.",
        );
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [loader, organizationId]);
  if (loading) {
    return (
      <div className="list-state" aria-busy="true">
        Cargando detalle de empresa…
      </div>
    );
  }
  if (error) {
    return (
      <div className="list-state list-error" role="alert">
        <h2>No se pudo cargar la empresa</h2>
        <p>{error}</p>
      </div>
    );
  }
  if (missing || !detail) {
    return (
      <div className="list-state">
        <h1>Empresa no encontrada</h1>
        <Link className="button" to="/platform/organizations">
          Volver al listado
        </Link>
      </div>
    );
  }
  const { organization, subscription } = detail;
  return (
    <section className="detail-page">
      {searchParams.get("updated") === "1"
        ? (
          <p className="success-banner" role="status">
            Empresa actualizada correctamente.
          </p>
        )
        : null}
      <div className="page-heading">
        <div>
          <Link className="text-link" to="/platform/organizations">
            ← Volver a empresas
          </Link>
          <p className="eyebrow">Detalle de empresa</p>
          <h1>{organization.tradeName ?? organization.legalName}</h1>
          <p>{organization.legalName}</p>
        </div>
        <Link
          className="button button-secondary"
          to={`/platform/organizations/${organization.id}/edit`}
        >
          Editar empresa
        </Link>
      </div>
      <OrganizationStatusActions
        organization={organization}
        onChanged={async () => {
          if (!organizationId) return;
          const refreshed = await loader(organizationId);
          setDetail(refreshed);
          setMissing(!refreshed);
        }}
      />
      <nav className="detail-shortcuts">
        {["Módulos", "Administradores", "Conductores", "Pagos"].map((label) => (
          <button key={label} disabled>{label}</button>
        ))}
      </nav>
      <Section title="Núcleo de transporte">
        <nav className="master-data-nav">
          <Link to={`/platform/organizations/${organization.id}/transport`}>
            Órdenes de transporte
          </Link>
        </nav>
      </Section>
      <Section title="Datos maestros">
        <nav className="master-data-nav">
          {[
            ["drivers", "Conductores operativos"],
            ["clients", "Clientes"],
            ["client_contacts", "Contactos"],
            ["locations", "Ubicaciones"],
            ["vehicles", "Vehículos"],
            ["trailers", "Remolques"],
          ].map(([resource, label]) => (
            <Link
              key={resource}
              to={`/platform/organizations/${organization.id}/master-data/${resource}`}
            >
              {label}
            </Link>
          ))}
          <Link to={`/platform/organizations/${organization.id}/assignments`}>
            Asignaciones
          </Link>
        </nav>
      </Section>
      <Section title="Resumen general">
        <dl className="detail-grid">
          <Datum label="Nombre comercial" value={organization.tradeName} />
          <Datum label="Razón social" value={organization.legalName} />
          <Datum label="NIF/CIF" value={organization.taxId} />
          <Datum label="País" value={organization.countryCode} />
          <Datum label="Moneda" value={organization.currencyCode} />
          <Datum label="Fecha de alta" value={date(organization.createdAt)} />
          <Datum
            label="Última actualización"
            value={date(organization.updatedAt)}
          />
          <Datum label="Estado" value={organization.status} />
          <Datum label="Motivo" value={organization.statusReason} />
        </dl>
      </Section>
      <Section title="Suscripción">
        {subscription
          ? (
            <dl className="detail-grid">
              <Datum label="Plan actual" value={subscription.planName} />
              <Datum label="Estado" value={subscription.status} />
              <Datum label="Pago" value={subscription.paymentStatus} />
              <Datum label="Inicio" value={date(subscription.startsAt)} />
              <Datum
                label="Periodo vigente"
                value={range(
                  subscription.periodStartsAt,
                  subscription.periodEndsAt,
                )}
              />
              <Datum
                label="Pagada hasta"
                value={optionalDate(subscription.paidThrough)}
              />
              <Datum
                label="Periodo de gracia"
                value={optionalDate(subscription.gracePeriodEndsAt)}
              />
              <Datum
                label="Cancelación programada"
                value={subscription.cancelAtPeriodEnd ? "Sí" : "No"}
              />
              <Datum label="Notas" value={subscription.notes} />
            </dl>
          )
          : <p>Sin suscripción configurada.</p>}
      </Section>
      <OrganizationSubscriptionManager
        organizationId={organization.id}
        subscription={subscription}
        onChanged={async () => {
          if (!organizationId) return;
          const refreshed = await loader(organizationId);
          setDetail(refreshed);
          setMissing(!refreshed);
        }}
      />
      <Section title="Uso y límites">
        <div className="usage-grid">
          {detail.limits.map((limit) => (
            <article key={limit.code}>
              <span>{limit.name}</span>
              <strong>{formatLimitUsage(limit)}</strong>
              <small>
                {limit.source === "unconfigured"
                  ? "Sin configuración"
                  : `${limit.percentage ?? 0}% usado · ${limit.source}`}
              </small>
              {limit.percentage !== null
                ? <progress max="100" value={limit.percentage} />
                : null}
            </article>
          ))}
        </div>
      </Section>
      <OrganizationLimitsManager
        organizationId={organization.id}
        limits={detail.limits}
        onChanged={async () => {
          if (!organizationId) return;
          const refreshed = await loader(organizationId);
          setDetail(refreshed);
          setMissing(!refreshed);
        }}
      />
      <OrganizationModulesManager
        organizationId={organization.id}
        modules={detail.modules}
        onChanged={async () => {
          if (!organizationId) return;
          const refreshed = await loader(organizationId);
          setDetail(refreshed);
          setMissing(!refreshed);
        }}
      />
      <OrganizationAdministratorsManager
        organizationId={organization.id}
        onChanged={async () => {
          if (!organizationId) return;
          const refreshed = await loader(organizationId);
          setDetail(refreshed);
          setMissing(!refreshed);
        }}
      />
      <OrganizationDriversManager
        organizationId={organization.id}
        onChanged={async () => {
          if (!organizationId) return;
          const refreshed = await loader(organizationId);
          setDetail(refreshed);
          setMissing(!refreshed);
        }}
      />
      <Section title="Usuarios">
        <p>
          <strong>{detail.activeAdminCount}</strong> administradores ·{" "}
          <strong>{detail.activeDriverCount}</strong> conductores
        </p>
        {detail.members.length
          ? (
            <ul className="member-list">
              {detail.members.map((member) => (
                <li key={member.id}>
                  <strong>{member.displayName}</strong>
                  <span>{member.role} · {optionalDate(member.joinedAt)}</span>
                </li>
              ))}
            </ul>
          )
          : <p>Sin memberships activas.</p>}
      </Section>
      <Section title="Auditoría resumida">
        {detail.audit.length
          ? (
            <ul className="audit-list">
              {detail.audit.map((event) => (
                <li key={event.id}>
                  <div>
                    <strong>{event.action}</strong>
                    <span>{event.entityType} · {event.actorScope}</span>
                  </div>
                  <time>{dateTime(event.occurredAt)}</time>
                </li>
              ))}
            </ul>
          )
          : <p>Sin eventos relacionados.</p>}
      </Section>
    </section>
  );
}
function Section(
  { title, children }: { title: string; children: React.ReactNode },
) {
  return (
    <section className="detail-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function Datum({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
function date(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(
    new Date(value),
  );
}
function dateTime(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
function optionalDate(value: string | null) {
  return value ? date(value) : "—";
}
function range(start: string | null, end: string | null) {
  return start || end ? `${optionalDate(start)} — ${optionalDate(end)}` : "—";
}
