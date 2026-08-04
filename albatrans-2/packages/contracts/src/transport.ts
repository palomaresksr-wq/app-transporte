export type TransportOrderStatus =
  | "draft"
  | "planned"
  | "assigned"
  | "loading"
  | "in_transit"
  | "unloading"
  | "completed"
  | "cancelled"
  | "archived";
export type TransportPriority = "low" | "normal" | "high" | "urgent";
export type TransportStopType =
  | "pickup"
  | "delivery"
  | "waypoint"
  | "cross_dock"
  | "return";
export type TransportStopStatus =
  | "pending"
  | "arrived"
  | "completed"
  | "skipped";
export type TransportResource = "order" | "stop" | "item" | "assignment";
export type TransportAction =
  | "create"
  | "update"
  | "transition"
  | "archive"
  | "assign"
  | "unassign";
export type TransportValue = string | number | boolean | null;
export interface TransportCommand {
  action: TransportAction;
  resource: TransportResource;
  organizationId: string;
  orderId?: string;
  entityId?: string;
  targetStatus?: TransportOrderStatus;
  values?: Record<string, TransportValue>;
  reason?: string;
}
export interface TransportCommandResult {
  organizationId: string;
  orderId: string;
  entityId: string;
  action: TransportAction;
  eventType: string;
}
export interface TransportOrderListQuery {
  organizationId: string;
  search: string;
  status: string;
  priority: string;
  customerId: string;
  page: number;
  pageSize: number;
}
