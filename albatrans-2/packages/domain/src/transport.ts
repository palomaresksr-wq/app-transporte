import type { TransportOrderStatus } from "@albatrans/contracts";
export class TransportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransportValidationError";
  }
}
const forward: Record<TransportOrderStatus, readonly TransportOrderStatus[]> = {
  draft: ["planned", "cancelled"],
  planned: ["assigned", "cancelled"],
  assigned: ["loading", "cancelled"],
  loading: ["in_transit", "cancelled"],
  in_transit: ["unloading", "cancelled"],
  unloading: ["completed", "cancelled"],
  completed: ["archived"],
  cancelled: ["archived"],
  archived: [],
};
export function allowedTransportTransitions(status: TransportOrderStatus) {
  return forward[status];
}
export function validateTransportTransition(
  from: TransportOrderStatus,
  to: TransportOrderStatus,
) {
  if (!forward[from].includes(to)) {
    throw new TransportValidationError(
      `La transición de ${from} a ${to} no está permitida.`,
    );
  }
  return to;
}
export function normalizeTransportType(value: unknown) {
  if (typeof value !== "string") {
    throw new TransportValidationError("El tipo de transporte es obligatorio.");
  }
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean || clean.length > 100) {
    throw new TransportValidationError(
      "El tipo de transporte debe tener entre 1 y 100 caracteres.",
    );
  }
  return clean;
}
export function validatePeriod(
  start: unknown,
  end: unknown,
  label = "periodo",
) {
  if (start === null && end === null) return;
  if (
    typeof start !== "string" || typeof end !== "string" ||
    !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) ||
    Date.parse(end) <= Date.parse(start)
  ) throw new TransportValidationError(`El ${label} no es válido.`);
}
export function nonNegativeInteger(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new TransportValidationError(
      `${label} debe ser un entero igual o mayor que cero.`,
    );
  }
  return number;
}
export function nonNegativeDecimal(value: unknown, label: string) {
  if (value === null || value === "" || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new TransportValidationError(
      `${label} debe ser igual o mayor que cero.`,
    );
  }
  return number;
}
