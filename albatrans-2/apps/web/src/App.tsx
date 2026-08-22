import { effectiveRoleHome } from "@albatrans/domain";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AuthGuard, RoleGuard } from "./auth/RouteGuards";

const ConfigurationPage = lazy(() => import("./pages/ConfigurationPage").then((module) => ({ default: module.ConfigurationPage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const RequestPasswordPage = lazy(() => import("./pages/PasswordPages").then((module) => ({ default: module.RequestPasswordPage })));
const UpdatePasswordPage = lazy(() => import("./pages/PasswordPages").then((module) => ({ default: module.UpdatePasswordPage })));
const PortalPage = lazy(() => import("./pages/PortalPage").then((module) => ({ default: module.PortalPage })));
const SuperadminLayout = lazy(() => import("./layouts/SuperadminLayout").then((module) => ({ default: module.SuperadminLayout })));
const DashboardPage = lazy(() => import("./pages/superadmin/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const CreateOrganizationPage = lazy(() => import("./pages/superadmin/CreateOrganizationPage").then((module) => ({ default: module.CreateOrganizationPage })));
const OrganizationsPage = lazy(() => import("./pages/superadmin/OrganizationsPage").then((module) => ({ default: module.OrganizationsPage })));
const OrganizationDetailPage = lazy(() => import("./pages/superadmin/OrganizationDetailPage").then((module) => ({ default: module.OrganizationDetailPage })));
const EditOrganizationPage = lazy(() => import("./pages/superadmin/EditOrganizationPage").then((module) => ({ default: module.EditOrganizationPage })));
const MasterDataRoute = lazy(() => import("./pages/master-data/MasterDataRoute").then((module) => ({ default: module.MasterDataRoute })));
const AssignmentsRoute = lazy(() => import("./pages/master-data/MasterDataRoute").then((module) => ({ default: module.AssignmentsRoute })));
const TransportRoute = lazy(() => import("./pages/transport/TransportRoute").then((module) => ({ default: module.TransportRoute })));
const BillingRoute = lazy(() => import("./pages/billing/BillingRoute").then((module) => ({ default: module.BillingRoute })));
const ExecutionRoute = lazy(() => import("./pages/execution/ExecutionRoute").then((module) => ({ default: module.ExecutionRoute })));
const DriverPortalRoute = lazy(() => import("./pages/driver/DriverPortal").then((module) => ({ default: module.DriverPortalRoute })));
const UsersRoute = lazy(() => import("./pages/admin/UsersPage").then((module) => ({ default: module.UsersRoute })));
const ChangePasswordPage = lazy(() => import("./pages/ChangePasswordPage").then((module) => ({ default: module.ChangePasswordPage })));
const CompanyOnboardingPage = lazy(() => import("./pages/admin/CompanyOnboardingPage").then((module) => ({ default: module.CompanyOnboardingPage })));

export function App() {
  return (
    <Suspense fallback={<RouteLoading />}><Routes>
      <Route path="/configuracion" element={<ConfigurationPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/recuperar-contrasena"
        element={<RequestPasswordPage />}
      />
      <Route
        path="/restablecer-contrasena"
        element={<UpdatePasswordPage />}
      />

      <Route element={<AuthGuard />}>
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route index element={<HomeRedirect />} />

        <Route element={<RoleGuard allowed={["conductor"]} />}>
          <Route path="/conductor" element={<Navigate to="/driver/transports" replace />} />
          <Route path="/driver" element={<Navigate to="/driver/transports" replace />} />
          <Route path="/driver/transports" element={<DriverPortalRoute />} />
          <Route path="/driver/transports/:orderId" element={<DriverPortalRoute />} />
        </Route>

        <Route element={<RoleGuard allowed={["admin_empresa"]} />}>
          <Route
            path="/empresa"
            element={<PortalPage expectedRole="admin_empresa" />}
          />
          <Route
            path="/empresa/master-data/:resource"
            element={<MasterDataRoute />}
          />
          <Route path="/empresa/assignments" element={<AssignmentsRoute />} />
          <Route path="/empresa/facturacion" element={<BillingRoute />} />
          <Route path="/empresa/transport" element={<TransportRoute />} />
          <Route
            path="/empresa/transport/:orderId"
            element={<TransportRoute detail />}
          />
          <Route path="/empresa/transport/:orderId/execution" element={<ExecutionRoute />} />
          <Route path="/empresa/administracion/usuarios" element={<UsersRoute />} />
          <Route path="/empresa/onboarding" element={<CompanyOnboardingPage />} />
        </Route>

        <Route element={<RoleGuard allowed={["superadmin"]} />}>
          <Route path="/platform" element={<SuperadminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="empresas/nueva" element={<CreateOrganizationPage />} />
            <Route path="organizations" element={<OrganizationsPage />} />
            <Route
              path="organizations/:organizationId"
              element={<OrganizationDetailPage />}
            />
            <Route
              path="organizations/:organizationId/edit"
              element={<EditOrganizationPage />}
            />
            <Route
              path="organizations/:organizationId/master-data/:resource"
              element={<MasterDataRoute platform />}
            />
            <Route
              path="organizations/:organizationId/assignments"
              element={<AssignmentsRoute platform />}
            />
            <Route
              path="organizations/:organizationId/facturacion"
              element={<BillingRoute platform />}
            />
            <Route
              path="organizations/:organizationId/transport"
              element={<TransportRoute platform />}
            />
            <Route
              path="organizations/:organizationId/transport/:orderId"
              element={<TransportRoute platform detail />}
            />
            <Route path="organizations/:organizationId/transport/:orderId/execution" element={<ExecutionRoute platform />} />
            <Route path="organizations/:organizationId/users" element={<UsersRoute platform />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></Suspense>
  );
}

function RouteLoading() {
  return <main className="list-state" role="status" aria-live="polite" aria-busy="true">Cargando sección…</main>;
}

function HomeRedirect() {
  const { access } = useAuth();
  return (
    <Navigate
      to={access ? effectiveRoleHome(access.effectiveRole) : "/login"}
      replace
    />
  );
}
