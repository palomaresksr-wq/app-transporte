import type { ModuleCode } from "@albatrans/contracts";
import { resourceModule } from "@albatrans/domain";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { MasterDataPage } from "./MasterDataPage";
import { AssignmentsPage } from "./AssignmentsPage";

const resources = [
  "drivers",
  "clients",
  "client_contacts",
  "locations",
  "vehicles",
  "trailers",
] as const;
type PageResource = (typeof resources)[number];
export function MasterDataRoute({ platform = false }: { platform?: boolean }) {
  const { access } = useAuth(),
    params = useParams(),
    resource = isResource(params.resource) ? params.resource : null;
  const organizationId = platform
    ? params.organizationId
    : access?.organization?.id;
  if (!resource || !organizationId) {
    return (
      <Navigate
        to={platform ? "/platform/organizations" : "/empresa"}
        replace
      />
    );
  }
  const required: ModuleCode = resourceModule(resource);
  if (!platform && !access?.enabledModules.includes(required)) {
    return (
      <section className="panel">
        <h1>Módulo no disponible</h1>
        <p>Este módulo está desactivado para tu empresa.</p>
      </section>
    );
  }
  return <MasterDataPage organizationId={organizationId} resource={resource} />;
}
export function AssignmentsRoute({ platform = false }: { platform?: boolean }) {
  const { access } = useAuth();
  const params = useParams();
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
  if (!platform && !access?.enabledModules.includes("vehicle_management")) {
    return (
      <section className="panel">
        <h1>Módulo no disponible</h1>
        <p>El módulo de vehículos está desactivado para tu empresa.</p>
      </section>
    );
  }
  return <AssignmentsPage organizationId={organizationId} />;
}
function isResource(value: string | undefined): value is PageResource {
  return resources.some((resource) => resource === value);
}
