import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CompanyOnboardingPage } from "./CompanyOnboardingPage";

const api = vi.hoisted(() => ({ load: vi.fn(async () => ({ currentStep: 3, completedSteps: [1, 2], completedAt: null })), save: vi.fn(async () => undefined), refresh: vi.fn(async () => undefined) }));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ access: { organization: { id: "org-1" } }, refreshAccess: api.refresh, signOut: vi.fn(async () => undefined) }) }));
vi.mock("../../data/onboarding-repository", () => ({ loadOnboarding: api.load, saveOnboarding: api.save }));

describe("onboarding empresarial", () => {
  it("reanuda el progreso y permite saltar un paso no esencial", async () => {
    render(<MemoryRouter><CompanyOnboardingPage /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Primer vehículo" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Saltar por ahora" }));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith("org-1", 4, [1, 2], false));
    expect(await screen.findByRole("heading", { name: "Primer conductor" })).toBeInTheDocument();
  });
});
