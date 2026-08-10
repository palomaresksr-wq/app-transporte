import type {
  BillingCalculationResult,
  BillingChargeMode,
  BillingPreinvoiceStatus,
  BillingRateStatus,
} from "@albatrans/contracts";
import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../infrastructure/supabase/client";
import type { Database } from "../infrastructure/supabase/database.types";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type Client = SupabaseClient<Database & BillingSchema>;

type BillingSchema = {
  public: {
    Tables: {
      billing_rates: {
        Row: BillingRateRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      billing_supplement_definitions: {
        Row: BillingSupplementDefinitionRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      transport_order_billing_supplements: {
        Row: TransportOrderBillingSupplementRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      transport_order_pricing_adjustments: {
        Row: TransportOrderPricingAdjustmentRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      transport_order_valuations: {
        Row: TransportOrderValuationRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      billing_preinvoices: {
        Row: BillingPreinvoiceRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      billing_preinvoice_lines: {
        Row: BillingPreinvoiceLineRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    Views: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export interface BillingRateRow {
  id: string;
  organization_id: string;
  client_id: string;
  origin_location_id: string | null;
  destination_location_id: string | null;
  service_type: string | null;
  name: string;
  status: BillingRateStatus;
  valid_from: string;
  valid_until: string | null;
  currency_code: string;
  version_group_id: string;
  version_number: number;
  previous_rate_id: string | null;
  components_json: Json;
  supplement_rules_json: Json;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface BillingSupplementDefinitionRow {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  charge_mode: BillingChargeMode;
  amount: number;
  unit_code: string | null;
  percentage_base: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface TransportOrderBillingSupplementRow {
  id: string;
  organization_id: string;
  transport_order_id: string;
  supplement_definition_id: string | null;
  code: string;
  name: string;
  charge_mode: BillingChargeMode;
  amount: number;
  quantity: number;
  unit_code: string | null;
  percentage_base: string | null;
  created_by: string;
  created_at: string;
  removed_by: string | null;
  removed_at: string | null;
  remove_reason: string | null;
}

export interface TransportOrderPricingAdjustmentRow {
  id: string;
  organization_id: string;
  transport_order_id: string;
  adjustment_kind: string;
  effect_sign: number;
  charge_mode: BillingChargeMode;
  amount: number;
  quantity: number;
  unit_code: string | null;
  percentage_base: string | null;
  reason: string;
  created_by: string;
  created_at: string;
}

export interface TransportOrderValuationRow {
  id: string;
  organization_id: string;
  transport_order_id: string;
  valuation_number: number;
  billing_rate_id: string | null;
  rate_snapshot_json: Json;
  input_snapshot_json: Json;
  breakdown_json: Json;
  base_amount: number;
  supplements_amount: number;
  adjustments_amount: number;
  total_amount: number;
  currency_code: string;
  calculated_by: string;
  calculated_at: string;
  validated_by: string | null;
  validated_at: string | null;
  reopened_by: string | null;
  reopened_at: string | null;
  superseded_by_valuation_id: string | null;
  correlation_id: string;
  idempotency_key: string;
}

export interface BillingPreinvoiceRow {
  id: string;
  organization_id: string;
  client_id: string;
  reference: string;
  period_start: string;
  period_end: string;
  status: BillingPreinvoiceStatus;
  currency_code: string;
  subtotal_amount: number;
  adjustments_amount: number;
  total_amount: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  approved_by: string | null;
  approved_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  notes: string | null;
}

export interface BillingPreinvoiceLineRow {
  id: string;
  organization_id: string;
  preinvoice_id: string;
  transport_order_id: string;
  valuation_id: string;
  line_amount: number;
  description: string;
  created_by: string;
  created_at: string;
  removed_by: string | null;
  removed_at: string | null;
  remove_reason: string | null;
}

export interface BillingRateView extends BillingRateRow {
  clientName: string;
}

export interface TransportBillingView {
  order: Pick<Database["public"]["Tables"]["transport_orders"]["Row"], "id" | "customer_id" | "transport_type" | "billable_km" | "economic_status" | "current_valuation_id">;
  customerName: string;
  valuation: TransportOrderValuationRow | null;
  supplements: TransportOrderBillingSupplementRow[];
  adjustments: TransportOrderPricingAdjustmentRow[];
  activePreinvoice: BillingPreinvoiceRow | null;
}

export interface PrefacturableOrderRow {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  valuationId: string;
  updatedAt: string;
}

export async function loadBillingRates(
  input: { organizationId: string; clientId?: string; includeHistorical?: boolean; search?: string },
  client: Client = requiredClient(),
): Promise<BillingRateView[]> {
  let request = client.from("billing_rates").select("*").eq("organization_id", input.organizationId).order("created_at", {
    ascending: false,
  });
  if (input.clientId && input.clientId !== "all") request = request.eq("client_id", input.clientId);
  if (!input.includeHistorical) request = request.in("status", ["active", "inactive"]);
  if (input.search?.trim()) request = request.ilike("name", `%${input.search.trim()}%`);

  const result = await request;
  if (result.error) throw new Error(`No se pudieron cargar las tarifas: ${result.error.message}`);

  const clientIds = [...new Set((result.data ?? []).map((row) => row.client_id))];
  const clients = clientIds.length
    ? await client.from("clients").select("id,trade_name").in("id", clientIds)
    : { data: [], error: null };
  if (clients.error) throw new Error(`No se pudieron cargar clientes: ${clients.error.message}`);

  return (result.data ?? []).map((row) => ({
    ...row,
    clientName: clients.data.find((clientRow) => clientRow.id === row.client_id)?.trade_name ?? row.client_id,
  }));
}

export async function loadBillingSupplementDefinitions(
  organizationId: string,
  client: Client = requiredClient(),
): Promise<BillingSupplementDefinitionRow[]> {
  const result = await client.from("billing_supplement_definitions").select("*").eq("organization_id", organizationId).order(
    "name",
  );
  if (result.error) throw new Error(`No se pudieron cargar los suplementos: ${result.error.message}`);
  return result.data ?? [];
}

export async function loadTransportBillingView(
  organizationId: string,
  orderId: string,
  client: Client = requiredClient(),
): Promise<TransportBillingView | null> {
  const order = await client.from("transport_orders").select("id,customer_id,transport_type,billable_km,economic_status,current_valuation_id").eq(
    "organization_id",
    organizationId,
  ).eq("id", orderId).maybeSingle();
  if (order.error) throw order.error;
  if (!order.data) return null;

  const [customer, valuation, supplements, adjustments, preinvoiceLine] = await Promise.all([
    client.from("clients").select("trade_name").eq("id", order.data.customer_id).single(),
    order.data.current_valuation_id
      ? client.from("transport_order_valuations").select("*").eq("organization_id", organizationId).eq(
        "id",
        order.data.current_valuation_id,
      ).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    client.from("transport_order_billing_supplements").select("*").eq("organization_id", organizationId).eq(
      "transport_order_id",
      orderId,
    ).is("removed_at", null).order("created_at", { ascending: true }),
    client.from("transport_order_pricing_adjustments").select("*").eq("organization_id", organizationId).eq(
      "transport_order_id",
      orderId,
    ).order("created_at", { ascending: true }),
    client.from("billing_preinvoice_lines").select("*").eq("organization_id", organizationId).eq("transport_order_id", orderId).is(
      "removed_at",
      null,
    ).maybeSingle(),
  ]);

  if (customer.error) throw customer.error;
  if (valuation.error) throw valuation.error;
  if (supplements.error) throw supplements.error;
  if (adjustments.error) throw adjustments.error;
  if (preinvoiceLine.error) throw preinvoiceLine.error;

  const activePreinvoice = preinvoiceLine.data
    ? await client.from("billing_preinvoices").select("*").eq("organization_id", organizationId).eq(
      "id",
      preinvoiceLine.data.preinvoice_id,
    ).maybeSingle()
    : { data: null, error: null };
  if (activePreinvoice.error) throw activePreinvoice.error;

  return {
    order: order.data,
    customerName: customer.data.trade_name,
    valuation: valuation.data,
    supplements: supplements.data ?? [],
    adjustments: adjustments.data ?? [],
    activePreinvoice: activePreinvoice.data,
  };
}

export async function loadBillingPreinvoices(
  input: { organizationId: string; clientId?: string },
  client: Client = requiredClient(),
): Promise<Array<BillingPreinvoiceRow & { clientName: string; lineCount: number }>> {
  let request = client.from("billing_preinvoices").select("*").eq("organization_id", input.organizationId).order("created_at", {
    ascending: false,
  });
  if (input.clientId && input.clientId !== "all") request = request.eq("client_id", input.clientId);
  const result = await request;
  if (result.error) throw new Error(`No se pudieron cargar las prefacturas: ${result.error.message}`);

  const preinvoiceIds = (result.data ?? []).map((row) => row.id);
  const clientIds = [...new Set((result.data ?? []).map((row) => row.client_id))];
  const [lines, clients] = await Promise.all([
    preinvoiceIds.length
      ? client.from("billing_preinvoice_lines").select("preinvoice_id,id,removed_at").in("preinvoice_id", preinvoiceIds)
      : Promise.resolve({ data: [], error: null }),
    clientIds.length
      ? client.from("clients").select("id,trade_name").in("id", clientIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (lines.error) throw new Error(`No se pudieron cargar las líneas de prefactura: ${lines.error.message}`);
  if (clients.error) throw new Error(`No se pudieron cargar los clientes: ${clients.error.message}`);

  return (result.data ?? []).map((row) => ({
    ...row,
    clientName: clients.data.find((clientRow) => clientRow.id === row.client_id)?.trade_name ?? row.client_id,
    lineCount: lines.data.filter((line) => line.preinvoice_id === row.id && line.removed_at === null).length,
  }));
}

export async function loadBillingPreinvoiceLines(
  organizationId: string,
  preinvoiceId: string,
  client: Client = requiredClient(),
): Promise<BillingPreinvoiceLineRow[]> {
  const result = await client.from("billing_preinvoice_lines").select("*").eq("organization_id", organizationId).eq(
    "preinvoice_id",
    preinvoiceId,
  ).order("created_at", { ascending: true });
  if (result.error) throw new Error(`No se pudieron cargar las líneas de la prefactura: ${result.error.message}`);
  return result.data ?? [];
}

export async function loadPrefacturableOrders(
  input: { organizationId: string; clientId?: string },
  client: Client = requiredClient(),
): Promise<PrefacturableOrderRow[]> {
  let orders = client.from("transport_orders").select(
    "id,order_number,customer_id,economic_status,current_valuation_id,updated_at",
  ).eq("organization_id", input.organizationId).eq("economic_status", "validated").order("updated_at", { ascending: false });
  if (input.clientId && input.clientId !== "all") orders = orders.eq("customer_id", input.clientId);

  const ordersResult = await orders;
  if (ordersResult.error) throw new Error(`No se pudieron cargar las órdenes prefacturables: ${ordersResult.error.message}`);
  const validOrders = (ordersResult.data ?? []).filter((row) => row.current_valuation_id);
  const orderIds = validOrders.map((row) => row.id);
  const valuationIds = validOrders.map((row) => row.current_valuation_id as string);
  const clientIds = [...new Set(validOrders.map((row) => row.customer_id))];

  const [valuations, clients, activeLines] = await Promise.all([
    valuationIds.length
      ? client.from("transport_order_valuations").select("id,total_amount").in("id", valuationIds)
      : Promise.resolve({ data: [], error: null }),
    clientIds.length ? client.from("clients").select("id,trade_name").in("id", clientIds) : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? client.from("billing_preinvoice_lines").select("transport_order_id,removed_at").in("transport_order_id", orderIds).is(
        "removed_at",
        null,
      )
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (valuations.error) throw new Error(`No se pudieron cargar las valoraciones: ${valuations.error.message}`);
  if (clients.error) throw new Error(`No se pudieron cargar los clientes: ${clients.error.message}`);
  if (activeLines.error) throw new Error(`No se pudo comprobar la duplicidad de prefactura: ${activeLines.error.message}`);

  return validOrders
    .filter((row) => !activeLines.data.some((line) => line.transport_order_id === row.id))
    .map((row) => ({
      orderId: row.id,
      orderNumber: row.order_number,
      customerId: row.customer_id,
      customerName: clients.data.find((clientRow) => clientRow.id === row.customer_id)?.trade_name ?? row.customer_id,
      totalAmount: valuations.data.find((valuation) => valuation.id === row.current_valuation_id)?.total_amount ?? 0,
      valuationId: row.current_valuation_id as string,
      updatedAt: row.updated_at,
    }));
}

export async function createBillingRate(input: Record<string, unknown>, client: Client = requiredClient()) {
  return invokeBilling(client, { action: "create_rate", ...input });
}

export async function versionBillingRate(input: Record<string, unknown>, client: Client = requiredClient()) {
  return invokeBilling(client, { action: "version_rate", ...input });
}

export async function deactivateBillingRate(input: Record<string, unknown>, client: Client = requiredClient()) {
  return invokeBilling(client, { action: "deactivate_rate", ...input });
}

export async function createSupplementDefinition(input: Record<string, unknown>, client: Client = requiredClient()) {
  return invokeBilling(client, { action: "create_supplement_definition", ...input });
}

export async function addOrderSupplement(input: Record<string, unknown>, client: Client = requiredClient()) {
  return invokeBilling(client, { action: "add_order_supplement", ...input });
}

export async function addOrderAdjustment(input: Record<string, unknown>, client: Client = requiredClient()) {
  return invokeBilling(client, { action: "add_order_adjustment", ...input });
}

export async function calculateOrderBilling(input: Record<string, unknown>, client: Client = requiredClient()) {
  return invokeBilling(client, { action: "calculate_order", ...input }) as Promise<Record<string, unknown> & { breakdown: BillingCalculationResult }>;
}

export async function validateOrderBilling(input: Record<string, unknown>, client: Client = requiredClient()) {
  return invokeBilling(client, { action: "validate_valuation", ...input });
}

export async function reopenOrderBilling(input: Record<string, unknown>, client: Client = requiredClient()) {
  return invokeBilling(client, { action: "reopen_valuation", ...input });
}

export async function createBillingPreinvoice(input: Record<string, unknown>, client: Client = requiredClient()) {
  return invokeBilling(client, { action: "create_preinvoice", ...input });
}

export async function addOrdersToBillingPreinvoice(input: Record<string, unknown>, client: Client = requiredClient()) {
  return invokeBilling(client, { action: "add_orders_to_preinvoice", ...input });
}

export async function removeOrderFromBillingPreinvoice(input: Record<string, unknown>, client: Client = requiredClient()) {
  return invokeBilling(client, { action: "remove_order_from_preinvoice", ...input });
}

export async function approveBillingPreinvoice(input: Record<string, unknown>, client: Client = requiredClient()) {
  return invokeBilling(client, { action: "approve_preinvoice", ...input });
}

export async function cancelBillingPreinvoice(input: Record<string, unknown>, client: Client = requiredClient()) {
  return invokeBilling(client, { action: "cancel_preinvoice", ...input });
}

export function summarizeRateComponents(componentsJson: Json) {
  if (!Array.isArray(componentsJson) || componentsJson.length === 0) return "Sin componentes";
  return componentsJson.map((component) => {
    if (typeof component !== "object" || component === null) return "Componente inválido";
    const row = component as Record<string, unknown>;
    const amount = typeof row.amount === "string" ? row.amount : "0";
    switch (row.componentKind) {
      case "base":
        return `Base ${amount} €`;
      case "distance_km":
        return `${amount} €/km`;
      case "delivery_stop":
        return `${amount} €/parada`;
      case "package":
        return `${amount} €/bulto`;
      case "weight_kg":
        return `${amount} €/kg`;
      case "volume_m3":
        return `${amount} €/m3`;
      default:
        return String(row.componentKind ?? "Componente");
    }
  }).join(" + ");
}

function requiredClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no está configurado.");
  return client as Client;
}

async function invokeBilling(client: Client, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : crypto.randomUUID();
  const result = await client.functions.invoke<Record<string, unknown>>("billing", {
    body: { ...body, idempotencyKey },
    headers: { "idempotency-key": idempotencyKey },
  });
  if (result.error) {
    if (result.error instanceof FunctionsHttpError) {
      const payload: unknown = await result.error.context.json().catch(() => null);
      if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string") {
        throw new Error(payload.error.message);
      }
    }
    throw result.error;
  }
  if (!isRecord(result.data)) throw new Error("La operación de facturación no devolvió datos válidos.");
  return result.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
