import type { OrganizationListPage } from "@albatrans/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrganizationsPage } from "./OrganizationsPage";

const page: OrganizationListPage = { total: 1, page: 1, pageSize: 10, items: [{ id: "org-1", legalName: "Transportes Alba SL", tradeName: "Alba", taxId: "B123", status: "active", planCode: "professional", planName: "Professional", paymentStatus: "paid", activeAdminCount: 2, activeDriverCount: 8, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-02-01T00:00:00Z" }] };
afterEach(cleanup);
describe("listado de empresas", () => {
  it("muestra carga y datos completos", async () => { let resolve: ((value: OrganizationListPage) => void) | undefined; const pending = new Promise<OrganizationListPage>((done) => { resolve = done; }); renderPage(() => pending); expect(screen.getByText("Cargando empresas…")).toBeInTheDocument(); resolve?.(page); expect(await screen.findByText("Alba")).toBeInTheDocument(); expect(screen.getByText("Professional")).toBeInTheDocument(); expect(screen.getByText("B123")).toBeInTheDocument(); });
  it("distingue vacío y sin resultados", async () => { const loader = vi.fn().mockResolvedValue({ ...page, total: 0, items: [] }); renderPage(loader); expect(await screen.findByText("Todavía no hay empresas")).toBeInTheDocument(); fireEvent.change(screen.getByPlaceholderText("Nombre, razón social o NIF/CIF"), { target: { value: "Nada" } }); fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" })); expect(await screen.findByText("No hay resultados")).toBeInTheDocument(); });
  it("muestra error y reintento", async () => { renderPage(async () => { throw new Error("Fallo local"); }); expect(await screen.findByText("Fallo local")).toBeInTheDocument(); expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled(); });
});
function renderPage(loader: (filters: Parameters<typeof import("../../data/organization-list-repository").loadOrganizations>[0]) => Promise<OrganizationListPage>) { render(<MemoryRouter><OrganizationsPage loader={loader} /></MemoryRouter>); }
