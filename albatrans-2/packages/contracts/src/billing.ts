export const billingRateStatuses = ["active", "inactive", "archived"] as const;
export type BillingRateStatus = (typeof billingRateStatuses)[number];

export const billingRateComponentKinds = [
  "base",
  "distance_km",
  "delivery_stop",
  "package",
  "weight_kg",
  "volume_m3",
] as const;
export type BillingRateComponentKind = (typeof billingRateComponentKinds)[number];

export const billingChargeModes = ["fixed", "percent", "per_unit"] as const;
export type BillingChargeMode = (typeof billingChargeModes)[number];

export const billingPercentageBases = [
  "subtotal_before_percentage",
  "subtotal_before_adjustments",
] as const;
export type BillingPercentageBase = (typeof billingPercentageBases)[number];

export const billingAdjustmentKinds = ["discount", "surcharge", "correction"] as const;
export type BillingAdjustmentKind = (typeof billingAdjustmentKinds)[number];

export const transportEconomicStatuses = [
  "unpriced",
  "calculated",
  "needs_recalculation",
  "validated",
  "prefactured",
  "invoiced",
  "cancelled",
] as const;
export type TransportEconomicStatus = (typeof transportEconomicStatuses)[number];

export const billingPreinvoiceStatuses = ["draft", "review", "approved", "cancelled", "converted"] as const;
export type BillingPreinvoiceStatus = (typeof billingPreinvoiceStatuses)[number];

export interface BillingRateComponentInput {
  componentKind: BillingRateComponentKind;
  amount: string;
}

export interface BillingSupplementRuleInput {
  code: string;
  name: string;
  chargeMode: BillingChargeMode;
  amount: string;
  unitCode?: string | null;
  percentageBase?: BillingPercentageBase;
}

export interface BillingRateDefinitionInput {
  id?: string;
  organizationId?: string;
  clientId: string;
  originLocationId?: string | null;
  destinationLocationId?: string | null;
  serviceType?: string | null;
  currencyCode: string;
  validFrom: string;
  validUntil?: string | null;
  versionGroupId?: string;
  versionNumber?: number;
  status?: BillingRateStatus;
  name: string;
  components: BillingRateComponentInput[];
  supplementRules?: BillingSupplementRuleInput[];
  createdAt?: string;
}

export interface BillingOrderChargeInput {
  id?: string;
  code: string;
  name: string;
  chargeMode: BillingChargeMode;
  amount: string;
  quantity?: string;
  unitCode?: string | null;
  percentageBase?: BillingPercentageBase;
  effectSign?: -1 | 1;
}

export interface BillingCalculationInput {
  currencyCode: string;
  rate: BillingRateDefinitionInput;
  metrics: {
    billableKm?: string | null;
    deliveryStops?: number;
    packages?: number;
    weightKg?: string | null;
    volumeM3?: string | null;
  };
  selectedSupplements?: BillingOrderChargeInput[];
  manualAdjustments?: BillingOrderChargeInput[];
}

export interface BillingCalculationLine {
  sourceType: "rate_component" | "supplement" | "adjustment";
  sourceCode: string;
  label: string;
  chargeMode: BillingChargeMode | "calculated";
  quantity: string;
  unitAmount: string | null;
  percentageRate: string | null;
  baseAmount: string | null;
  amount: string;
  effectSign: -1 | 1;
}

export interface BillingCalculationResult {
  currencyCode: string;
  baseAmount: string;
  supplementsAmount: string;
  adjustmentsAmount: string;
  totalAmount: string;
  percentageBaseAmount: string;
  lines: BillingCalculationLine[];
}

export interface BillingRateCandidate {
  id: string;
  clientId: string;
  originLocationId?: string | null;
  destinationLocationId?: string | null;
  serviceType?: string | null;
  validFrom: string;
  validUntil?: string | null;
  versionNumber: number;
  status: BillingRateStatus;
  createdAt: string;
}

export interface BillingRateSelectionContext {
  clientId: string;
  originLocationId?: string | null;
  destinationLocationId?: string | null;
  serviceType?: string | null;
  serviceDate: string;
}

export interface BillingRateSelectionResult {
  selected: BillingRateCandidate | null;
  candidates: BillingRateCandidate[];
}

export interface BillingPreinvoiceDraftSummary {
  organizationId: string;
  clientId: string;
  status: BillingPreinvoiceStatus;
  orderIds: string[];
  subtotalAmount: string;
  adjustmentsAmount: string;
  totalAmount: string;
}