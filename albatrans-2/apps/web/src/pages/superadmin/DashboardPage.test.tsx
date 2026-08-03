import type { PlatformDashboardMetrics } from "@albatrans/contracts";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DashboardPage } from "./DashboardPage";

const metrics: PlatformDashboardMetrics = {
  totalOrganizations: 12,
  activeOrganizations: 8,
  restrictedOrganizations: 3,
  totalUsers: 64,
  organizationAdmins: 9,
  drivers: 54
};

describe("dashboard de superadmin", () => {
  it("muestra carga y después las seis métricas", async () => {
    let resolveMetrics: ((value: PlatformDashboardMetrics) => void) | undefined;
    const pending = new Promise<PlatformDashboardMetrics>((resolve) => {
      resolveMetrics = resolve;
    });

    renderDashboard(() => pending);
    expect(screen.getByLabelText("Cargando métricas")).toBeInTheDocument();
    resolveMetrics?.(metrics);

    expect(await screen.findByText("64")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Conductores")).toBeInTheDocument();
  });

  it("muestra el estado vacío", async () => {
    renderDashboard(
      async () => ({
          totalOrganizations: 0,
          activeOrganizations: 0,
          restrictedOrganizations: 0,
          totalUsers: 0,
          organizationAdmins: 0,
          drivers: 0
        })
    );
    expect(
      await screen.findByText("La plataforma aún está vacía")
    ).toBeInTheDocument();
  });

  it("muestra el error y permite reintentar", async () => {
    renderDashboard(
        async () => {
          throw new Error("Supabase local no responde");
        }
    );
    expect(
      await screen.findByText("No se pudo cargar el resumen")
    ).toBeInTheDocument();
    expect(screen.getByText("Supabase local no responde")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled();
  });
});

function renderDashboard(loadMetrics: () => Promise<PlatformDashboardMetrics>) {
  render(
    <MemoryRouter initialEntries={["/platform"]}>
      <Routes>
        <Route path="/platform" element={<DashboardPage loadMetrics={loadMetrics} />} />
      </Routes>
    </MemoryRouter>
  );
}
