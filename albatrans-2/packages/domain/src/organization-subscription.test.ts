import type { ManageOrganizationSubscriptionInput } from "@albatrans/contracts";
import { describe, expect, it } from "vitest";
import { normalizeOrganizationSubscription, subscriptionDaysRemaining, subscriptionReasonRequired, validateOrganizationSubscription } from "./organization-subscription";

const valid: ManageOrganizationSubscriptionInput = { planCode: "professional", status: "active", paymentStatus: "paid", startsAt: "2026-01-01T00:00:00Z", currentPeriodStartsAt: "2026-08-01T00:00:00Z", currentPeriodEndsAt: "2026-08-31T23:59:59Z", paidThrough: "2026-08-31T23:59:59Z", gracePeriodEndsAt: "2026-09-05T00:00:00Z", cancelAtPeriodEnd: false, notes: "Cuenta anual", reason: "" };

describe("gestión comercial de suscripción", () => {
  it("acepta fechas ordenadas y normaliza textos", () => {
    expect(validateOrganizationSubscription(valid)).toEqual({ valid: true, errors: {} });
    expect(normalizeOrganizationSubscription({ ...valid, notes: "  Interna  " }).notes).toBe("Interna");
  });
  it("rechaza fechas inválidas y órdenes incoherentes", () => {
    const result = validateOrganizationSubscription({ ...valid, startsAt: "incorrecta", currentPeriodStartsAt: "2026-09-01", currentPeriodEndsAt: "2026-08-01", gracePeriodEndsAt: "2026-07-01" });
    expect(result.errors).toMatchObject({ startsAt: expect.any(String), currentPeriodEndsAt: expect.any(String), gracePeriodEndsAt: expect.any(String) });
  });
  it("exige motivo para estados comerciales restrictivos", () => {
    for (const status of ["suspended", "cancelled", "expired"] as const) expect(subscriptionReasonRequired({ status, paymentStatus: "paid" })).toBe(true);
    for (const paymentStatus of ["failed", "overdue"] as const) expect(subscriptionReasonRequired({ status: "active", paymentStatus })).toBe(true);
    expect(validateOrganizationSubscription({ ...valid, paymentStatus: "overdue", reason: "" }).errors.reason).toBeDefined();
  });
  it("calcula días restantes incluyendo vencimientos pasados", () => {
    expect(subscriptionDaysRemaining("2026-08-12T00:00:00Z", new Date("2026-08-10T00:00:00Z"))).toBe(2);
    expect(subscriptionDaysRemaining("2026-08-09T00:00:00Z", new Date("2026-08-10T00:00:00Z"))).toBe(-1);
    expect(subscriptionDaysRemaining(null)).toBeNull();
  });
});
