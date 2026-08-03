import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOrganization } from "../../data/organization-command-repository";
import { CreateOrganizationPage } from "./CreateOrganizationPage";

vi.mock("../../data/organization-command-repository", () => ({ createOrganization: vi.fn() }));

describe("formulario de nueva empresa", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });
  it("muestra errores sin enviar datos inválidos", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Crear empresa" }));
    expect(screen.getByText("La razón social es obligatoria.")).toBeInTheDocument();
    expect(createOrganization).not.toHaveBeenCalled();
  });
  it("crea y vuelve al dashboard para refrescar métricas", async () => {
    vi.mocked(createOrganization).mockResolvedValue({ organizationId: "org-local" });
    renderPage();
    fireEvent.change(screen.getByLabelText(/Razón social/), { target: { value: "Empresa Local" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear empresa" }));
    await waitFor(() => expect(createOrganization).toHaveBeenCalledOnce());
    expect(await screen.findByText("Dashboard actualizado")).toBeInTheDocument();
  });
});

function renderPage() {
  render(<MemoryRouter initialEntries={["/platform/empresas/nueva"]}><Routes><Route path="/platform/empresas/nueva" element={<CreateOrganizationPage />} /><Route path="/platform" element={<p>Dashboard actualizado</p>} /></Routes></MemoryRouter>);
}
