import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function SuperadminLayout() {
  const { access, signOut } = useAuth();
  return <div className="platform-layout"><aside className="platform-sidebar">
    <div className="platform-brand"><span className="brand-mark small">A</span><div><strong>Albatrans</strong><span>Superadmin</span></div></div>
    <nav className="platform-nav" aria-label="Navegación principal">
      <NavLink to="/platform" end><span aria-hidden="true">⌂</span>Resumen</NavLink>
      <NavLink to="/platform/organizations"><span aria-hidden="true">▦</span>Empresas</NavLink>
      <NavLink to="/platform/empresas/nueva"><span aria-hidden="true">＋</span>Nueva empresa</NavLink>
    </nav><div className="sidebar-footer"><span>Entorno local</span><strong>Fase 2</strong></div>
  </aside><div className="platform-main"><header className="platform-header"><div><span className="eyebrow">Panel de plataforma</span><strong>Control operativo</strong></div><div className="platform-user"><span className="user-avatar" aria-hidden="true">{access?.profile.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{access?.profile.displayName}</strong><span>Superadministrador</span></div><button className="button button-secondary" onClick={signOut}>Cerrar sesión</button></div></header><main className="platform-content"><Outlet /></main></div></div>;
}
