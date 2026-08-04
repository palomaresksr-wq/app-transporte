import type {
  MasterDataCommand,
  MasterDataCommandResult,
  MasterDataListQuery,
  MasterDataListResult,
} from "@albatrans/contracts";
import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../infrastructure/supabase/client";
import type { Database } from "../infrastructure/supabase/database.types";

export interface MasterDataRow {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  updatedAt: string;
}
export type MasterDataValues = Record<string, string | number | boolean | null>;
export interface MasterDataOption {
  value: string;
  label: string;
}
export interface AssignmentRow {
  id: string;
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehiclePlate: string;
  startsAt: string;
  endsAt: string | null;
  notes: string | null;
}
type Client = SupabaseClient<Database>;
export async function loadMasterData(
  query: MasterDataListQuery,
  client: Client = requireSupabase(),
): Promise<MasterDataListResult<MasterDataRow>> {
  const from = (query.page - 1) * query.pageSize,
    to = from + query.pageSize - 1,
    term = query.search.trim();
  if (query.resource === "drivers") {
    let q = client.from("drivers").select(
      "id,display_name,employee_number,employment_status,updated_at",
      { count: "exact" },
    ).eq("organization_id", query.organizationId).order("display_name").range(
      from,
      to,
    );
    if (term) {
      q = q.or(`display_name.ilike.%${term}%,employee_number.ilike.%${term}%`);
    }
    if (query.status !== "all") {
      q = q.eq(
        "employment_status",
        query.status as Database["public"]["Enums"]["driver_employment_status"],
      );
    }
    const r = await q;
    if (r.error) throw r.error;
    return result(
      r.data.map((x) => ({
        id: x.id,
        title: x.display_name,
        subtitle: x.employee_number ?? "Sin número",
        status: x.employment_status,
        updatedAt: x.updated_at,
      })),
      r.count,
      query,
    );
  }
  if (query.resource === "clients") {
    let q = client.from("clients").select(
      "id,trade_name,legal_name,status,updated_at",
      { count: "exact" },
    ).eq("organization_id", query.organizationId).order("trade_name").range(
      from,
      to,
    );
    if (term) q = q.or(`trade_name.ilike.%${term}%,legal_name.ilike.%${term}%`);
    if (query.status !== "all") {
      q = q.eq(
        "status",
        query.status as Database["public"]["Enums"]["master_data_status"],
      );
    }
    const r = await q;
    if (r.error) throw r.error;
    return result(
      r.data.map((x) => ({
        id: x.id,
        title: x.trade_name,
        subtitle: x.legal_name,
        status: x.status,
        updatedAt: x.updated_at,
      })),
      r.count,
      query,
    );
  }
  const fleet = query.resource === "vehicles"
    ? client.from("vehicles")
    : query.resource === "trailers"
    ? client.from("trailers")
    : null;
  if (fleet) {
    let q = fleet.select(
      "id,registration_plate,internal_code,status,updated_at",
      { count: "exact" },
    ).eq("organization_id", query.organizationId).order("registration_plate")
      .range(from, to);
    if (term) {
      q = q.or(
        `registration_plate.ilike.%${term}%,internal_code.ilike.%${term}%`,
      );
    }
    if (query.status !== "all") {
      q = q.eq(
        "status",
        query.status as Database["public"]["Enums"]["fleet_asset_status"],
      );
    }
    const r = await q;
    if (r.error) throw r.error;
    return result(
      r.data.map((x) => ({
        id: x.id,
        title: x.registration_plate,
        subtitle: x.internal_code ?? "Sin código",
        status: x.status,
        updatedAt: x.updated_at,
      })),
      r.count,
      query,
    );
  }
  if (query.resource === "locations") {
    let q = client.from("locations").select("id,name,city,status,updated_at", {
      count: "exact",
    }).eq("organization_id", query.organizationId).order("name").range(
      from,
      to,
    );
    if (term) q = q.or(`name.ilike.%${term}%,city.ilike.%${term}%`);
    if (query.status !== "all") {
      q = q.eq(
        "status",
        query.status as Database["public"]["Enums"]["master_data_status"],
      );
    }
    const r = await q;
    if (r.error) throw r.error;
    return result(
      r.data.map((x) => ({
        id: x.id,
        title: x.name,
        subtitle: x.city,
        status: x.status,
        updatedAt: x.updated_at,
      })),
      r.count,
      query,
    );
  }
  let q = client.from("client_contacts").select("id,name,role,updated_at", {
    count: "exact",
  }).eq("organization_id", query.organizationId).order("name").range(from, to);
  if (term) q = q.ilike("name", `%${term}%`);
  const r = await q;
  if (r.error) throw r.error;
  return result(
    r.data.map((x) => ({
      id: x.id,
      title: x.name,
      subtitle: x.role ?? "Contacto",
      status: "active",
      updatedAt: x.updated_at,
    })),
    r.count,
    query,
  );
}
function result(
  items: MasterDataRow[],
  total: number | null,
  q: MasterDataListQuery,
) {
  return { items, total: total ?? 0, page: q.page, pageSize: q.pageSize };
}
export async function loadMasterDataRecord(
  resource: MasterDataListQuery["resource"],
  id: string,
  client: Client = requireSupabase(),
): Promise<MasterDataValues | null> {
  if (resource === "drivers") {
    const r = await client.from("drivers").select(
      "membership_id,employee_number,internal_reference,first_name,last_name,display_name,email,phone,license_number,license_expires_at,employment_status,active_from,active_until,notes",
    ).eq("id", id).maybeSingle();
    if (r.error) throw r.error;
    return r.data;
  }
  if (resource === "clients") {
    const r = await client.from("clients").select(
      "legal_name,trade_name,tax_id,email,phone,billing_email,payment_terms_days,status,external_reference,notes",
    ).eq("id", id).maybeSingle();
    if (r.error) throw r.error;
    return r.data;
  }
  if (resource === "client_contacts") {
    const r = await client.from("client_contacts").select(
      "client_id,name,role,email,phone,is_primary,notes",
    ).eq("id", id).maybeSingle();
    if (r.error) throw r.error;
    return r.data;
  }
  if (resource === "locations") {
    const r = await client.from("locations").select(
      "client_id,name,address_line_1,address_line_2,postal_code,city,region,country_code,latitude,longitude,instructions,status",
    ).eq("id", id).maybeSingle();
    if (r.error) throw r.error;
    return r.data;
  }
  if (resource === "vehicles") {
    const r = await client.from("vehicles").select(
      "registration_plate,internal_code,vehicle_type,brand,model,capacity_kg,capacity_m3,status,inspection_expires_at,insurance_expires_at,notes",
    ).eq("id", id).maybeSingle();
    if (r.error) throw r.error;
    return r.data;
  }
  const r = await client.from("trailers").select(
    "registration_plate,internal_code,trailer_type,brand,model,capacity_kg,capacity_m3,status,inspection_expires_at,insurance_expires_at,notes",
  ).eq("id", id).maybeSingle();
  if (r.error) throw r.error;
  return r.data;
}
export async function loadMasterDataOptions(
  organizationId: string,
  kind: "clients" | "drivers" | "vehicles" | "memberships",
  client: Client = requireSupabase(),
): Promise<MasterDataOption[]> {
  if (kind === "clients") {
    const r = await client.from("clients").select("id,trade_name").eq(
      "organization_id",
      organizationId,
    ).neq("status", "archived").order("trade_name");
    if (r.error) throw r.error;
    return r.data.map((x) => ({ value: x.id, label: x.trade_name }));
  }
  if (kind === "drivers") {
    const r = await client.from("drivers").select("id,display_name").eq(
      "organization_id",
      organizationId,
    ).eq("employment_status", "active").order("display_name");
    if (r.error) throw r.error;
    return r.data.map((x) => ({ value: x.id, label: x.display_name }));
  }
  if (kind === "vehicles") {
    const r = await client.from("vehicles").select("id,registration_plate").eq(
      "organization_id",
      organizationId,
    ).eq("status", "active").order("registration_plate");
    if (r.error) throw r.error;
    return r.data.map((x) => ({ value: x.id, label: x.registration_plate }));
  }
  const memberships = await client.from("organization_memberships").select(
    "id,user_id",
  ).eq("organization_id", organizationId).eq("role", "conductor").eq(
    "status",
    "active",
  );
  if (memberships.error) throw memberships.error;
  if (memberships.data.length === 0) return [];
  const profiles = await client.from("profiles").select("user_id,display_name")
    .in("user_id", memberships.data.map((x) => x.user_id));
  if (profiles.error) throw profiles.error;
  return memberships.data.map((m) => ({
    value: m.id,
    label: profiles.data.find((p) => p.user_id === m.user_id)?.display_name ??
      m.user_id,
  }));
}
export async function loadAssignments(
  organizationId: string,
  page: number,
  pageSize: number,
  client: Client = requireSupabase(),
): Promise<{ items: AssignmentRow[]; total: number }> {
  const from = (page - 1) * pageSize;
  const assignments = await client.from("driver_vehicle_assignments").select(
    "id,driver_id,vehicle_id,starts_at,ends_at,notes",
    { count: "exact" },
  ).eq("organization_id", organizationId).order("starts_at", {
    ascending: false,
  }).range(from, from + pageSize - 1);
  if (assignments.error) throw assignments.error;
  const driverIds = [...new Set(assignments.data.map((row) => row.driver_id))];
  const vehicleIds = [
    ...new Set(assignments.data.map((row) => row.vehicle_id)),
  ];
  const drivers = driverIds.length === 0
    ? { data: [] }
    : await client.from("drivers").select("id,display_name").in(
      "id",
      driverIds,
    );
  if ("error" in drivers && drivers.error) throw drivers.error;
  const vehicles = vehicleIds.length === 0
    ? { data: [] }
    : await client.from("vehicles").select("id,registration_plate").in(
      "id",
      vehicleIds,
    );
  if ("error" in vehicles && vehicles.error) throw vehicles.error;
  return {
    total: assignments.count ?? 0,
    items: assignments.data.map((row) => ({
      id: row.id,
      driverId: row.driver_id,
      driverName: drivers.data.find((driver) => driver.id === row.driver_id)
        ?.display_name ?? "Conductor no disponible",
      vehicleId: row.vehicle_id,
      vehiclePlate:
        vehicles.data.find((vehicle) => vehicle.id === row.vehicle_id)
          ?.registration_plate ?? "Vehículo no disponible",
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      notes: row.notes,
    })),
  };
}
export async function commandMasterData(
  command: MasterDataCommand,
  client: Client = requireSupabase(),
): Promise<MasterDataCommandResult> {
  const r = await client.functions.invoke("master-data", { body: command });
  if (!r.error) {
    if (isCommandResult(r.data)) return r.data;
    throw new Error("Respuesta inválida de Datos Maestros.");
  }
  if (r.error instanceof FunctionsHttpError) {
    const body: unknown = await r.error.context.json();
    if (
      typeof body === "object" && body !== null && "error" in body &&
      typeof body.error === "object" && body.error !== null &&
      "message" in body.error && typeof body.error.message === "string"
    ) throw new Error(body.error.message);
  }
  throw r.error;
}
function requireSupabase(): Client {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no está configurado.");
  return client;
}
function isCommandResult(value: unknown): value is MasterDataCommandResult {
  return typeof value === "object" && value !== null && "resource" in value &&
    typeof value.resource === "string" && "organizationId" in value &&
    typeof value.organizationId === "string" && "entityId" in value &&
    typeof value.entityId === "string" && "action" in value &&
    typeof value.action === "string";
}
