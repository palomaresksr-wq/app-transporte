import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { ExecutionPage } from "./ExecutionPage";
export function ExecutionRoute({ platform = false }: { platform?: boolean }) {
  const { access } = useAuth(), params = useParams();
  const organizationId = platform ? params.organizationId : access?.organization?.id;
  if (!organizationId || !params.orderId) return <Navigate to={platform ? "/platform/organizations" : "/empresa/transport"} replace />;
  if (!platform && !access?.enabledModules.includes("transport_execution")) return <section className="panel"><h1>Módulo no disponible</h1><p>La ejecución de transporte está desactivada para tu empresa.</p></section>;
  return <ExecutionPage organizationId={organizationId} orderId={params.orderId} platform={platform} />;
}
