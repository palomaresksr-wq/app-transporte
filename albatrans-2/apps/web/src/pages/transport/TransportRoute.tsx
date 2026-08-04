import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { TransportOrdersPage } from "./TransportOrdersPage";
import { TransportOrderDetailPage } from "./TransportOrderDetailPage";
export function TransportRoute(
  { platform = false, detail = false }: {
    platform?: boolean;
    detail?: boolean;
  },
) {
  const { access } = useAuth(), params = useParams();
  const organizationId = platform
    ? params.organizationId
    : access?.organization?.id;
  if (!organizationId) {
    return (
      <Navigate
        to={platform ? "/platform/organizations" : "/empresa"}
        replace
      />
    );
  }
  if (!platform && !access?.enabledModules.includes("transport_management")) {
    return (
      <section className="panel">
        <h1>Módulo no disponible</h1>
        <p>La gestión de transportes está desactivada para tu empresa.</p>
      </section>
    );
  }
  return detail && params.orderId
    ? (
      <TransportOrderDetailPage
        organizationId={organizationId}
        orderId={params.orderId}
        platform={platform}
        executionEnabled={access?.enabledModules.includes("transport_execution") === true}
      />
    )
    : (
      <TransportOrdersPage
        organizationId={organizationId}
        platform={platform}
      />
    );
}
