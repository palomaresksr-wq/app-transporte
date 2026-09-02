export const CLIENT_PORTAL_ROLES = ["client_admin", "client_viewer"] as const;
export type ClientPortalRole = (typeof CLIENT_PORTAL_ROLES)[number];
export const CLIENT_PORTAL_STATUSES = ["active", "blocked", "revoked"] as const;
export type ClientPortalStatus = (typeof CLIENT_PORTAL_STATUSES)[number];

export const CLIENT_VISIBILITY_KEYS = [
  "transport_status", "planned_dates", "actual_dates", "goods_summary",
  "incidents", "pod", "regulatory_documents", "invoices", "signatures"
] as const;
export type ClientVisibilityKey = (typeof CLIENT_VISIBILITY_KEYS)[number];
export type ClientVisibilityPolicy = Readonly<Record<ClientVisibilityKey, boolean>>;

export interface ClientPortalMembership {
  id: string;
  organizationId: string;
  customerId: string;
  userId: string;
  role: ClientPortalRole;
  status: ClientPortalStatus;
  createdBy: string;
  createdAt: string;
  lastAccessAt: string | null;
}

export interface ClientPortalSummary {
  organizationName: string;
  customerName: string;
  supportEmail: string | null;
  supportPhone: string | null;
  policy: ClientVisibilityPolicy;
  activeTransports: number;
  upcomingTransports: number;
  recentCompleted: number;
  pendingInvoices: number;
  visibleIncidents: number;
}

export interface ClientTransportListItem {
  id: string;
  orderNumber: string;
  status: string;
  statusLabel: string;
  priority: string;
  plannedPickupAt: string | null;
  plannedDeliveryAt: string | null;
  origin: string | null;
  destination: string | null;
  podAvailable: boolean;
  documentCount: number;
}

export interface ClientInvoiceListItem {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  status: string;
  currencyCode: string;
  totalMinor: number;
  amountDueMinor: number;
}
