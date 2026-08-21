import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DriverDetailPage, DriverListPage } from "./DriverPortal";
import * as repo from "../../data/driver-portal-repository";
vi.mock("../../data/driver-portal-repository");
const summary = {
  id: "10000000-0000-4000-8000-000000000001",
  organizationId: "20000000-0000-4000-8000-000000000001",
  orderNumber: "TR-DRIVER-1",
  status: "driver_notified" as const,
  priority: "urgent",
  plannedPickupAt: new Date().toISOString(),
  plannedDeliveryAt: new Date(Date.now() + 3600000).toISOString(),
  origin: "Madrid",
  destination: "Valencia",
  packages: 10,
  weightKg: 500,
  hasOpenIncident: false,
};
const detail = {
  order: {
    id: summary.id,
    organization_id: summary.organizationId,
    order_number: summary.orderNumber,
    priority: "urgent",
    planned_pickup_at: summary.plannedPickupAt,
    planned_delivery_at: summary.plannedDeliveryAt,
    notes: null,
  },
  execution: {
    status: "driver_notified" as const,
    arrived_pickup_at: null,
    loading_started_at: null,
    loading_completed_at: null,
    departed_pickup_at: null,
    arrived_delivery_at: null,
    unloading_started_at: null,
    unloading_completed_at: null,
    completed_at: null,
  },
  stops: [{
    id: "s",
    stop_type: "pickup",
    window_starts_at: summary.plannedPickupAt,
    notes: null,
    location: {
      name: "Almacén",
      address_line_1: "Calle 1",
      address_line_2: null,
      postal_code: "28001",
      city: "Madrid",
      latitude: null,
      longitude: null,
    },
  }],
  items: [{
    id: "i",
    description: "Cajas",
    reference: "REF",
    packages: 10,
    pallets: 1,
    weight_kg: 500,
    volume_m3: 2,
    notes: null,
  }],
  incidents: [],
  notes: [],
  vehiclePlate: "1234-ABC",
  policy: {
    requirePod: false,
    requireSignature: false,
    requireDocument: false,
  },
  facts: {
    hasPod: false,
    hasSignature: false,
    hasDocument: false,
    hasOpenCriticalIncident: false,
  },
};
beforeEach(() => {
  vi.mocked(repo.loadDriverTransports).mockResolvedValue([summary]);
  vi.mocked(repo.loadDriverTransport).mockResolvedValue(detail);
  vi.mocked(repo.executeDriverCommand).mockResolvedValue({});
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
});
afterEach(cleanup);
describe("portal móvil del conductor", () => {
  it("lista únicamente sus transportes", async () => {
    render(
      <MemoryRouter>
        <DriverListPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("TR-DRIVER-1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir transporte" }))
      .toBeInTheDocument();
  });
  it("muestra el vacío", async () => {
    vi.mocked(repo.loadDriverTransports).mockResolvedValue([]);
    render(
      <MemoryRouter>
        <DriverListPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("No tienes transportes asignados."))
      .toBeInTheDocument();
  });
  it("carga detalle, mercancía y siguiente acción", async () => {
    render(
      <MemoryRouter>
        <DriverDetailPage orderId={summary.id} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Almacén")).toBeInTheDocument();
    expect(screen.getByText(/10 bultos/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "INICIAR TRAYECTO A CARGA" }))
      .toBeInTheDocument();
  });
  it("envía una transición con idempotencia", async () => {
    render(
      <MemoryRouter>
        <DriverDetailPage orderId={summary.id} />
      </MemoryRouter>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "INICIAR TRAYECTO A CARGA" }),
    );
    await waitFor(() =>
      expect(repo.executeDriverCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: "execution",
          targetStatus: "heading_to_pickup",
          idempotencyKey: expect.any(String),
        }),
      )
    );
  });
  it("permite abrir incidencia y nota", async () => {
    render(
      <MemoryRouter>
        <DriverDetailPage orderId={summary.id} />
      </MemoryRouter>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Reportar incidencia" }),
    );
    expect(screen.getByRole("combobox", { name: "Categoría" }))
      .toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Añadir observación" }));
    expect(screen.getByRole("textbox", { name: "Observación" }))
      .toBeInTheDocument();
  });
  it("informa mala cobertura y bloquea mutaciones", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    render(
      <MemoryRouter>
        <DriverDetailPage orderId={summary.id} />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Sin conexión/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "INICIAR TRAYECTO A CARGA" }))
      .toBeDisabled();
  });
  it("muestra error sin ocultarlo", async () => {
    vi.mocked(repo.loadDriverTransport).mockRejectedValue(
      new Error("Acceso revocado"),
    );
    render(
      <MemoryRouter>
        <DriverDetailPage orderId={summary.id} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Acceso revocado",
    );
  });
});
