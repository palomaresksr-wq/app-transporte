import type { ChangeOrganizationModuleInput, OrganizationDetailModule } from "@albatrans/contracts";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrganizationModulesManager } from "./OrganizationModulesManager";

const modules: OrganizationDetailModule[] = [
  { code: "billing", name: "Facturación", category: "operaciones", planIncluded: true, enabled: false, source: "override_disabled", overrideMode: "disabled", overrideReason: "Pausa temporal", changedAt: "2026-08-01T00:00:00Z", changedBy: "user-1", changedByDisplayName: "Super Admin" },
  { code: "api_access", name: "Acceso API", category: "técnico", planIncluded: false, enabled: false, source: "not_in_plan", overrideMode: null, overrideReason: null, changedAt: null, changedBy: null, changedByDisplayName: null },
  { code: "reports", name: "Informes", category: "analítica", planIncluded: true, enabled: true, source: "plan", overrideMode: "inherit", overrideReason: null, changedAt: "2026-07-01T00:00:00Z", changedBy: "user-1", changedByDisplayName: "Super Admin" }
];
afterEach(cleanup);

describe("gestión de módulos", () => {
  it("muestra plan, override, efectivo, metadatos y filtros", () => {
    renderManager();
    expect(screen.getByText("1 de 3 módulos activos")).toBeInTheDocument();
    const billing = screen.getByText("Facturación").closest("tr");
    if (!billing) throw new Error("No se encontró la fila de Facturación.");
    expect(within(billing).getByText("Incluido")).toBeInTheDocument();
    expect(within(billing).getByText("Desactivado por override")).toBeInTheDocument();
    expect(within(billing).getByText("Pausa temporal")).toBeInTheDocument();
    expect(screen.getByText("Módulo técnico")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "técnico" } });
    expect(screen.queryByText("Facturación")).not.toBeInTheDocument();
    expect(screen.getByText("Acceso API")).toBeInTheDocument();
  });

  it("exige motivo y confirmación para activar manualmente", async () => {
    const changer = vi.fn(async (id: string, input: ChangeOrganizationModuleInput) => ({ organizationId: id, moduleCode: input.moduleCode, overrideMode: input.overrideMode, effectiveEnabled: true }));
    renderManager(changer);
    const apiRow = screen.getByText("Acceso API").closest("tr"); if (!apiRow) throw new Error("No se encontró API."); fireEvent.click(within(apiRow).getByRole("button", { name: "Configurar" }));
    fireEvent.change(screen.getByLabelText("Comportamiento"), { target: { value: "enabled" } });
    const save = screen.getByRole("button", { name: "Guardar módulo" }); expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: "Integración aprobada" } }); fireEvent.click(screen.getByLabelText(/Confirmo que este cambio/)); fireEvent.click(save);
    await waitFor(() => expect(changer).toHaveBeenCalledWith("org-1", { moduleCode: "api_access", overrideMode: "enabled", reason: "Integración aprobada" }));
  });

  it("permite volver a heredar sin motivo", async () => {
    const changer = vi.fn(async (id: string, input: ChangeOrganizationModuleInput) => ({ organizationId: id, moduleCode: input.moduleCode, overrideMode: input.overrideMode, effectiveEnabled: true }));
    renderManager(changer); const billing = screen.getByText("Facturación").closest("tr"); if (!billing) throw new Error("No se encontró Facturación."); fireEvent.click(within(billing).getByRole("button", { name: "Configurar" })); fireEvent.change(screen.getByLabelText("Comportamiento"), { target: { value: "inherit" } }); fireEvent.click(screen.getByLabelText(/Confirmo que este cambio/)); fireEvent.click(screen.getByRole("button", { name: "Guardar módulo" }));
    await waitFor(() => expect(changer).toHaveBeenCalledWith("org-1", { moduleCode: "billing", overrideMode: "inherit", reason: "" }));
  });
});

function renderManager(changer: (id: string, input: ChangeOrganizationModuleInput) => Promise<{ organizationId: string; moduleCode: ChangeOrganizationModuleInput["moduleCode"]; overrideMode: ChangeOrganizationModuleInput["overrideMode"]; effectiveEnabled: boolean }> = async (id, input) => ({ organizationId: id, moduleCode: input.moduleCode, overrideMode: input.overrideMode, effectiveEnabled: true })) { return render(<OrganizationModulesManager organizationId="org-1" modules={modules} changer={changer} onChanged={async () => undefined} />); }
