import type { ChangeOrganizationStatusInput, Organization } from "@albatrans/contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrganizationCommandError } from "../../data/organization-command-repository";
import { OrganizationStatusActions } from "./OrganizationStatusActions";

const organization: Organization = { id: "org-1", legalName: "Transportes Alba SL", tradeName: "Alba", taxId: "B123", email: null, phone: null, countryCode: "ES", timezone: "Europe/Madrid", currencyCode: "EUR", status: "active", statusReason: null, statusChangedAt: "2026-01-01T00:00:00Z", statusChangedBy: null, internalNotes: null, createdBy: "user-1", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", archivedAt: null };
afterEach(cleanup);

describe("gestión del estado", () => {
  it("muestra solo transiciones válidas y exige motivo al bloquear", async () => {
    const changer = vi.fn(async (id: string, input: ChangeOrganizationStatusInput) => ({ organizationId: id, status: input.status }));
    render(<OrganizationStatusActions organization={organization} changer={changer} onChanged={async () => undefined} />);
    expect(screen.queryByRole("button", { name: "Activar" })).not.toBeInTheDocument();
    for (const name of ["Poner en mantenimiento", "Bloquear", "Suspender", "Archivar"]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bloquear" }));
    const confirm = screen.getByRole("button", { name: "Confirmar cambio" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: "Incumplimiento" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(changer).toHaveBeenCalledWith("org-1", { status: "blocked", reason: "Incumplimiento" }));
  });

  it("refuerza la confirmación irreversible de archivo", () => {
    render(<OrganizationStatusActions organization={organization} changer={async (id) => ({ organizationId: id, status: "archived" })} onChanged={async () => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Archivar" }));
    expect(screen.getByText("Esta acción es irreversible.")).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Confirmar cambio" });
    fireEvent.change(screen.getByLabelText(/^Motivo/), { target: { value: "Cierre definitivo" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Escribe “Alba”/), { target: { value: "Alba" } });
    expect(confirm).toBeEnabled();
  });

  it("no ofrece acciones para archivadas y muestra transiciones rechazadas por servidor", async () => {
    const { unmount } = render(<OrganizationStatusActions organization={{ ...organization, status: "archived", archivedAt: "2026-01-02T00:00:00Z" }} changer={async (id) => ({ organizationId: id, status: "active" })} onChanged={async () => undefined} />);
    expect(screen.getByText("La empresa está archivada y no puede reactivarse.")).toBeInTheDocument();
    unmount();
    render(<OrganizationStatusActions organization={{ ...organization, status: "blocked" }} changer={async () => { throw new OrganizationCommandError("invalid_transition", "No se permite la transición."); }} onChanged={async () => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Reactivar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cambio" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Transición no permitida");
  });
});
