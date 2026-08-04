import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MasterDataPage } from "./MasterDataPage";

const repository = vi.hoisted(() => ({
  loadMasterData: vi.fn(),
  loadMasterDataRecord: vi.fn(),
  loadMasterDataOptions: vi.fn(),
  commandMasterData: vi.fn(),
}));
vi.mock("../../data/master-data-repository", () => repository);

beforeEach(() => {
  repository.loadMasterData.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  repository.loadMasterDataOptions.mockResolvedValue([]);
  repository.commandMasterData.mockResolvedValue({ resource: "vehicles", organizationId: "org-1", entityId: "vehicle-1", action: "create" });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Datos Maestros", () => {
  it("distingue el estado vacío de los resultados filtrados", async () => {
    render(<MasterDataPage organizationId="org-1" resource="clients" />);
    expect(await screen.findByText("Todavía no hay registros.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "inexistente" } });
    expect(await screen.findByText("No hay resultados para los filtros.")).toBeInTheDocument();
  });

  it("valida, normaliza y crea un vehículo", async () => {
    render(<MasterDataPage organizationId="org-1" resource="vehicles" />);
    await screen.findByText("Todavía no hay registros.");
    fireEvent.click(screen.getByRole("button", { name: "Nuevo vehículo" }));
    fireEvent.change(screen.getByLabelText("Matrícula"), { target: { value: " 1234 ABC " } });
    fireEvent.change(screen.getByLabelText("Tipo de vehículo"), { target: { value: " Camión   rígido " } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(repository.commandMasterData).toHaveBeenCalledWith(expect.objectContaining({
      action: "create",
      organizationId: "org-1",
      resource: "vehicles",
      values: expect.objectContaining({ registration_plate: "1234 ABC", vehicle_type: "Camión rígido" }),
    })));
  });
});
