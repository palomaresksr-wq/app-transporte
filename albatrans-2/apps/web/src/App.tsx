import { effectiveRoleHome } from "@albatrans/domain";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AuthGuard, RoleGuard } from "./auth/RouteGuards";
import { ConfigurationPage } from "./pages/ConfigurationPage";
import { LoginPage } from "./pages/LoginPage";
import {
  RequestPasswordPage,
  UpdatePasswordPage
} from "./pages/PasswordPages";
import { PortalPage } from "./pages/PortalPage";
import { SuperadminLayout } from "./layouts/SuperadminLayout";
import { DashboardPage } from "./pages/superadmin/DashboardPage";
import { CreateOrganizationPage } from "./pages/superadmin/CreateOrganizationPage";
import { OrganizationsPage } from "./pages/superadmin/OrganizationsPage";
import { OrganizationDetailPage } from "./pages/superadmin/OrganizationDetailPage";
import { EditOrganizationPage } from "./pages/superadmin/EditOrganizationPage";

export function App() {
  return (
    <Routes>
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
        <Route index element={<HomeRedirect />} />

        <Route element={<RoleGuard allowed={["conductor"]} />}>
          <Route
            path="/conductor"
            element={<PortalPage expectedRole="conductor" />}
          />
        </Route>

        <Route element={<RoleGuard allowed={["admin_empresa"]} />}>
          <Route
            path="/empresa"
            element={<PortalPage expectedRole="admin_empresa" />}
          />
        </Route>

        <Route element={<RoleGuard allowed={["superadmin"]} />}>
          <Route path="/platform" element={<SuperadminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="empresas/nueva" element={<CreateOrganizationPage />} />
            <Route path="organizations" element={<OrganizationsPage />} />
            <Route path="organizations/:organizationId" element={<OrganizationDetailPage />} />
            <Route path="organizations/:organizationId/edit" element={<EditOrganizationPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
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
