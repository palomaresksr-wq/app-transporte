import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExecutionPage } from "./ExecutionPage";
const repository = vi.hoisted(() => ({ loadExecution: vi.fn(), executeExecutionCommand: vi.fn() }));
vi.mock("../../data/execution-repository", () => repository);
const base = { execution: null, waiting: null, incidents: [], notes: [], timeline: [] };
beforeEach(() => { repository.loadExecution.mockResolvedValue(base); repository.executeExecutionCommand.mockResolvedValue({ executionId: "ex-1", entityId: "ex-1", eventType: "execution.started" }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("panel de ejecución", () => {
  it("muestra el estado vacío e inicia la ejecución", async () => {
    render(<MemoryRouter><ExecutionPage organizationId="org-1" orderId="order-1" platform={false} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Iniciar ejecución" }));
    await waitFor(() => expect(repository.executeExecutionCommand).toHaveBeenCalledWith(expect.objectContaining({ resource: "execution", action: "start" })));
  });
  it("muestra transiciones posibles, tiempos y timeline", async () => {
    repository.loadExecution.mockResolvedValue({ ...base, execution: { id: "ex-1", status: "arrived_pickup", organization_id: "org-1", transport_order_id: "order-1", created_by: "user-1", created_at: "2026-08-04T10:00:00Z", updated_at: "2026-08-04T10:00:00Z", driver_notified_at: null, arrived_pickup_at: null, loading_started_at: null, loading_completed_at: null, departed_pickup_at: null, arrived_delivery_at: null, unloading_started_at: null, unloading_completed_at: null, completed_at: null, cancelled_at: null }, timeline: [{ id: "event-1", event_type: "execution.started", occurred_at: "2026-08-04T10:00:00Z", organization_id: "org-1", transport_order_id: "order-1", actor_user_id: "user-1", entity_type: "execution", entity_id: "ex-1", payload: {}, correlation_id: "correlation-1" }] });
    render(<MemoryRouter><ExecutionPage organizationId="org-1" orderId="order-1" platform={false} /></MemoryRouter>);
    expect(await screen.findByText("Llegada a recogida")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cargando" })).toBeInTheDocument();
    expect(screen.getByText("execution.started")).toBeInTheDocument();
    expect(screen.getAllByText("Sin calcular")).toHaveLength(6);
  });
  it("registra incidencias y notas solo con ejecución", async () => {
    repository.loadExecution.mockResolvedValue({ ...base, execution: { id: "ex-1", status: "pending", organization_id: "org-1", transport_order_id: "order-1", created_by: "user-1", created_at: "2026-08-04T10:00:00Z", updated_at: "2026-08-04T10:00:00Z", driver_notified_at: null, arrived_pickup_at: null, loading_started_at: null, loading_completed_at: null, departed_pickup_at: null, arrived_delivery_at: null, unloading_started_at: null, unloading_completed_at: null, completed_at: null, cancelled_at: null } });
    render(<MemoryRouter><ExecutionPage organizationId="org-1" orderId="order-1" platform={false} /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText("Título de incidencia"), { target: { value: " Retraso " } });
    fireEvent.change(screen.getByLabelText("Descripción de incidencia"), { target: { value: " Tráfico intenso " } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar incidencia" }));
    await waitFor(() => expect(repository.executeExecutionCommand).toHaveBeenCalledWith(expect.objectContaining({ resource: "incident", values: expect.objectContaining({ title: "Retraso" }) })));
  });
});
