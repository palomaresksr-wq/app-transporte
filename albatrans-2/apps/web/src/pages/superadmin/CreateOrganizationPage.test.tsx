import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateOrganizationPage } from "./CreateOrganizationPage";
const api = vi.hoisted(() => ({ create: vi.fn(async () => ({ organizationId: "org-local" })), subscription: vi.fn(async () => ({})), module: vi.fn(async () => ({})), status: vi.fn(), user: vi.fn(async () => ({})) }));
vi.mock("../../data/organization-command-repository", () => ({ createOrganization: api.create, manageOrganizationSubscription: api.subscription, changeOrganizationModule: api.module, changeOrganizationStatus: api.status, loadOrganizationSetupOptions: async () => ({ plans: [{ code: "starter", name: "Starter", description: "Inicio" }], modules: [{ code: "billing", name: "Facturación", description: "Facturas" }] }) }));
vi.mock("../../data/user-management-repository", () => ({ createCompanyUser: api.user }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("wizard de nueva empresa", () => {
  it("valida el primer paso", () => { renderPage(); fireEvent.click(screen.getByRole("button", { name: "Continuar" })); expect(screen.getByRole("alert")).toHaveTextContent("razón social"); });
  it("crea el alta integral sin volver a mostrar la contraseña", async () => { renderPage(); fireEvent.change(screen.getByLabelText("Razón social"), { target: { value: "Empresa Local" } }); fireEvent.click(screen.getByRole("button", { name: "Continuar" })); await screen.findByRole("heading", { name: "Plan" }); fireEvent.click(screen.getByRole("button", { name: "Continuar" })); fireEvent.change(screen.getByLabelText("Configurar Facturación"), { target: { value: "enabled" } }); fireEvent.click(screen.getByRole("button", { name: "Continuar" })); for (const [label, value] of [["Nombre","Ana"],["Apellidos","Admin"],["Email administrador","ana@example.test"],["Contraseña inicial","Segura.Inicial-2026!"],["Confirmar contraseña","Segura.Inicial-2026!"]] as const) fireEvent.change(screen.getByLabelText(label), { target: { value } }); fireEvent.click(screen.getByRole("button", { name: "Continuar" })); fireEvent.click(screen.getByRole("button", { name: "Crear empresa" })); expect(await screen.findByRole("heading", { name: "Empresa creada correctamente" })).toBeInTheDocument(); await waitFor(() => expect(api.user).toHaveBeenCalled()); expect(screen.queryByText("Segura.Inicial-2026!")).not.toBeInTheDocument(); });
});
function renderPage() { render(<MemoryRouter><CreateOrganizationPage /></MemoryRouter>); }
