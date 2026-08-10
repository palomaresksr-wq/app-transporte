import type {
  BillingCalculationInput,
  BillingCalculationLine,
  BillingCalculationResult,
  BillingOrderChargeInput,
  BillingPreinvoiceStatus,
  BillingRateCandidate,
  BillingRateComponentInput,
  BillingRateSelectionContext,
  BillingRateSelectionResult,
  TransportEconomicStatus,
} from "@albatrans/contracts";

export class BillingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingValidationError";
  }
}

const MONEY_SCALE = 4n;
const MONEY_FACTOR = 10n ** MONEY_SCALE;
const CENTS_FACTOR = 100n;
const PRODUCT_TO_CENTS_DIVISOR = 10n ** 6n;
const PERCENT_TO_CENTS_DIVISOR = 10n ** 6n;

export function calculateBilling(input: BillingCalculationInput): BillingCalculationResult {
  validateCurrencyCode(input.currencyCode);
  if (input.rate.currencyCode !== input.currencyCode) {
    throw new BillingValidationError("La moneda de la tarifa debe coincidir con la del cálculo.");
  }

  const lines: BillingCalculationLine[] = [];
  const metrics = {
    billableKm: decimalOrZero(input.metrics.billableKm),
    deliveryStops: BigInt(input.metrics.deliveryStops ?? 0),
    packages: BigInt(input.metrics.packages ?? 0),
    weightKg: decimalOrZero(input.metrics.weightKg),
    volumeM3: decimalOrZero(input.metrics.volumeM3),
  };

  let baseCents = 0n;
  for (const component of input.rate.components) {
    const line = rateComponentLine(component, metrics);
    baseCents += parseMoneyToCents(line.amount);
    lines.push(line);
  }

  const selectedSupplements = input.selectedSupplements ?? [];
  const fixedSupplementLines = selectedSupplements.filter((charge) => charge.chargeMode !== "percent");
  const percentSupplementLines = selectedSupplements.filter((charge) => charge.chargeMode === "percent");

  let supplementsCents = 0n;
  for (const supplement of fixedSupplementLines) {
    const line = chargeLine("supplement", supplement, baseCents + supplementsCents);
    supplementsCents += parseMoneyToCents(line.amount);
    lines.push(line);
  }

  const percentageBaseCents = baseCents + supplementsCents;
  for (const supplement of percentSupplementLines) {
    const line = chargeLine("supplement", supplement, percentageBaseCents);
    supplementsCents += parseMoneyToCents(line.amount);
    lines.push(line);
  }

  const subtotalBeforeAdjustments = baseCents + supplementsCents;
  let adjustmentsCents = 0n;
  for (const adjustment of input.manualAdjustments ?? []) {
    const line = chargeLine("adjustment", adjustment, subtotalBeforeAdjustments);
    adjustmentsCents += signedLineCents(line);
    lines.push(line);
  }

  return {
    currencyCode: input.currencyCode,
    baseAmount: formatCents(baseCents),
    supplementsAmount: formatCents(supplementsCents),
    adjustmentsAmount: formatSignedCents(adjustmentsCents),
    totalAmount: formatCents(baseCents + supplementsCents + adjustmentsCents),
    percentageBaseAmount: formatCents(percentageBaseCents),
    lines,
  };
}

export function selectApplicableBillingRate(
  candidates: BillingRateCandidate[],
  context: BillingRateSelectionContext,
): BillingRateSelectionResult {
  const serviceDate = requiredDate(context.serviceDate, "La fecha del servicio es obligatoria.");
  const applicable = candidates
    .filter((candidate) => candidate.status === "active")
    .filter((candidate) => candidate.clientId === context.clientId)
    .filter((candidate) => matchesOptional(candidate.originLocationId, context.originLocationId))
    .filter((candidate) => matchesOptional(candidate.destinationLocationId, context.destinationLocationId))
    .filter((candidate) => matchesOptional(candidate.serviceType, context.serviceType))
    .filter((candidate) => {
      const from = requiredDate(candidate.validFrom, "La tarifa debe tener vigencia inicial.");
      const until = candidate.validUntil ? requiredDate(candidate.validUntil, "validUntil inválido.") : null;
      return from <= serviceDate && (until === null || until >= serviceDate);
    })
    .sort(compareRateCandidates);

  return {
    selected: applicable[0] ?? null,
    candidates: applicable,
  };
}

export function allowedEconomicTransitions(status: TransportEconomicStatus) {
  const transitions: Record<TransportEconomicStatus, readonly TransportEconomicStatus[]> = {
    unpriced: ["calculated", "cancelled"],
    calculated: ["validated", "needs_recalculation", "cancelled"],
    needs_recalculation: ["calculated", "cancelled"],
    validated: ["needs_recalculation", "prefactured", "invoiced", "cancelled"],
    prefactured: ["validated", "invoiced", "cancelled"],
    invoiced: [],
    cancelled: [],
  };
  return transitions[status];
}

export function validateEconomicTransition(from: TransportEconomicStatus, to: TransportEconomicStatus) {
  if (!allowedEconomicTransitions(from).includes(to)) {
    throw new BillingValidationError(`La transición económica de ${from} a ${to} no está permitida.`);
  }
  return to;
}

export function allowedPreinvoiceTransitions(status: BillingPreinvoiceStatus) {
  const transitions: Record<BillingPreinvoiceStatus, readonly BillingPreinvoiceStatus[]> = {
    draft: ["review", "approved", "cancelled"],
    review: ["draft", "approved", "cancelled"],
    approved: ["converted", "cancelled"],
    cancelled: [],
    converted: [],
  };
  return transitions[status];
}

export function validatePreinvoiceTransition(from: BillingPreinvoiceStatus, to: BillingPreinvoiceStatus) {
  if (!allowedPreinvoiceTransitions(from).includes(to)) {
    throw new BillingValidationError(`La transición de prefactura de ${from} a ${to} no está permitida.`);
  }
  return to;
}

export function isTransportOrderEligibleForPreinvoice(input: {
  economicStatus: TransportEconomicStatus;
  organizationMatches: boolean;
  clientMatches: boolean;
  alreadyPrefactured: boolean;
  alreadyInvoiced: boolean;
}) {
  return input.organizationMatches && input.clientMatches && input.economicStatus === "validated" &&
    !input.alreadyPrefactured && !input.alreadyInvoiced;
}

function rateComponentLine(
  component: BillingRateComponentInput,
  metrics: {
    billableKm: bigint;
    deliveryStops: bigint;
    packages: bigint;
    weightKg: bigint;
    volumeM3: bigint;
  },
): BillingCalculationLine {
  const unitAmount = parseScaled(component.amount, "El importe del componente es obligatorio.");
  if (unitAmount < 0n) {
    throw new BillingValidationError("El importe del componente no puede ser negativo.");
  }

  if (component.componentKind === "base") {
    return buildLine({
      sourceType: "rate_component",
      sourceCode: component.componentKind,
      label: "Servicio base",
      chargeMode: "fixed",
      quantity: "1",
      unitAmount: component.amount,
      amountCents: scaledMoneyToCents(unitAmount),
      effectSign: 1,
    });
  }

  const quantity = component.componentKind === "distance_km"
    ? metrics.billableKm
    : component.componentKind === "delivery_stop"
    ? scaleInteger(metrics.deliveryStops)
    : component.componentKind === "package"
    ? scaleInteger(metrics.packages)
    : component.componentKind === "weight_kg"
    ? metrics.weightKg
    : metrics.volumeM3;

  const quantityLabel = component.componentKind === "distance_km"
    ? "Kilómetros"
    : component.componentKind === "delivery_stop"
    ? "Paradas de entrega"
    : component.componentKind === "package"
    ? "Bultos"
    : component.componentKind === "weight_kg"
    ? "Kilogramos"
    : "Metros cúbicos";

  return buildLine({
    sourceType: "rate_component",
    sourceCode: component.componentKind,
    label: quantityLabel,
    chargeMode: "per_unit",
    quantity: formatScaled(quantity),
    unitAmount: component.amount,
    amountCents: multiplyUnitAmount(unitAmount, quantity),
    effectSign: 1,
  });
}

function chargeLine(
  sourceType: "supplement" | "adjustment",
  charge: BillingOrderChargeInput,
  baseCents: bigint,
): BillingCalculationLine {
  const effectSign = charge.effectSign ?? (sourceType === "adjustment" && charge.code.toLowerCase().includes("discount") ? -1 : 1);
  const quantity = parseScaled(charge.quantity ?? "1", "La cantidad debe ser válida.");
  const amount = parseScaled(charge.amount, "El importe del cargo debe ser válido.");

  if (quantity < 0n) {
    throw new BillingValidationError("La cantidad no puede ser negativa.");
  }
  if (amount < 0n) {
    throw new BillingValidationError("El importe del cargo no puede ser negativo.");
  }

  if (charge.chargeMode === "percent") {
    const calculatedCents = percentToCents(baseCents, amount);
    return buildLine({
      sourceType,
      sourceCode: charge.code,
      label: charge.name,
      chargeMode: charge.chargeMode,
      quantity: "1",
      unitAmount: null,
      percentageRate: charge.amount,
      baseAmount: formatCents(baseCents),
      amountCents: calculatedCents,
      effectSign,
    });
  }

  const calculatedCents = charge.chargeMode === "fixed"
    ? scaledMoneyToCents(amount)
    : multiplyUnitAmount(amount, quantity);

  return buildLine({
    sourceType,
    sourceCode: charge.code,
    label: charge.name,
    chargeMode: charge.chargeMode,
    quantity: formatScaled(quantity),
    unitAmount: charge.amount,
    amountCents: calculatedCents,
    effectSign,
  });
}

function buildLine(input: {
  sourceType: "rate_component" | "supplement" | "adjustment";
  sourceCode: string;
  label: string;
  chargeMode: BillingCalculationLine["chargeMode"];
  quantity: string;
  unitAmount?: string | null;
  percentageRate?: string | null;
  baseAmount?: string | null;
  amountCents: bigint;
  effectSign: -1 | 1;
}): BillingCalculationLine {
  return {
    sourceType: input.sourceType,
    sourceCode: input.sourceCode,
    label: input.label,
    chargeMode: input.chargeMode,
    quantity: input.quantity,
    unitAmount: input.unitAmount ?? null,
    percentageRate: input.percentageRate ?? null,
    baseAmount: input.baseAmount ?? null,
    amount: formatCents(input.amountCents),
    effectSign: input.effectSign,
  };
}

function signedLineCents(line: BillingCalculationLine) {
  const amount = parseMoneyToCents(line.amount);
  return line.effectSign === -1 ? amount * -1n : amount;
}

function compareRateCandidates(left: BillingRateCandidate, right: BillingRateCandidate) {
  return compareNumber(rateSpecificity(right), rateSpecificity(left)) ||
    compareNumber(Date.parse(right.validFrom), Date.parse(left.validFrom)) ||
    compareNumber(right.versionNumber, left.versionNumber) ||
    compareNumber(Date.parse(right.createdAt), Date.parse(left.createdAt));
}

function rateSpecificity(candidate: BillingRateCandidate) {
  return Number(Boolean(candidate.originLocationId)) + Number(Boolean(candidate.destinationLocationId)) +
    Number(Boolean(candidate.serviceType));
}

function matchesOptional(candidate: string | null | undefined, requested: string | null | undefined) {
  return candidate == null || candidate === requested;
}

function compareNumber(left: number, right: number) {
  return left === right ? 0 : left > right ? 1 : -1;
}

function validateCurrencyCode(value: string) {
  if (!/^[A-Z]{3}$/.test(value)) {
    throw new BillingValidationError("La moneda debe usar un código ISO de 3 letras.");
  }
  return value;
}

function requiredDate(value: string, message: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new BillingValidationError(message);
  }
  return timestamp;
}

function decimalOrZero(value: string | null | undefined) {
  return value == null || value === "" ? 0n : parseScaled(value, "El valor decimal no es válido.");
}

function parseScaled(value: string, message: string) {
  const trimmed = value.trim();
  if (!/^-?\d+(?:\.\d{1,4})?$/.test(trimmed)) {
    throw new BillingValidationError(message);
  }
  const sign = trimmed.startsWith("-") ? -1n : 1n;
  const clean = trimmed.replace(/^-/, "");
  const [whole, decimals = ""] = clean.split(".");
  const normalizedDecimals = `${decimals}0000`.slice(0, 4);
  return sign * (BigInt(whole) * MONEY_FACTOR + BigInt(normalizedDecimals));
}

function scaleInteger(value: bigint) {
  return value * MONEY_FACTOR;
}

function scaledMoneyToCents(value: bigint) {
  return divideRounded(value, 10n ** 2n);
}

function multiplyUnitAmount(unitAmount: bigint, quantity: bigint) {
  return divideRounded(unitAmount * quantity, PRODUCT_TO_CENTS_DIVISOR);
}

function percentToCents(baseCents: bigint, percentScaled: bigint) {
  return divideRounded(baseCents * percentScaled, PERCENT_TO_CENTS_DIVISOR);
}

function divideRounded(value: bigint, divisor: bigint) {
  const sign = value < 0n ? -1n : 1n;
  const absolute = value < 0n ? value * -1n : value;
  const quotient = absolute / divisor;
  const remainder = absolute % divisor;
  const rounded = remainder * 2n >= divisor ? quotient + 1n : quotient;
  return rounded * sign;
}

function formatScaled(value: bigint) {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? value * -1n : value;
  const whole = absolute / MONEY_FACTOR;
  const decimals = String(absolute % MONEY_FACTOR).padStart(4, "0").replace(/0+$/, "");
  return decimals ? `${sign}${whole}.${decimals}` : `${sign}${whole}`;
}

function formatCents(value: bigint) {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? value * -1n : value;
  const whole = absolute / CENTS_FACTOR;
  const decimals = String(absolute % CENTS_FACTOR).padStart(2, "0");
  return `${sign}${whole}.${decimals}`;
}

function formatSignedCents(value: bigint) {
  return formatCents(value);
}

function parseMoneyToCents(value: string) {
  const trimmed = value.trim();
  if (!/^-?\d+\.\d{2}$/.test(trimmed)) {
    throw new BillingValidationError("El importe monetario debe tener 2 decimales.");
  }
  const sign = trimmed.startsWith("-") ? -1n : 1n;
  const clean = trimmed.replace(/^-/, "");
  const [whole, decimals] = clean.split(".");
  return sign * (BigInt(whole) * CENTS_FACTOR + BigInt(decimals));
}