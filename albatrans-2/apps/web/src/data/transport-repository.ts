import type {
  TransportCommand,
  TransportCommandResult,
  TransportOrderListQuery,
} from "@albatrans/contracts";
import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../infrastructure/supabase/client";
import type { Database } from "../infrastructure/supabase/database.types";
type Client = SupabaseClient<Database>;
export interface TransportOrderRow {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  status: string;
  priority: string;
  transportType: string;
  plannedPickupAt: string | null;
  plannedDeliveryAt: string | null;
  updatedAt: string;
}
export interface TransportDetail {
  order: Database["public"]["Tables"]["transport_orders"]["Row"];
  customerName: string;
  stops: Database["public"]["Tables"]["transport_stops"]["Row"][];
  items: Database["public"]["Tables"]["transport_items"]["Row"][];
  assignments: Database["public"]["Tables"]["transport_assignments"]["Row"][];
  events: Database["public"]["Tables"]["transport_events"]["Row"][];
}
export interface TransportOption {
  value: string;
  label: string;
}
export async function loadTransportOrders(
  query: TransportOrderListQuery,
  client: Client = requireClient(),
) {
  const from = (query.page - 1) * query.pageSize;
  let request = client.from("transport_orders").select(
    "id,order_number,customer_id,status,priority,transport_type,planned_pickup_at,planned_delivery_at,updated_at",
    { count: "exact" },
  ).eq("organization_id", query.organizationId).order("created_at", {
    ascending: false,
  }).range(from, from + query.pageSize - 1);
  if (query.search.trim()) {
    request = request.or(
      `order_number.ilike.%${query.search.trim()}%,transport_type.ilike.%${query.search.trim()}%`,
    );
  }
  if (query.status !== "all") {
    request = request.eq(
      "status",
      query.status as Database["public"]["Enums"]["transport_order_status"],
    );
  }
  if (query.priority !== "all") {
    request = request.eq(
      "priority",
      query.priority as Database["public"]["Enums"]["transport_priority"],
    );
  }
  if (query.customerId !== "all") {
    request = request.eq("customer_id", query.customerId);
  }
  const result = await request;
  if (result.error) throw result.error;
  const customerIds = [...new Set(result.data.map((row) => row.customer_id))];
  const customers = customerIds.length
    ? await client.from("clients").select("id,trade_name").in("id", customerIds)
    : { data: [], error: null };
  if (customers.error) throw customers.error;
  return {
    total: result.count ?? 0,
    items: result.data.map((row) => ({
      id: row.id,
      orderNumber: row.order_number,
      customerId: row.customer_id,
      customerName:
        customers.data.find((customer) => customer.id === row.customer_id)
          ?.trade_name ?? "Cliente no disponible",
      status: row.status,
      priority: row.priority,
      transportType: row.transport_type,
      plannedPickupAt: row.planned_pickup_at,
      plannedDeliveryAt: row.planned_delivery_at,
      updatedAt: row.updated_at,
    })) satisfies TransportOrderRow[],
  };
}
export async function loadTransportDetail(
  organizationId: string,
  orderId: string,
  client: Client = requireClient(),
): Promise<TransportDetail | null> {
  const order = await client.from("transport_orders").select("*").eq(
    "organization_id",
    organizationId,
  ).eq("id", orderId).maybeSingle();
  if (order.error) throw order.error;
  if (!order.data) return null;
  const [customer, stops, items, assignments, events] = await Promise.all([
    client.from("clients").select("trade_name").eq("id", order.data.customer_id)
      .single(),
    client.from("transport_stops").select("*").eq("transport_order_id", orderId)
      .order("position"),
    client.from("transport_items").select("*").eq("transport_order_id", orderId)
      .order("created_at"),
    client.from("transport_assignments").select("*").eq(
      "transport_order_id",
      orderId,
    ).order("created_at", { ascending: false }),
    client.from("transport_events").select("*").eq(
      "transport_order_id",
      orderId,
    ).order("occurred_at", { ascending: true }),
  ]);
  if (customer.error) throw customer.error;
  if (stops.error) throw stops.error;
  if (items.error) throw items.error;
  if (assignments.error) throw assignments.error;
  if (events.error) throw events.error;
  return {
    order: order.data,
    customerName: customer.data.trade_name,
    stops: stops.data,
    items: items.data,
    assignments: assignments.data,
    events: events.data,
  };
}
export async function transportCommand(
  command: TransportCommand,
  client: Client = requireClient(),
): Promise<TransportCommandResult> {
  const result = await client.functions.invoke("transport-core", {
    body: command,
  });
  if (!result.error && validResult(result.data)) return result.data;
  if (result.error instanceof FunctionsHttpError) {
    const body: unknown = await result.error.context.json();
    if (
      record(body) && record(body.error) &&
      typeof body.error.message === "string"
    ) throw new Error(body.error.message);
  }
  throw result.error ??
    new Error("Respuesta inválida del núcleo de transporte.");
}
export async function loadTransportOptions(
  organizationId: string,
  kind: "clients" | "locations" | "drivers" | "vehicles",
  client: Client = requireClient(),
): Promise<TransportOption[]> {
  if (kind === "clients") {
    const result = await client.from("clients").select("id,trade_name").eq(
      "organization_id",
      organizationId,
    ).eq("status", "active").order("trade_name");
    if (result.error) throw result.error;
    return result.data.map((row) => ({ value: row.id, label: row.trade_name }));
  }
  if (kind === "locations") {
    const result = await client.from("locations").select("id,name,city").eq(
      "organization_id",
      organizationId,
    ).eq("status", "active").order("name");
    if (result.error) throw result.error;
    return result.data.map((row) => ({
      value: row.id,
      label: `${row.name} · ${row.city}`,
    }));
  }
  if (kind === "drivers") {
    const result = await client.from("drivers").select("id,display_name").eq(
      "organization_id",
      organizationId,
    ).eq("employment_status", "active").order("display_name");
    if (result.error) throw result.error;
    return result.data.map((row) => ({
      value: row.id,
      label: row.display_name,
    }));
  }
  const result = await client.from("vehicles").select("id,registration_plate")
    .eq("organization_id", organizationId).eq("status", "active").order(
      "registration_plate",
    );
  if (result.error) throw result.error;
  return result.data.map((row) => ({
    value: row.id,
    label: row.registration_plate,
  }));
}
function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no está configurado.");
  return client;
}
function validResult(value: unknown): value is TransportCommandResult {
  return record(value) && typeof value.organizationId === "string" &&
    typeof value.orderId === "string" && typeof value.entityId === "string" &&
    typeof value.action === "string" && typeof value.eventType === "string";
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
