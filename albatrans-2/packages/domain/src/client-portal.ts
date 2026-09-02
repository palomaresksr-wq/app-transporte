import type { ClientPortalRole, ClientVisibilityKey, ClientVisibilityPolicy } from "@albatrans/contracts";

const STATUS_LABELS: Readonly<Record<string, string>> = {
  draft: "Borrador", planned: "Planificado", assigned: "Asignado", loading: "En carga",
  in_transit: "En tránsito", unloading: "En descarga", completed: "Entregado",
  cancelled: "Cancelado", archived: "Archivado"
};

export function clientTransportStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? "En seguimiento";
}

export function canClientRead(role: ClientPortalRole): boolean {
  return role === "client_admin" || role === "client_viewer";
}

export function canClientManageUsers(role: ClientPortalRole): boolean {
  return role === "client_admin";
}

export function isClientFeatureVisible(policy: ClientVisibilityPolicy, key: ClientVisibilityKey): boolean {
  return policy[key] === true;
}

export function filterClientTimeline<T extends { eventType: string }>(events: readonly T[]): T[] {
  const visible = new Set([
    "transport.planned", "transport.pickup_arrived", "transport.departed",
    "transport.destination_arrived", "transport.completed", "pod.available", "incident.client_visible"
  ]);
  return events.filter((event) => visible.has(event.eventType));
}

export function canAccessClientInvoice(membershipCustomerId: string, invoiceCustomerId: string): boolean {
  return membershipCustomerId === invoiceCustomerId;
}
