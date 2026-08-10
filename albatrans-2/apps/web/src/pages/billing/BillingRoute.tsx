import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { BillingPage } from "./BillingPage";

export function BillingRoute({ platform = false }: { platform?: boolean }) {
  const { access } = useAuth();
  const params = useParams();
  const organizationId = platform ? params.organizationId : access?.organization?.id;

  if (!organizationId) {
    return <Navigate to={platform ? "/platform/organizations" : "/empresa"} replace />;
  }

  if (!platform && !access?.enabledModules.includes("billing")) {
    return (
      <section className="panel">
        <h1>Módulo no disponible</h1>
        <p>La facturación está desactivada para tu empresa.</p>
      </section>
    );
  }

  return <BillingPage organizationId={organizationId} platform={platform} />;
}