import type { DriverPortalAction, DriverCompletionFacts, DriverCompletionPolicy, DriverTransportSection, ExecutionStatus } from "@albatrans/contracts";

const next: Partial<Record<ExecutionStatus, DriverPortalAction>> = {
  pending: "heading_to_pickup", driver_notified: "heading_to_pickup",
  heading_to_pickup: "arrived_pickup", waiting_pickup: "loading", loading: "loaded",
  loaded: "departed_pickup", departed_pickup: "arrived_delivery", in_transit: "arrived_delivery",
  waiting_delivery: "unloading", unloading: "delivered", delivered: "completed"
};

export function nextDriverAction(status: ExecutionStatus): DriverPortalAction | null { return next[status] ?? null; }
export function driverAlternativeActions(status: ExecutionStatus): readonly DriverPortalAction[] {
  if (status === "arrived_pickup") return ["waiting_pickup", "loading"];
  if (status === "arrived_delivery") return ["waiting_delivery", "unloading"];
  const action = nextDriverAction(status); return action ? [action] : [];
}
export function driverCompletion(policy: DriverCompletionPolicy, facts: DriverCompletionFacts) {
  const missing: string[] = [];
  if (facts.status !== "delivered") missing.push("delivery");
  if (policy.requirePod && !facts.hasPod) missing.push("pod");
  if (policy.requireSignature && !facts.hasSignature) missing.push("signature");
  if (policy.requireDocument && !facts.hasDocument) missing.push("document");
  return { allowed: missing.length === 0, missing, warning: facts.hasOpenCriticalIncident ? "Hay una incidencia crítica abierta." : null };
}
export function classifyDriverTransport(pickup: string | null, status: ExecutionStatus, now = new Date()): DriverTransportSection {
  if (status === "completed") return "recent";
  if (!pickup) return "upcoming";
  const date = new Date(pickup), sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  return sameDay ? "today" : "upcoming";
}
