export type MasterDataResource =
  | "drivers"
  | "clients"
  | "client_contacts"
  | "locations"
  | "vehicles"
  | "trailers"
  | "driver_vehicle_assignments";
export type DriverEmploymentStatus =
  | "pending"
  | "active"
  | "inactive"
  | "on_leave"
  | "terminated"
  | "archived";
export type MasterDataStatus = "active" | "inactive" | "archived";
export type FleetAssetStatus = MasterDataStatus | "maintenance";
export type MasterDataModule =
  | "transport_management"
  | "client_management"
  | "vehicle_management";
export type MasterDataAction =
  | "create"
  | "update"
  | "change_status"
  | "archive"
  | "link_membership"
  | "unlink_membership"
  | "end_assignment";

export interface MasterDataCommand {
  action: MasterDataAction;
  resource: MasterDataResource;
  organizationId: string;
  entityId?: string;
  values?: Record<string, string | number | boolean | null>;
  reason?: string;
}

export interface MasterDataCommandResult {
  resource: MasterDataResource;
  organizationId: string;
  entityId: string;
  action: MasterDataAction;
}

export interface MasterDataListQuery {
  organizationId: string;
  resource: Exclude<MasterDataResource, "driver_vehicle_assignments">;
  search: string;
  status: string;
  page: number;
  pageSize: number;
}

export interface MasterDataListResult<Row> {
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
}
