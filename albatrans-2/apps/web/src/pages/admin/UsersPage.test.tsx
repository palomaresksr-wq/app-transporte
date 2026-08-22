import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UsersPage } from "./UsersPage";

const api = vi.hoisted(() => ({
  list: vi.fn(async () => [{
    userId: "user-1",
    organizationId: "org-1",
    firstName: "Ana",
    lastName: "Ruta",
    displayName: "Ana Ruta",
    email: "ana@example.test",
    phone: null,
    role: "conductor" as const,
    lifecycleStatus: "active" as const,
    profileStatus: "active" as const,
    membershipStatus: "active" as const,
    mustChangePassword: true,
    lastAccessAt: null,
    createdAt: "2026-08-23T00:00:00Z",
  }]),
  create: vi.fn(async () => ({
    userId: "user-2",
    organizationId: "org-1",
    email: "nuevo@example.test",
    role: "conductor" as const,
    status: "active" as const,
    mustChangePassword: true,
  })),
  action: vi.fn(async () => undefined),
  reset: vi.fn(async () => undefined),
  update: vi.fn(async () => undefined),
}));

vi.mock(
  "../../auth/AuthContext",
  () => ({ useAuth: () => ({ access: { organization: { id: "org-1" } } }) }),
);
vi.mock("../../data/user-management-repository", () => ({
  listCompanyUsers: api.list,
  createCompanyUser: api.create,
  companyUserAction: api.action,
  resetCompanyUserPassword: api.reset,
  updateCompanyUser: api.update,
}));
afterEach(cleanup);

describe("administración de usuarios", () => {
  it("lista, filtra y crea un conductor con contraseña inicial", async () => {
    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Ana Ruta")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar usuarios"), {
      target: { value: "inexistente" },
    });
    expect(screen.queryByText("Ana Ruta")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ Crear usuario" }));
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Nuevo" },
    });
    fireEvent.change(screen.getByLabelText("Apellidos"), {
      target: { value: "Conductor" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "nuevo@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña inicial"), {
      target: { value: "Inicial.Segura-2026!" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
      target: { value: "Inicial.Segura-2026!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          email: "nuevo@example.test",
          role: "conductor",
          mustChangePassword: true,
        }),
      )
    );
  });

  it("rechaza confirmaciones de contraseña distintas", async () => {
    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );
    await screen.findByText("Ana Ruta");
    fireEvent.click(screen.getByRole("button", { name: "+ Crear usuario" }));
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Nuevo" },
    });
    fireEvent.change(screen.getByLabelText("Apellidos"), {
      target: { value: "Conductor" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "nuevo@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña inicial"), {
      target: { value: "Inicial.Segura-2026!" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
      target: { value: "Otra.Segura-2026!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Las contraseñas no coinciden.",
    );
  });
  it("edita datos no privilegiados y refresca el listado", async () => {
    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );
    await screen.findByText("Ana Ruta");
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByLabelText("Rol")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Ana María" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ firstName: "Ana María" }),
        "org-1",
      )
    );
  });
});
