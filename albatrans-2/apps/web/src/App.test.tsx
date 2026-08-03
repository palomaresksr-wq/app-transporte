import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";

vi.mock("./infrastructure/supabase/client", () => ({
  getSupabaseClient: () => null
}));

describe("arranque seguro", () => {
  it("muestra configuración pendiente sin credenciales", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(
      await screen.findByText("Supabase está pendiente de configurar")
    ).toBeInTheDocument();
  });
});
