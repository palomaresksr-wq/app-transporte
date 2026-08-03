import type { AdministratorAction, AdministratorIdentityInput, OrganizationAdministrator, OrganizationAdministratorsResult } from "@albatrans/contracts";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrganizationAdministratorsManager } from "./OrganizationAdministratorsManager";

const invited: OrganizationAdministrator = { membershipId: "membership-1", userId: "user-1", organizationId: "org-1", email: "admin@alba.local", displayName: "Admin Alba", phone: "+34123456789", locale: "es", timezone: "Europe/Madrid", profileStatus: "active", membershipStatus: "invited", lastAccessAt: null, createdAt: "2026-08-01T10:00:00Z", createdByUserId: "super-1", createdByDisplayName: "Super Admin" };
const available: OrganizationAdministratorsResult = { items: [invited], assignedCount: 1, effectiveLimit: 2 };
afterEach(cleanup);

describe("gestión de administradores de empresa", () => {
  it("muestra identidad, estado, acceso, creación, creador y límite", async () => {
    renderManager();
    expect(await screen.findByText("Admin Alba")).toBeInTheDocument();
    const row = screen.getByText("Admin Alba").closest("tr");
    if (!row) throw new Error("No se encontró la fila del administrador.");
    expect(within(row).getByText("admin@alba.local")).toBeInTheDocument();
    expect(within(row).getByText("invited")).toBeInTheDocument();
    expect(within(row).getByText("Nunca")).toBeInTheDocument();
    expect(within(row).getByText("Super Admin")).toBeInTheDocument();
    expect(screen.getByText(/1 asignados.*límite 2/)).toBeInTheDocument();
  });

  it("valida y crea una invitación sin permitir elegir privilegios", async () => {
    const create = vi.fn(async () => ({ userId: "new-user" }));
    const { api } = renderManager({ create });
    await screen.findByText("Admin Alba"); fireEvent.click(screen.getByRole("button", { name: "Nuevo administrador" }));
    expect(screen.queryByLabelText(/rol/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Crear administrador" }));
    expect(await screen.findByText("Introduce un correo electrónico válido.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: "  Nueva Admin  " } });
    fireEvent.change(screen.getByLabelText(/Correo electrónico/), { target: { value: "  NUEVA@ALBA.LOCAL " } });
    fireEvent.click(screen.getByRole("button", { name: "Crear administrador" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith("org-1", { email: "nueva@alba.local", displayName: "Nueva Admin", phone: "", locale: "es", timezone: "Europe/Madrid" }));
    expect(api.load).toHaveBeenCalledTimes(2);
  });

  it("edita y ejecuta las acciones disponibles con confirmación de borrado", async () => {
    const update = vi.fn(async () => ({ userId: "user-1" }));
    const action = vi.fn(async (_organizationId: string, userId: string, name: AdministratorAction) => ({ userId, action: name }));
    renderManager({ update, action }); await screen.findByText("Admin Alba");
    fireEvent.click(screen.getByRole("button", { name: "Editar" })); fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: "Admin Actualizada" } }); fireEvent.click(screen.getByRole("button", { name: "Guardar administrador" }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Reenviar invitación" })); await waitFor(() => expect(action).toHaveBeenCalledWith("org-1", "user-1", "resend_invitation"));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" })); const dialog = screen.getByRole("dialog", { name: /Eliminar a Admin Alba/ }); fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar eliminación" }));
    await waitFor(() => expect(action).toHaveBeenCalledWith("org-1", "user-1", "delete"));
  });

  it("bloquea la creación y explica cuándo se alcanza el límite", async () => {
    renderManager({ result: { ...available, assignedCount: 2 } });
    expect(await screen.findByText("Se ha alcanzado el límite de administradores del plan.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nuevo administrador" })).toBeDisabled();
  });
});

function renderManager(options: { result?: OrganizationAdministratorsResult; create?: (organizationId: string, input: AdministratorIdentityInput) => Promise<{ userId: string }>; update?: (organizationId: string, userId: string, input: AdministratorIdentityInput) => Promise<{ userId: string }>; action?: (organizationId: string, userId: string, action: AdministratorAction) => Promise<{ userId: string }> } = {}) {
  const api = { load: vi.fn(async () => options.result ?? available), create: options.create ?? vi.fn(async () => ({ userId: "new-user" })), update: options.update ?? vi.fn(async () => ({ userId: "user-1" })), action: options.action ?? vi.fn(async () => ({ userId: "user-1" })) };
  return { api, ...render(<OrganizationAdministratorsManager organizationId="org-1" api={api} onChanged={async () => undefined} />) };
}
