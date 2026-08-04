export const executionStatuses = [
  "pending", "driver_notified", "heading_to_pickup", "arrived_pickup",
  "waiting_pickup", "loading", "loaded", "departed_pickup", "in_transit",
  "arrived_delivery", "waiting_delivery", "unloading", "delivered",
  "completed", "cancelled",
] as const;
export type ExecutionStatus = (typeof executionStatuses)[number];
export const incidentCategories = ["delay", "breakdown", "traffic", "customer_absent", "wrong_address", "missing_goods", "damaged_goods", "documentation", "other"] as const;
export type IncidentCategory = (typeof incidentCategories)[number];
export const incidentSeverities = ["low", "normal", "high", "critical"] as const;
export type IncidentSeverity = (typeof incidentSeverities)[number];
export const incidentStatuses = ["open", "in_progress", "resolved", "closed", "archived"] as const;
export type IncidentStatus = (typeof incidentStatuses)[number];
export type ExecutionResource = "execution" | "incident" | "note";
export type ExecutionAction = "start" | "transition" | "create" | "update" | "archive";
export interface ExecutionCommand {
  organizationId: string;
  transportOrderId: string;
  resource: ExecutionResource;
  action: ExecutionAction;
  entityId?: string;
  targetStatus?: string;
  values?: Record<string, string | boolean | null>;
  reason?: string;
  idempotencyKey?: string;
}
export interface ExecutionCommandResult {
  executionId: string;
  entityId: string;
  eventType: string;
}
