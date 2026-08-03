import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    configured: true,
    loading: false,
    session: null,
    access: null,
    error: null
  })
}));

describe("login configurado", () => {
  it("muestra el formulario de acceso cuando Supabase está configurado", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: "Entrar en Albatrans" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.queryByText("Supabase está pendiente de configurar")).not.toBeInTheDocument();
  });
});
