import type { ExecutionStatus, IncidentStatus } from "@albatrans/contracts";

export class ExecutionValidationError extends Error {
  constructor(message: string) { super(message); this.name = "ExecutionValidationError"; }
}
const transitions: Record<ExecutionStatus, readonly ExecutionStatus[]> = {
  pending: ["driver_notified", "heading_to_pickup", "cancelled"],
  driver_notified: ["heading_to_pickup", "cancelled"],
  heading_to_pickup: ["arrived_pickup", "cancelled"],
  arrived_pickup: ["waiting_pickup", "loading", "cancelled"],
  waiting_pickup: ["loading", "cancelled"],
  loading: ["loaded", "cancelled"], loaded: ["departed_pickup", "cancelled"],
  departed_pickup: ["in_transit", "arrived_delivery", "cancelled"],
  in_transit: ["arrived_delivery", "cancelled"],
  arrived_delivery: ["waiting_delivery", "unloading", "cancelled"],
  waiting_delivery: ["unloading", "cancelled"],
  unloading: ["delivered", "cancelled"], delivered: ["completed", "cancelled"],
  completed: [], cancelled: [],
};
export function allowedExecutionTransitions(status: ExecutionStatus) { return transitions[status]; }
export function validateExecutionTransition(from: ExecutionStatus, to: ExecutionStatus) {
  if (!transitions[from].includes(to)) throw new ExecutionValidationError(`La transición operativa de ${from} a ${to} no está permitida.`);
  return to;
}
const incidentTransitions: Record<IncidentStatus, readonly IncidentStatus[]> = {
  open: ["in_progress", "resolved", "archived"], in_progress: ["resolved", "archived"],
  resolved: ["closed", "in_progress", "archived"], closed: ["archived"], archived: [],
};
export function validateIncidentTransition(from: IncidentStatus, to: IncidentStatus) {
  if (!incidentTransitions[from].includes(to)) throw new ExecutionValidationError(`La transición de incidencia de ${from} a ${to} no está permitida.`);
  return to;
}
export function requiredExecutionText(value: unknown, label: string, max = 2000) {
  if (typeof value !== "string") throw new ExecutionValidationError(`${label} es obligatorio.`);
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean || clean.length > max) throw new ExecutionValidationError(`${label} debe tener entre 1 y ${max} caracteres.`);
  return clean;
}
