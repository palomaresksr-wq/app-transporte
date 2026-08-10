import type {
  BillingCalculationInput,
  BillingRateCandidate,
} from "@albatrans/contracts";
import { describe, expect, it } from "vitest";
import {
  allowedEconomicTransitions,
  calculateBilling,
  isTransportOrderEligibleForPreinvoice,
  selectApplicableBillingRate,
  validateEconomicTransition,
  validatePreinvoiceTransition,
} from "./billing";

function baseInput(): BillingCalculationInput {
  return {
    currencyCode: "EUR",
    rate: {
      clientId: "client-1",
      currencyCode: "EUR",
      name: "Tarifa demo",
      validFrom: "2026-08-01",
      components: [
        { componentKind: "base", amount: "50.00" },
        { componentKind: "distance_km", amount: "0.80" },
      ],
    },
    metrics: {
      billableKm: "300",
      deliveryStops: 1,
      packages: 0,
      weightKg: "0",
      volumeM3: "0",
    },
    selectedSupplements: [
      { code: "tail_lift", name: "Trampilla", chargeMode: "fixed", amount: "25.00" },
      {
        code: "urgent",
        name: "Urgente",
        chargeMode: "percent",
        amount: "10.00",
        percentageBase: "subtotal_before_percentage",
      },
    ],
    manualAdjustments: [],
  };
}

describe("billing calculation", () => {
  it("calcula tarifa fija", () => {
    const result = calculateBilling({
      currencyCode: "EUR",
      rate: {
        clientId: "client-1",
        currencyCode: "EUR",
        name: "Fija",
        validFrom: "2026-08-01",
        components: [{ componentKind: "base", amount: "450.00" }],
      },
      metrics: {},
    });
    expect(result.baseAmount).toBe("450.00");
    expect(result.totalAmount).toBe("450.00");
  });

  it("calcula tarifa por kilometro", () => {
    const result = calculateBilling({
      currencyCode: "EUR",
      rate: {
        clientId: "client-1",
        currencyCode: "EUR",
        name: "Km",
        validFrom: "2026-08-01",
        components: [{ componentKind: "distance_km", amount: "0.85" }],
      },
      metrics: { billableKm: "300" },
    });
    expect(result.baseAmount).toBe("255.00");
  });

  it("calcula tarifa por parada", () => {
    const result = calculateBilling({
      currencyCode: "EUR",
      rate: {
        clientId: "client-1",
        currencyCode: "EUR",
        name: "Parada",
        validFrom: "2026-08-01",
        components: [{ componentKind: "delivery_stop", amount: "35.00" }],
      },
      metrics: { deliveryStops: 3 },
    });
    expect(result.baseAmount).toBe("105.00");
  });

  it("calcula tarifa por bulto", () => {
    const result = calculateBilling({
      currencyCode: "EUR",
      rate: {
        clientId: "client-1",
        currencyCode: "EUR",
        name: "Bulto",
        validFrom: "2026-08-01",
        components: [{ componentKind: "package", amount: "2.50" }],
      },
      metrics: { packages: 8 },
    });
    expect(result.baseAmount).toBe("20.00");
  });

  it("calcula tarifa por kg", () => {
    const result = calculateBilling({
      currencyCode: "EUR",
      rate: {
        clientId: "client-1",
        currencyCode: "EUR",
        name: "Kg",
        validFrom: "2026-08-01",
        components: [{ componentKind: "weight_kg", amount: "0.18" }],
      },
      metrics: { weightKg: "1250" },
    });
    expect(result.baseAmount).toBe("225.00");
  });

  it("calcula tarifa por m3", () => {
    const result = calculateBilling({
      currencyCode: "EUR",
      rate: {
        clientId: "client-1",
        currencyCode: "EUR",
        name: "M3",
        validFrom: "2026-08-01",
        components: [{ componentKind: "volume_m3", amount: "12.00" }],
      },
      metrics: { volumeM3: "3.5" },
    });
    expect(result.baseAmount).toBe("42.00");
  });

  it("calcula tarifa combinada y suplemento porcentual sobre subtotal antes del porcentaje", () => {
    const result = calculateBilling(baseInput());
    expect(result.baseAmount).toBe("290.00");
    expect(result.percentageBaseAmount).toBe("315.00");
    expect(result.supplementsAmount).toBe("56.50");
    expect(result.totalAmount).toBe("346.50");
  });

  it("aplica descuento fijo y corrección positiva", () => {
    const result = calculateBilling({
      ...baseInput(),
      manualAdjustments: [
        { code: "discount", name: "Descuento", chargeMode: "fixed", amount: "20.00", effectSign: -1 },
        { code: "correction", name: "Corrección", chargeMode: "fixed", amount: "5.25", effectSign: 1 },
      ],
    });
    expect(result.adjustmentsAmount).toBe("-14.75");
    expect(result.totalAmount).toBe("331.75");
  });

  it("redondea de forma determinista a 2 decimales", () => {
    const result = calculateBilling({
      currencyCode: "EUR",
      rate: {
        clientId: "client-1",
        currencyCode: "EUR",
        name: "Redondeo",
        validFrom: "2026-08-01",
        components: [{ componentKind: "distance_km", amount: "0.3333" }],
      },
      metrics: { billableKm: "3" },
    });
    expect(result.totalAmount).toBe("1.00");
  });
});

describe("billing rate selection", () => {
  it("elige la tarifa más específica vigente y más reciente", () => {
    const candidates: BillingRateCandidate[] = [
      {
        id: "default",
        clientId: "client-1",
        originLocationId: null,
        destinationLocationId: null,
        serviceType: null,
        validFrom: "2026-01-01",
        validUntil: null,
        versionNumber: 1,
        status: "active",
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "specific",
        clientId: "client-1",
        originLocationId: "origin-1",
        destinationLocationId: "destination-1",
        serviceType: "General",
        validFrom: "2026-08-01",
        validUntil: null,
        versionNumber: 2,
        status: "active",
        createdAt: "2026-08-01T00:00:00Z",
      },
    ];
    const result = selectApplicableBillingRate(candidates, {
      clientId: "client-1",
      originLocationId: "origin-1",
      destinationLocationId: "destination-1",
      serviceType: "General",
      serviceDate: "2026-08-10",
    });
    expect(result.selected?.id).toBe("specific");
  });

  it("ignora tarifas inactivas o fuera de vigencia", () => {
    const result = selectApplicableBillingRate([
      {
        id: "expired",
        clientId: "client-1",
        validFrom: "2026-01-01",
        validUntil: "2026-01-31",
        versionNumber: 1,
        status: "active",
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "inactive",
        clientId: "client-1",
        validFrom: "2026-08-01",
        validUntil: null,
        versionNumber: 2,
        status: "inactive",
        createdAt: "2026-08-01T00:00:00Z",
      },
    ], {
      clientId: "client-1",
      serviceDate: "2026-08-10",
    });
    expect(result.selected).toBeNull();
  });
});

describe("economic state guards", () => {
  it("permite transiciones válidas e impide inválidas", () => {
    expect(allowedEconomicTransitions("validated")).toContain("prefactured");
    expect(validateEconomicTransition("validated", "prefactured")).toBe("prefactured");
    expect(() => validateEconomicTransition("unpriced", "invoiced")).toThrow(
      "La transición económica de unpriced a invoiced no está permitida.",
    );
  });

  it("valida las transiciones de prefactura", () => {
    expect(validatePreinvoiceTransition("draft", "approved")).toBe("approved");
    expect(() => validatePreinvoiceTransition("converted", "draft")).toThrow();
  });

  it("determina la elegibilidad de prefactura", () => {
    expect(isTransportOrderEligibleForPreinvoice({
      economicStatus: "validated",
      organizationMatches: true,
      clientMatches: true,
      alreadyPrefactured: false,
      alreadyInvoiced: false,
    })).toBe(true);
    expect(isTransportOrderEligibleForPreinvoice({
      economicStatus: "prefactured",
      organizationMatches: true,
      clientMatches: true,
      alreadyPrefactured: true,
      alreadyInvoiced: false,
    })).toBe(false);
  });
});