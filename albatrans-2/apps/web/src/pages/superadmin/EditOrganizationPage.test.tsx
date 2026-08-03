import type { UpdateOrganizationInput } from "@albatrans/contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrganizationCommandError } from "../../data/organization-command-repository";
import { EditOrganizationPage } from "./EditOrganizationPage";

const current: UpdateOrganizationInput = { legalName: "Transportes Alba SL", tradeName: "Alba", taxId: "B12345678", email: "info@alba.es", phone: "+34 900", countryCode: "ES", timezone: "Europe/Madrid", currencyCode: "EUR", internalNotes: "Cuenta local" };
afterEach(cleanup);

describe("edición de empresa", () => {
  it("precarga, normaliza y guarda los datos generales", async () => {
    const saver = vi.fn(async (id: string) => ({ organizationId: id }));
    renderPage(async () => current, saver);
    expect(screen.getByText("Cargando datos de la empresa…")).toBeInTheDocument();
    const legalName = await screen.findByLabelText(/Razón social/);
    expect(legalName).toHaveValue("Transportes Alba SL");
    fireEvent.change(legalName, { target: { value: "  Alba Logística SL  " } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(saver).toHaveBeenCalledWith("org-1", expect.objectContaining({ legalName: "Alba Logística SL", taxId: "B12345678" })));
    expect(await screen.findByTestId("location")).toHaveTextContent("/platform/organizations/org-1?updated=1");
  });

  it("muestra validaciones sin invocar el guardado", async () => {
    const saver = vi.fn(async (id: string) => ({ organizationId: id }));
    renderPage(async () => current, saver);
    fireEvent.change(await screen.findByLabelText(/Razón social/), { target: { value: " " } });
    fireEvent.change(screen.getByLabelText(/Nombre comercial/), { target: { value: " " } });
    fireEvent.change(screen.getByLabelText(/NIF \/ CIF/), { target: { value: " " } });
    fireEvent.change(screen.getByLabelText(/Correo electrónico/), { target: { value: "incorrecto" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("La razón social es obligatoria.")).toBeInTheDocument();
    expect(screen.getByText("El nombre comercial es obligatorio.")).toBeInTheDocument();
    expect(screen.getByText("El NIF/CIF es obligatorio.")).toBeInTheDocument();
    expect(saver).not.toHaveBeenCalled();
  });

  it("distingue empresa inexistente y conflicto de NIF/CIF", async () => {
    const { unmount } = renderPage(async () => null, async (id) => ({ organizationId: id }));
    expect(await screen.findByRole("heading", { name: "Empresa no encontrada" })).toBeInTheDocument();
    unmount();
    renderPage(async () => current, async () => { throw new OrganizationCommandError("tax_id_conflict", "Ya existe una empresa con ese NIF/CIF en el país indicado."); });
    fireEvent.click(await screen.findByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ya existe una empresa con ese NIF/CIF");
  });
});

function renderPage(loader: (id: string) => Promise<UpdateOrganizationInput | null>, saver: (id: string, input: UpdateOrganizationInput) => Promise<{ organizationId: string }>) {
  return render(<MemoryRouter initialEntries={["/platform/organizations/org-1/edit"]}><Routes><Route path="/platform/organizations/:organizationId/edit" element={<EditOrganizationPage loader={loader} saver={saver} />} /><Route path="/platform/organizations/:organizationId" element={<Location />} /></Routes></MemoryRouter>);
}
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }
