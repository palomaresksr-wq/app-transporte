import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BillingPage } from "./BillingPage";

const billing = vi.hoisted(() => ({
  loadBillingRates: vi.fn(),
  loadBillingSupplementDefinitions: vi.fn(),
  loadBillingPreinvoices: vi.fn(),
  loadPrefacturableOrders: vi.fn(),
  loadBillingPreinvoiceLines: vi.fn(),
  createBillingRate: vi.fn(),
  createSupplementDefinition: vi.fn(),
  createBillingPreinvoice: vi.fn(),
  approveBillingPreinvoice: vi.fn(),
  cancelBillingPreinvoice: vi.fn(),
  deactivateBillingRate: vi.fn(),
  summarizeRateComponents: vi.fn((components: unknown) => Array.isArray(components) ? "Tarifa compuesta" : "Sin componentes"),
}));
const transport = vi.hoisted(() => ({ loadTransportOptions: vi.fn() }));

vi.mock("../../data/billing-repository", () => billing);
vi.mock("../../data/transport-repository", () => transport);

beforeEach(() => {
  transport.loadTransportOptions.mockResolvedValue([{ value: "client-1", label: "Cliente Uno" }]);
  billing.loadBillingRates.mockResolvedValue([{ id: "rate-1", organization_id: "org-1", client_id: "client-1", clientName: "Cliente Uno", origin_location_id: null, destination_location_id: null, service_type: "General", name: "Tarifa demo", status: "active", valid_from: "2026-08-01", valid_until: null, currency_code: "EUR", version_group_id: "group-1", version_number: 1, previous_rate_id: null, components_json: [{ componentKind: "base", amount: "50.00" }], supplement_rules_json: [], created_by: "user-1", created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z", archived_at: null }]);
  billing.loadBillingSupplementDefinitions.mockResolvedValue([{ id: "supp-1", organization_id: "org-1", code: "tail_lift", name: "Trampilla", charge_mode: "fixed", amount: 25, unit_code: null, percentage_base: null, status: "active", created_by: "user-1", created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z", archived_at: null }]);
  billing.loadBillingPreinvoices.mockResolvedValue([{ id: "pre-1", organization_id: "org-1", client_id: "client-1", clientName: "Cliente Uno", reference: "PRE-2026-0001", period_start: "2026-08-01", period_end: "2026-08-31", status: "draft", currency_code: "EUR", subtotal_amount: 346.5, adjustments_amount: 0, total_amount: 346.5, created_by: "user-1", created_at: "2026-08-10T00:00:00Z", updated_at: "2026-08-10T00:00:00Z", approved_by: null, approved_at: null, cancelled_by: null, cancelled_at: null, notes: null, lineCount: 1 }]);
  billing.loadPrefacturableOrders.mockResolvedValue([{ orderId: "order-1", orderNumber: "TR-001", customerId: "client-1", customerName: "Cliente Uno", totalAmount: 346.5, valuationId: "valuation-1", updatedAt: "2026-08-10T00:00:00Z" }]);
  billing.loadBillingPreinvoiceLines.mockResolvedValue([{ id: "line-1", organization_id: "org-1", preinvoice_id: "pre-1", transport_order_id: "order-1", valuation_id: "valuation-1", line_amount: 346.5, description: "Orden TR-001", created_by: "user-1", created_at: "2026-08-10T00:00:00Z", removed_by: null, removed_at: null, remove_reason: null }]);
  billing.createBillingRate.mockResolvedValue({ ok: true });
  billing.createSupplementDefinition.mockResolvedValue({ ok: true });
  billing.createBillingPreinvoice.mockResolvedValue({ ok: true });
  billing.approveBillingPreinvoice.mockResolvedValue({ ok: true });
  billing.cancelBillingPreinvoice.mockResolvedValue({ ok: true });
  billing.deactivateBillingRate.mockResolvedValue({ ok: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("facturación y prefacturas", () => {
  it("muestra tarifas, suplementos y prefacturas", async () => {
    render(<MemoryRouter><BillingPage organizationId="org-1" platform={false} /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Tarifas y prefacturas" })).toBeInTheDocument();
    expect(screen.getByText("Tarifa demo")).toBeInTheDocument();
    expect(screen.getByText("Trampilla")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PRE-2026-0001" })).toBeInTheDocument();
  });

  it("crea una tarifa compuesta", async () => {
    render(<MemoryRouter><BillingPage organizationId="org-1" platform={false} /></MemoryRouter>);
    await screen.findByText("Tarifa demo");
    fireEvent.click(screen.getByRole("button", { name: "Nueva tarifa" }));
    const form = screen.getByRole("heading", { name: "Nueva tarifa" }).closest("form") as HTMLElement;
    fireEvent.change(within(form).getByLabelText("Cliente"), { target: { value: "client-1" } });
    fireEvent.change(within(form).getByLabelText("Nombre"), { target: { value: "Tarifa combinada" } });
    fireEvent.change(within(form).getByLabelText("Base €"), { target: { value: "50" } });
    fireEvent.change(within(form).getByLabelText("€/km"), { target: { value: "0.80" } });
    fireEvent.click(within(form).getByRole("button", { name: "Crear tarifa" }));
    await waitFor(() => expect(billing.createBillingRate).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-1", name: "Tarifa combinada" })));
  });

  it("crea y aprueba una prefactura", async () => {
    render(<MemoryRouter><BillingPage organizationId="org-1" platform={false} /></MemoryRouter>);
    await screen.findByText("Tarifa demo");
    fireEvent.click(screen.getByRole("button", { name: "Crear prefactura" }));
    const form = screen.getByRole("heading", { name: "Nueva prefactura" }).closest("form") as HTMLElement;
    fireEvent.change(within(form).getByLabelText("Cliente"), { target: { value: "client-1" } });
    const checkbox = within(form).getByRole("checkbox");
    fireEvent.click(checkbox);
    fireEvent.click(within(form).getByRole("button", { name: "Crear prefactura" }));
    await waitFor(() => expect(billing.createBillingPreinvoice).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));
    await waitFor(() => expect(billing.approveBillingPreinvoice).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-1", preinvoiceId: "pre-1" })));
  });
});
