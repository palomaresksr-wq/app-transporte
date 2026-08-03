import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseConfig } from "./config";

describe("configuración local de Supabase", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("acepta la instancia local configurada para Vite", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv(
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      "sb_publishable_local_test"
    );

    expect(getSupabaseConfig()).toEqual({
      url: "http://localhost:54321",
      publishableKey: "sb_publishable_local_test"
    });
  });
});
