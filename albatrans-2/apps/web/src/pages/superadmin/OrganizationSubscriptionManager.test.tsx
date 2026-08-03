import type { ManageOrganizationSubscriptionInput, OrganizationDetailSubscription } from "@albatrans/contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrganizationSubscriptionManager } from "./OrganizationSubscriptionManager";

const subscription: OrganizationDetailSubscription = { planId: "plan-1", planCode: "professional", planName: "Profesional", status: "active", paymentStatus: "paid", startsAt: "2026-01-01T00:00:00Z", periodStartsAt: "2026-08-01T00:00:00Z", periodEndsAt: "2026-08-31T23:59:59Z", paidThrough: "2026-08-31T23:59:59Z", gracePeriodEndsAt: "2026-09-05T00:00:00Z", cancelAtPeriodEnd: false, notes: "Cuenta", raw: { id: "sub-1", organizationId: "org-1", planId: "plan-1", status: "active", paymentStatus: "paid", startsAt: "2026-01-01T00:00:00Z", currentPeriodStartsAt: "2026-08-01T00:00:00Z", currentPeriodEndsAt: "2026-08-31T23:59:59Z", paidThrough: "2026-08-31T23:59:59Z", gracePeriodEndsAt: "2026-09-05T00:00:00Z", cancelAtPeriodEnd: false, notes: "Cuenta", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" } };
afterEach(cleanup);

describe("gestión comercial", () => {
  it("crea una suscripción cuando no existe", async () => {
    const manager = vi.fn(async (id: string, input: ManageOrganizationSubscriptionInput) => ({ organizationId: id, subscriptionId: "sub-new", created: true, input }));
    render(<OrganizationSubscriptionManager organizationId="org-1" subscription={null} manager={manager} onChanged={async () => undefined} />);
    expect(screen.getByText("La empresa todavía no tiene suscripción.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Crear suscripción" }));
    await waitFor(() => expect(manager).toHaveBeenCalledWith("org-1", expect.objectContaining({ planCode: "starter", status: "trial", paymentStatus: "pending" })));
    expect(await screen.findByRole("status")).toHaveTextContent("Suscripción creada");
  });

  it("exige confirmación antes de cambiar de plan", async () => {
    const manager = vi.fn(async (id: string) => ({ organizationId: id, subscriptionId: "sub-1", created: false }));
    render(<OrganizationSubscriptionManager organizationId="org-1" subscription={subscription} manager={manager} onChanged={async () => undefined} />);
    expect(screen.getByLabelText("Plan actual *")).toHaveValue("professional");
    fireEvent.change(screen.getByLabelText("Plan actual *"), { target: { value: "enterprise" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar suscripción" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Confirma expresamente");
    fireEvent.click(screen.getByLabelText(/Confirmo el cambio de Profesional a Enterprise/));
    fireEvent.click(screen.getByRole("button", { name: "Guardar suscripción" }));
    await waitFor(() => expect(manager).toHaveBeenCalledWith("org-1", expect.objectContaining({ planCode: "enterprise" })));
  });

  it("valida fechas y exige motivo para overdue", async () => {
    const manager = vi.fn(async (id: string) => ({ organizationId: id, subscriptionId: "sub-1", created: false }));
    render(<OrganizationSubscriptionManager organizationId="org-1" subscription={subscription} manager={manager} onChanged={async () => undefined} />);
    fireEvent.change(screen.getByLabelText("Inicio del periodo actual"), { target: { value: "2026-09-10T00:00" } });
    fireEvent.change(screen.getByLabelText("Fin del periodo actual"), { target: { value: "2026-09-01T00:00" } });
    fireEvent.change(screen.getByLabelText("Estado de pago *"), { target: { value: "overdue" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar suscripción" }));
    expect(await screen.findByText("El fin del periodo no puede ser anterior al inicio.")).toBeInTheDocument();
    expect(screen.getByText("El motivo es obligatorio para este cambio.")).toBeInTheDocument();
    expect(manager).not.toHaveBeenCalled();
  });

  it("muestra avisos de pago vencido, gracia y expiración", () => {
    const now = Date.now();
    render(<OrganizationSubscriptionManager organizationId="org-1" subscription={{ ...subscription, paymentStatus: "overdue", status: "expired", periodEndsAt: new Date(now - 86_400_000).toISOString(), gracePeriodEndsAt: new Date(now + 86_400_000).toISOString() }} manager={async (id) => ({ organizationId: id, subscriptionId: "sub-1", created: false })} onChanged={async () => undefined} />);
    expect(screen.getByText("Pago vencido o fallido.")).toBeInTheDocument();
    expect(screen.getByText("La suscripción está dentro del periodo de gracia.")).toBeInTheDocument();
    expect(screen.getByText("Suscripción expired.")).toBeInTheDocument();
  });
});
