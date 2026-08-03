import { describe, expect, it } from "vitest";
import {
  canTransitionOrganizationStatus,
  isOrganizationOperational,
  isPaymentAttentionRequired,
  isSubscriptionUsable,
  organizationStatusTransitions,
  requiresOrganizationStatusReason
} from "./organizations";

describe("estado de organizaciones", () => {
  it("solo considera operativa una organización activa", () => {
    expect(isOrganizationOperational("active")).toBe(true);
    expect(isOrganizationOperational("pending")).toBe(false);
    expect(isOrganizationOperational("maintenance")).toBe(false);
    expect(isOrganizationOperational("blocked")).toBe(false);
    expect(isOrganizationOperational("suspended")).toBe(false);
    expect(isOrganizationOperational("archived")).toBe(false);
  });

  it("permite reactivar bloqueadas y suspendidas", () => {
    expect(canTransitionOrganizationStatus("blocked", "active")).toBe(true);
    expect(canTransitionOrganizationStatus("suspended", "active")).toBe(true);
  });

  it("permite entrar y salir de mantenimiento sin archivar", () => {
    expect(
      canTransitionOrganizationStatus("active", "maintenance")
    ).toBe(true);
    expect(
      canTransitionOrganizationStatus("maintenance", "active")
    ).toBe(true);
  });

  it("impide reactivar una organización archivada", () => {
    expect(canTransitionOrganizationStatus("archived", "active")).toBe(false);
  });

  it("exige motivo para bloqueos y suspensiones", () => {
    expect(requiresOrganizationStatusReason("blocked")).toBe(true);
    expect(requiresOrganizationStatusReason("suspended")).toBe(true);
    expect(requiresOrganizationStatusReason("archived")).toBe(true);
    expect(requiresOrganizationStatusReason("active")).toBe(false);
  });

  it("aplica toda la matriz sin aceptar el mismo estado", () => {
    const matrix = {
      pending: ["active", "blocked", "archived"],
      active: ["maintenance", "blocked", "suspended", "archived"],
      maintenance: ["active", "blocked", "suspended", "archived"],
      blocked: ["active", "maintenance", "suspended", "archived"],
      suspended: ["active", "maintenance", "blocked", "archived"],
      archived: []
    } as const;
    const statuses = Object.keys(matrix) as (keyof typeof matrix)[];
    for (const from of statuses) {
      expect(organizationStatusTransitions(from)).toEqual(matrix[from]);
      for (const to of statuses) expect(canTransitionOrganizationStatus(from, to)).toBe(matrix[from].some((target) => target === to));
    }
  });
});

describe("suscripción y pago", () => {
  it("considera utilizables trial y active", () => {
    expect(isSubscriptionUsable("trial")).toBe(true);
    expect(isSubscriptionUsable("active")).toBe(true);
    expect(isSubscriptionUsable("past_due")).toBe(false);
  });

  it("señala estados de pago que requieren atención", () => {
    expect(isPaymentAttentionRequired("pending")).toBe(true);
    expect(isPaymentAttentionRequired("overdue")).toBe(true);
    expect(isPaymentAttentionRequired("failed")).toBe(true);
    expect(isPaymentAttentionRequired("paid")).toBe(false);
    expect(isPaymentAttentionRequired("not_required")).toBe(false);
  });
});
