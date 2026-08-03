import type { ChangeOrganizationLimitInput, OrganizationDetailLimit } from "@albatrans/contracts";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrganizationLimitsManager } from "./OrganizationLimitsManager";

const limits: OrganizationDetailLimit[] = [
  { code: "max_admins", name: "Máximo de administradores", unit: "count", planValue: 5, overrideMode: "custom", overrideValue: 8, usage: 4, limit: 8, percentage: 50, source: "organization_override" },
  { code: "max_storage_bytes", name: "Almacenamiento máximo", unit: "bytes", planValue: null, overrideMode: "custom", overrideValue: 1_073_741_824, usage: 536_870_912, limit: 1_073_741_824, percentage: 50, source: "organization_override" }
];
afterEach(cleanup);
describe("límites editables", () => {
  it("muestra plan, override, efectivo, consumo y porcentaje", () => { renderManager(); const row = screen.getByText("Máximo de administradores").closest("tr"); if (!row) throw new Error("No se encontró el límite."); expect(within(row).getByText("max_admins")).toBeInTheDocument(); expect(within(row).getByText("5")).toBeInTheDocument(); expect(within(row).getAllByText("8")).toHaveLength(2); expect(within(row).getByText("4")).toBeInTheDocument(); expect(within(row).getByText("50%")).toBeInTheDocument(); });
  it("acepta cero y guarda un override personalizado con motivo", async () => { const changer = vi.fn(async (_id: string, input: ChangeOrganizationLimitInput) => ({ organizationId: "org-1", limitCode: input.limitCode, action: input.action, effectiveValue: input.value ?? 0 })); renderManager(changer); configure("Máximo de administradores"); fireEvent.change(screen.getByLabelText("Comportamiento"), { target: { value: "custom" } }); fireEvent.change(screen.getByLabelText("Valor personalizado"), { target: { value: "0" } }); fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: "Capacidad desactivada" } }); fireEvent.click(screen.getByRole("button", { name: "Guardar límite" })); await waitFor(() => expect(changer).toHaveBeenCalledWith("org-1", { limitCode: "max_admins", action: "custom", value: 0, reason: "Capacidad desactivada" })); });
  it("rechaza valores negativos o decimales", async () => { renderManager(); configure("Máximo de administradores"); fireEvent.change(screen.getByLabelText("Valor personalizado"), { target: { value: "-1" } }); fireEvent.click(screen.getByRole("button", { name: "Guardar límite" })); expect(await screen.findByRole("alert")).toHaveTextContent("entero igual o mayor que cero"); });
  it("impide heredar o eliminar cuando el plan no define valor", () => { renderManager(); configure("Almacenamiento máximo"); const select = screen.getByLabelText("Comportamiento"); expect(within(select).getByRole("option", { name: "Heredar del plan" })).toBeDisabled(); expect(within(select).getByRole("option", { name: "Eliminar override" })).toBeDisabled(); });
});
function configure(name: string) { const row = screen.getByText(name).closest("tr"); if (!row) throw new Error("No se encontró la fila."); fireEvent.click(within(row).getByRole("button", { name: "Configurar" })); }
function renderManager(changer = async (_id: string, input: ChangeOrganizationLimitInput) => ({ organizationId: "org-1", limitCode: input.limitCode, action: input.action, effectiveValue: input.value ?? 5 })) { return render(<OrganizationLimitsManager organizationId="org-1" limits={limits} changer={changer} onChanged={async () => undefined} />); }
