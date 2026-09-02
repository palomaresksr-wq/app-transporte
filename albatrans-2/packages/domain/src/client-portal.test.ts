import { describe, expect, it } from "vitest";
import { canAccessClientInvoice, canClientManageUsers, clientTransportStatusLabel, filterClientTimeline } from "./client-portal";

describe("client portal domain", () => {
  it("maps internal transport states to friendly labels", () => {
    expect(clientTransportStatusLabel("in_transit")).toBe("En tránsito");
    expect(clientTransportStatusLabel("unknown")).toBe("En seguimiento");
  });
  it("keeps management exclusive to client admins", () => {
    expect(canClientManageUsers("client_admin")).toBe(true);
    expect(canClientManageUsers("client_viewer")).toBe(false);
  });
  it("filters the internal timeline", () => {
    const result = filterClientTimeline([{ eventType: "transport.completed" }, { eventType: "billing.valued" }]);
    expect(result).toEqual([{ eventType: "transport.completed" }]);
  });
  it("isolates invoices by customer", () => {
    expect(canAccessClientInvoice("a", "a")).toBe(true);
    expect(canAccessClientInvoice("a", "b")).toBe(false);
  });
});
