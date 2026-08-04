import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssignmentsPage } from "./AssignmentsPage";

const repository = vi.hoisted(() => ({
  loadAssignments: vi.fn(),
  loadMasterDataOptions: vi.fn(),
  commandMasterData: vi.fn(),
}));
vi.mock("../../data/master-data-repository", () => repository);
beforeEach(() => {
  repository.loadAssignments.mockResolvedValue({ items: [], total: 0 });
  repository.loadMasterDataOptions.mockImplementation((_organizationId: string, kind: string) => Promise.resolve(kind === "drivers" ? [{ value: "driver-1", label: "Ana" }] : [{ value: "vehicle-1", label: "1234 ABC" }]));
  repository.commandMasterData.mockResolvedValue({ resource: "driver_vehicle_assignments", organizationId: "org-1", entityId: "assignment-1", action: "create" });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("asignaciones", () => {
  it("crea una asignación con conductor y vehículo activos", async () => {
    render(<AssignmentsPage organizationId="org-1" />);
    await screen.findByText("Todavía no hay asignaciones.");
    fireEvent.click(screen.getByRole("button", { name: "Nueva asignación" }));
    fireEvent.change(screen.getByLabelText("Conductor"), { target: { value: "driver-1" } });
    fireEvent.change(screen.getByLabelText("Vehículo"), { target: { value: "vehicle-1" } });
    fireEvent.change(screen.getByLabelText("Inicio"), { target: { value: "2026-08-04T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear asignación" }));
    await waitFor(() => expect(repository.commandMasterData).toHaveBeenCalledWith(expect.objectContaining({ action: "create", resource: "driver_vehicle_assignments" })));
  });

  it("rechaza un periodo invertido antes de llamar al servidor", async () => {
    render(<AssignmentsPage organizationId="org-1" />);
    await screen.findByText("Todavía no hay asignaciones.");
    fireEvent.click(screen.getByRole("button", { name: "Nueva asignación" }));
    fireEvent.change(screen.getByLabelText("Conductor"), { target: { value: "driver-1" } });
    fireEvent.change(screen.getByLabelText("Vehículo"), { target: { value: "vehicle-1" } });
    fireEvent.change(screen.getByLabelText("Inicio"), { target: { value: "2026-08-05T10:00" } });
    fireEvent.change(screen.getByLabelText("Fin opcional"), { target: { value: "2026-08-04T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear asignación" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("posterior al inicio");
    expect(repository.commandMasterData).not.toHaveBeenCalled();
  });
});
