import type { EffectiveRole } from "@albatrans/contracts";
import {
  canAccessEffectiveRole,
  effectiveRoleHome
} from "@albatrans/domain";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function AuthGuard() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) return <FullPageMessage text="Comprobando tu sesión…" />;
  if (!auth.configured) return <Navigate to="/configuracion" replace />;
  if (!auth.session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (auth.error || !auth.access) {
    return (
      <FullPageMessage
        title="No se puede abrir tu cuenta"
        text={auth.error ?? "Tu acceso no está disponible."}
        action={
          <button className="button button-secondary" onClick={auth.signOut}>
            Cerrar sesión
          </button>
        }
      />
    );
  }

  if (auth.access.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  if (!auth.access.mustChangePassword && auth.access.onboardingRequired && location.pathname !== "/empresa/onboarding") {
    return <Navigate to="/empresa/onboarding" replace />;
  }

  return <Outlet />;
}

export function RoleGuard({
  allowed
}: {
  allowed: readonly EffectiveRole[];
}) {
  const { access } = useAuth();
  if (!access) return <Navigate to="/login" replace />;

  if (!canAccessEffectiveRole(access.effectiveRole, allowed)) {
    return <Navigate to={effectiveRoleHome(access.effectiveRole)} replace />;
  }

  return <Outlet />;
}

function FullPageMessage({
  title,
  text,
  action
}: {
  title?: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <main className="center-page">
      <section className="panel compact-panel">
        <span className="eyebrow">Albatrans 2.0</span>
        <h1>{title ?? "Un momento"}</h1>
        <p>{text}</p>
        {action}
      </section>
    </main>
  );
}
