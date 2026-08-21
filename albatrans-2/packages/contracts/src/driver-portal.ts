import type { ExecutionStatus, IncidentCategory, IncidentSeverity } from "./execution";

export type DriverTransportSection = "today" | "upcoming" | "recent";
export type DriverPortalAction =
  | "heading_to_pickup" | "arrived_pickup" | "waiting_pickup" | "loading"
  | "loaded" | "departed_pickup" | "arrived_delivery" | "waiting_delivery"
  | "unloading" | "delivered" | "completed";

export interface DriverTransportSummary {
  id: string; organizationId: string; orderNumber: string; status: ExecutionStatus;
  priority: string; plannedPickupAt: string | null; plannedDeliveryAt: string | null;
  origin: string; destination: string; packages: number; weightKg: number;
  hasOpenIncident: boolean;
}

export interface DriverCompletionPolicy {
  requirePod: boolean; requireSignature: boolean; requireDocument: boolean;
}

export interface DriverCompletionFacts {
  status: ExecutionStatus; hasPod: boolean; hasSignature: boolean;
  hasDocument: boolean; hasOpenCriticalIncident: boolean;
}

export interface DriverCommand {
  organizationId: string; transportOrderId: string;
  resource: "execution" | "incident" | "note";
  action: "transition" | "create"; targetStatus?: DriverPortalAction;
  values?: Record<string, string | boolean | null>; idempotencyKey: string;
}

export interface DriverIncidentInput {
  category: IncidentCategory; severity: IncidentSeverity; title: string; description: string;
}
