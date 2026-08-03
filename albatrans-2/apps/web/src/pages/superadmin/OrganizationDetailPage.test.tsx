import type { OrganizationDetail } from "@albatrans/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { OrganizationDetailPage } from "./OrganizationDetailPage";

const detail: OrganizationDetail = {
  organization: { id: "org-1", legalName: "Transportes Alba SL", tradeName: "Alba", taxId: "B123", email: null, phone: null, countryCode: "ES", timezone: "Europe/Madrid", currencyCode: "EUR", status: "active", statusReason: null, statusChangedAt: "2026-01-01T00:00:00Z", statusChangedBy: null, internalNotes: null, createdBy: "user-1", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-02-01T00:00:00Z", archivedAt: null },
  subscription: null,
  limits: [{ code: "max_admins", name: "Administradores", unit: "count", planValue: 5, overrideMode: null, overrideValue: null, usage: 1, limit: 5, percentage: 20, source: "plan" }],
  modules: [{ code: "billing", name: "Facturación", category: "operaciones", planIncluded: false, enabled: true, source: "override_enabled", overrideMode: "enabled", overrideReason: "Acceso contratado", changedAt: "2026-01-03T00:00:00Z", changedBy: "user-1", changedByDisplayName: "Super Admin" }],
  activeAdminCount: 1, activeDriverCount: 2,
  members: [{ id: "member-1", userId: "user-2", displayName: "Ana Admin", role: "admin_empresa", joinedAt: "2026-01-02T00:00:00Z" }],
  audit: [{ id: "audit-1", action: "organization.created", actorScope: "platform", reason: null, occurredAt: "2026-01-01T00:00:00Z", entityType: "organization" }]
};
afterEach(cleanup);
describe("detalle de empresa", () => {
  it("muestra todas las secciones", async () => { renderPage(async () => detail); expect(screen.getByText("Cargando detalle de empresa…")).toBeInTheDocument(); expect(await screen.findByRole("heading", { name: "Alba" })).toBeInTheDocument(); for (const title of ["Resumen general","Suscripción","Uso y límites","Módulos","Usuarios","Auditoría resumida"]) expect(screen.getByRole("heading", { name: title })).toBeInTheDocument(); expect(screen.getByText("Activado por override")).toBeInTheDocument(); });
  it("muestra organización inexistente", async () => { renderPage(async () => null); expect(await screen.findByRole("heading", { name: "Empresa no encontrada" })).toBeInTheDocument(); });
  it("muestra errores", async () => { renderPage(async () => { throw new Error("Fallo de detalle"); }); expect(await screen.findByText("Fallo de detalle")).toBeInTheDocument(); });
});
function renderPage(loader: (id: string) => Promise<OrganizationDetail | null>) { render(<MemoryRouter initialEntries={["/platform/organizations/org-1"]}><Routes><Route path="/platform/organizations/:organizationId" element={<OrganizationDetailPage loader={loader} />} /></Routes></MemoryRouter>); }
