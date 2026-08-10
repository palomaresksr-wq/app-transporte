import { createClient } from "npm:@supabase/supabase-js@2.55.0";
import {
  type BillingCalculationInput,
  type BillingOrderChargeInput,
  type BillingRateComponentInput,
  calculateBilling,
  selectApplicableBillingRate,
} from "./calculator.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
  "Content-Type": "application/json",
};

const respond = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
const fail = (status: number, code: string, message: string) => respond(status, { error: { code, message } });
const makeClient = (url: string, key: string) =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

type Client = ReturnType<typeof makeClient>;
type Scope = "platform" | "organization";
type BillingCommandBody = {
  action: string;
  organizationId: string;
  idempotencyKey?: unknown;
  clientId?: unknown;
  rateId?: unknown;
  preinvoiceId?: unknown;
  orderId?: unknown;
  orderIds?: unknown;
  valuationId?: unknown;
  periodStart?: unknown;
  periodEnd?: unknown;
  name?: unknown;
  code?: unknown;
  status?: unknown;
  amount?: unknown;
  quantity?: unknown;
  chargeMode?: unknown;
  adjustmentKind?: unknown;
  effectSign?: unknown;
  percentageBase?: unknown;
  unitCode?: unknown;
  notes?: unknown;
  reason?: unknown;
  currencyCode?: unknown;
  validFrom?: unknown;
  validUntil?: unknown;
  serviceType?: unknown;
  originLocationId?: unknown;
  destinationLocationId?: unknown;
  versionFromRateId?: unknown;
  components?: unknown;
  supplementRules?: unknown;
  supplementDefinitionId?: unknown;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return fail(405, "invalid_request", "Método no permitido.");

  const bearer = request.headers.get("Authorization");
  if (!bearer?.startsWith("Bearer ")) return fail(401, "unauthorized", "Sesión requerida.");

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return fail(500, "configuration_error", "Servicio no configurado.");

  const db = makeClient(url, key);
  const auth = await db.auth.getUser(bearer.slice(7));
  if (auth.error || !auth.data.user) return fail(401, "unauthorized", "Sesión no válida.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_request", "JSON inválido.");
  }

  if (
    !record(body) || typeof body.action !== "string" || typeof body.organizationId !== "string" ||
    !uuid(body.organizationId)
  ) {
    return fail(400, "invalid_request", "Payload inválido.");
  }

  const parsed = body as BillingCommandBody;
  const access = await authorize(db, auth.data.user.id, parsed.organizationId, "billing");
  if (!access.ok) return fail(access.status, access.code, access.message);

  const idempotencyKey = keyFrom(parsed.idempotencyKey, request.headers.get("idempotency-key"));
  if (!idempotencyKey) return fail(400, "invalid_request", "idempotency_key debe ser un UUID válido.");
  const correlationId = crypto.randomUUID();

  try {
    switch (parsed.action) {
      case "create_rate":
        return await createRate(db, auth.data.user.id, parsed, false);
      case "version_rate":
        return await createRate(db, auth.data.user.id, parsed, true);
      case "deactivate_rate":
        return await deactivateRate(db, auth.data.user.id, access.scope, parsed, correlationId, idempotencyKey);
      case "create_supplement_definition":
        return await createSupplementDefinition(db, auth.data.user.id, parsed);
      case "add_order_supplement":
        return await runRpc(db, "add_transport_order_billing_supplement", {
          p_actor: auth.data.user.id,
          p_scope: access.scope,
          p_org: parsed.organizationId,
          p_order: requiredUuid(parsed.orderId),
          p_definition: optionalUuid(parsed.supplementDefinitionId),
          p_code: requiredText(parsed.code),
          p_name: requiredText(parsed.name),
          p_charge_mode: requiredText(parsed.chargeMode),
          p_amount: requiredNumber(parsed.amount),
          p_quantity: optionalNumber(parsed.quantity) ?? 1,
          p_unit_code: optionalText(parsed.unitCode),
          p_percentage_base: optionalText(parsed.percentageBase),
          p_correlation: correlationId,
          p_key: idempotencyKey,
        });
      case "add_order_adjustment":
        return await runRpc(db, "add_transport_order_pricing_adjustment", {
          p_actor: auth.data.user.id,
          p_scope: access.scope,
          p_org: parsed.organizationId,
          p_order: requiredUuid(parsed.orderId),
          p_adjustment_kind: requiredText(parsed.adjustmentKind),
          p_effect_sign: requiredSmallint(parsed.effectSign),
          p_charge_mode: requiredText(parsed.chargeMode),
          p_amount: requiredNumber(parsed.amount),
          p_quantity: optionalNumber(parsed.quantity) ?? 1,
          p_unit_code: optionalText(parsed.unitCode),
          p_percentage_base: optionalText(parsed.percentageBase),
          p_reason: requiredText(parsed.reason),
          p_correlation: correlationId,
          p_key: idempotencyKey,
        });
      case "calculate_order":
        return await calculateOrder(db, auth.data.user.id, access.scope, parsed, correlationId, idempotencyKey);
      case "validate_valuation":
        return await runRpc(db, "validate_transport_order_valuation", {
          p_actor: auth.data.user.id,
          p_scope: access.scope,
          p_org: parsed.organizationId,
          p_order: requiredUuid(parsed.orderId),
          p_reason: optionalText(parsed.reason),
          p_correlation: correlationId,
          p_key: idempotencyKey,
        });
      case "reopen_valuation":
        return await runRpc(db, "reopen_transport_order_valuation", {
          p_actor: auth.data.user.id,
          p_scope: access.scope,
          p_org: parsed.organizationId,
          p_order: requiredUuid(parsed.orderId),
          p_reason: requiredText(parsed.reason),
          p_correlation: correlationId,
          p_key: idempotencyKey,
        });
      case "create_preinvoice":
        return await runRpc(db, "create_billing_preinvoice", {
          p_actor: auth.data.user.id,
          p_scope: access.scope,
          p_org: parsed.organizationId,
          p_client: requiredUuid(parsed.clientId),
          p_period_start: requiredText(parsed.periodStart),
          p_period_end: requiredText(parsed.periodEnd),
          p_order_ids: requiredUuidArray(parsed.orderIds),
          p_notes: optionalText(parsed.notes),
          p_correlation: correlationId,
          p_key: idempotencyKey,
        });
      case "add_orders_to_preinvoice":
        return await runRpc(db, "add_orders_to_billing_preinvoice", {
          p_actor: auth.data.user.id,
          p_scope: access.scope,
          p_org: parsed.organizationId,
          p_preinvoice: requiredUuid(parsed.preinvoiceId),
          p_order_ids: requiredUuidArray(parsed.orderIds),
          p_correlation: correlationId,
          p_key: idempotencyKey,
        });
      case "remove_order_from_preinvoice":
        return await runRpc(db, "remove_order_from_billing_preinvoice", {
          p_actor: auth.data.user.id,
          p_scope: access.scope,
          p_org: parsed.organizationId,
          p_preinvoice: requiredUuid(parsed.preinvoiceId),
          p_order: requiredUuid(parsed.orderId),
          p_reason: requiredText(parsed.reason),
          p_correlation: correlationId,
          p_key: idempotencyKey,
        });
      case "approve_preinvoice":
        return await runRpc(db, "approve_billing_preinvoice", {
          p_actor: auth.data.user.id,
          p_scope: access.scope,
          p_org: parsed.organizationId,
          p_preinvoice: requiredUuid(parsed.preinvoiceId),
          p_correlation: correlationId,
          p_key: idempotencyKey,
        });
      case "cancel_preinvoice":
        return await runRpc(db, "cancel_billing_preinvoice", {
          p_actor: auth.data.user.id,
          p_scope: access.scope,
          p_org: parsed.organizationId,
          p_preinvoice: requiredUuid(parsed.preinvoiceId),
          p_reason: requiredText(parsed.reason),
          p_correlation: correlationId,
          p_key: idempotencyKey,
        });
      default:
        return fail(400, "invalid_action", "Acción de facturación no permitida.");
    }
  } catch (caught) {
    return fail(400, "invalid_request", caught instanceof Error ? caught.message : "Payload inválido.");
  }
});

async function createRate(db: Client, actor: string, body: BillingCommandBody, versioning: boolean) {
  const clientId = requiredUuid(body.clientId);
  const components = requiredArray(body.components);
  const supplementRules = optionalArray(body.supplementRules) ?? [];
  const now = new Date().toISOString();

  let versionGroupId = crypto.randomUUID();
  let versionNumber = 1;
  let previousRateId: string | null = null;

  if (versioning) {
    const originRate = await db
      .from("billing_rates")
      .select("id,version_group_id,version_number,organization_id")
      .eq("organization_id", body.organizationId)
      .eq("id", requiredUuid(body.versionFromRateId ?? body.rateId))
      .single();
    if (originRate.error) return databaseError(originRate.error.code, originRate.error.message);
    versionGroupId = originRate.data.version_group_id;
    versionNumber = Number(originRate.data.version_number) + 1;
    previousRateId = originRate.data.id;
  }

  const insert = await db
    .from("billing_rates")
    .insert({
      organization_id: body.organizationId,
      client_id: clientId,
      origin_location_id: optionalUuid(body.originLocationId),
      destination_location_id: optionalUuid(body.destinationLocationId),
      service_type: optionalText(body.serviceType),
      name: requiredText(body.name),
      status: versioning ? "active" : requiredStatus(body.status),
      valid_from: requiredText(body.validFrom),
      valid_until: optionalText(body.validUntil),
      currency_code: requiredCurrency(body.currencyCode),
      version_group_id: versionGroupId,
      version_number: versionNumber,
      previous_rate_id: previousRateId,
      components_json: components,
      supplement_rules_json: supplementRules,
      created_by: actor,
      created_at: now,
      updated_at: now,
    })
    .select("id,version_group_id,version_number,status")
    .single();

  if (insert.error) return databaseError(insert.error.code, insert.error.message);

  if (previousRateId) {
    const previousUpdate = await db
      .from("billing_rates")
      .update({ status: "inactive", updated_at: now })
      .eq("organization_id", body.organizationId)
      .eq("id", previousRateId);
    if (previousUpdate.error) return databaseError(previousUpdate.error.code, previousUpdate.error.message);
  }

  return respond(200, {
    ok: true,
    rateId: insert.data.id,
    versionGroupId: insert.data.version_group_id,
    versionNumber: insert.data.version_number,
    status: insert.data.status,
  });
}

async function deactivateRate(
  db: Client,
  actor: string,
  scope: Scope,
  body: BillingCommandBody,
  correlationId: string,
  _idempotencyKey: string,
) {
  const result = await db
    .from("billing_rates")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("organization_id", body.organizationId)
    .eq("id", requiredUuid(body.rateId))
    .select("id,status")
    .single();

  if (result.error) return databaseError(result.error.code, result.error.message);

  const audit = await db.from("audit_events").insert({
    organization_id: body.organizationId,
    actor_user_id: actor,
    actor_scope: scope,
    action: "billing.rate_deactivated",
    entity_type: "billing_rate",
    entity_id: result.data.id,
    after_data: { status: result.data.status },
    reason: optionalText(body.reason),
    correlation_id: correlationId,
  });
  if (audit.error) return databaseError(audit.error.code, audit.error.message);

  return respond(200, { ok: true, rateId: result.data.id, status: result.data.status });
}

async function createSupplementDefinition(db: Client, actor: string, body: BillingCommandBody) {
  const result = await db
    .from("billing_supplement_definitions")
    .insert({
      organization_id: body.organizationId,
      code: requiredText(body.code),
      name: requiredText(body.name),
      charge_mode: requiredText(body.chargeMode),
      amount: requiredNumber(body.amount),
      unit_code: optionalText(body.unitCode),
      percentage_base: optionalText(body.percentageBase),
      status: "active",
      created_by: actor,
    })
    .select("id,code,name")
    .single();

  if (result.error) return databaseError(result.error.code, result.error.message);
  return respond(200, {
    ok: true,
    supplementDefinitionId: result.data.id,
    code: result.data.code,
    name: result.data.name,
  });
}

async function calculateOrder(
  db: Client,
  actor: string,
  scope: Scope,
  body: BillingCommandBody,
  correlationId: string,
  idempotencyKey: string,
) {
  const orderId = requiredUuid(body.orderId);
  const orderResult = await db
    .from("transport_orders")
    .select(
      "id,organization_id,order_number,customer_id,transport_type,billable_km,economic_status,current_valuation_id,planned_pickup_at,requested_pickup_at,created_at",
    )
    .eq("organization_id", body.organizationId)
    .eq("id", orderId)
    .single();
  if (orderResult.error) return databaseError(orderResult.error.code, orderResult.error.message);

  const [itemsResult, stopsResult, ratesResult, supplementsResult, adjustmentsResult] = await Promise.all([
    db.from("transport_items").select("packages,weight_kg,volume_m3").eq("organization_id", body.organizationId).eq(
      "transport_order_id",
      orderId,
    ),
    db.from("transport_stops").select("stop_type,location_id").eq("organization_id", body.organizationId).eq(
      "transport_order_id",
      orderId,
    ).order("position", { ascending: true }),
    db.from("billing_rates").select(
      "id,client_id,origin_location_id,destination_location_id,service_type,valid_from,valid_until,version_number,status,created_at,name,currency_code,components_json,supplement_rules_json",
    ).eq("organization_id", body.organizationId).eq("client_id", orderResult.data.customer_id),
    db.from("transport_order_billing_supplements").select(
      "id,code,name,charge_mode,amount,quantity,unit_code,percentage_base",
    ).eq("organization_id", body.organizationId).eq("transport_order_id", orderId).is("removed_at", null),
    db.from("transport_order_pricing_adjustments").select(
      "id,adjustment_kind,effect_sign,charge_mode,amount,quantity,unit_code,percentage_base,reason",
    ).eq("organization_id", body.organizationId).eq("transport_order_id", orderId),
  ]);

  if (itemsResult.error) return databaseError(itemsResult.error.code, itemsResult.error.message);
  if (stopsResult.error) return databaseError(stopsResult.error.code, stopsResult.error.message);
  if (ratesResult.error) return databaseError(ratesResult.error.code, ratesResult.error.message);
  if (supplementsResult.error) return databaseError(supplementsResult.error.code, supplementsResult.error.message);
  if (adjustmentsResult.error) return databaseError(adjustmentsResult.error.code, adjustmentsResult.error.message);

  const pickup = stopsResult.data.find((stop) => stop.stop_type === "pickup")?.location_id ?? null;
  const delivery = stopsResult.data.filter((stop) => stop.stop_type === "delivery");
  const destination = delivery[delivery.length - 1]?.location_id ?? null;
  const deliveryStops = delivery.length;
  const packages = itemsResult.data.reduce((sum, item) => sum + Number(item.packages ?? 0), 0);
  const weightKg = itemsResult.data.reduce((sum, item) => sum + Number(item.weight_kg ?? 0), 0);
  const volumeM3 = itemsResult.data.reduce((sum, item) => sum + Number(item.volume_m3 ?? 0), 0);

  // Rate applicability must be anchored to the service itself. Using the
  // calculation date would silently reprice an old order when tariff periods
  // change later.
  const serviceDate = (
    orderResult.data.planned_pickup_at ?? orderResult.data.requested_pickup_at ?? orderResult.data.created_at
  ).slice(0, 10);
  const rateSelection = selectApplicableBillingRate(
    ratesResult.data.map((row) => ({
      id: row.id,
      clientId: row.client_id,
      originLocationId: row.origin_location_id,
      destinationLocationId: row.destination_location_id,
      serviceType: row.service_type,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      versionNumber: row.version_number,
      status: row.status,
      createdAt: row.created_at,
    })),
    {
      clientId: orderResult.data.customer_id,
      originLocationId: pickup,
      destinationLocationId: destination,
      serviceType: orderResult.data.transport_type,
      serviceDate,
    },
  );

  if (!rateSelection.selected) {
    return fail(409, "rate_not_found", "No existe una tarifa activa aplicable a la orden.");
  }

  const selectedRate = ratesResult.data.find((row) => row.id === rateSelection.selected?.id);
  if (!selectedRate) {
    return fail(409, "rate_not_found", "No se pudo cargar la tarifa seleccionada.");
  }

  const calculationInput: BillingCalculationInput = {
    currencyCode: selectedRate.currency_code,
    rate: {
      id: selectedRate.id,
      clientId: selectedRate.client_id,
      originLocationId: selectedRate.origin_location_id,
      destinationLocationId: selectedRate.destination_location_id,
      serviceType: selectedRate.service_type,
      currencyCode: selectedRate.currency_code,
      validFrom: selectedRate.valid_from,
      validUntil: selectedRate.valid_until,
      versionGroupId: selectedRate.id,
      versionNumber: selectedRate.version_number,
      status: selectedRate.status,
      name: selectedRate.name,
      components: requiredRateComponents(selectedRate.components_json),
      supplementRules: requiredChargeArray(selectedRate.supplement_rules_json),
      createdAt: selectedRate.created_at,
    },
    metrics: {
      billableKm: orderResult.data.billable_km === null ? null : String(orderResult.data.billable_km),
      deliveryStops,
      packages,
      weightKg: String(weightKg),
      volumeM3: String(volumeM3),
    },
    selectedSupplements: supplementsResult.data.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      chargeMode: row.charge_mode,
      amount: numberToMoneyText(row.amount),
      quantity: numberToQuantityText(row.quantity),
      unitCode: row.unit_code,
      percentageBase: row.percentage_base ?? undefined,
      effectSign: 1,
    } satisfies BillingOrderChargeInput)),
    manualAdjustments: adjustmentsResult.data.map((row) => ({
      id: row.id,
      code: row.adjustment_kind,
      name: row.reason,
      chargeMode: row.charge_mode,
      amount: numberToMoneyText(row.amount),
      quantity: numberToQuantityText(row.quantity),
      unitCode: row.unit_code,
      percentageBase: row.percentage_base ?? undefined,
      effectSign: row.effect_sign === -1 ? -1 : 1,
    } satisfies BillingOrderChargeInput)),
  };

  const result = calculateBilling(calculationInput);
  const persist = await db.rpc("persist_transport_order_valuation", {
    p_actor: actor,
    p_scope: scope,
    p_org: body.organizationId,
    p_order: orderId,
    p_rate_id: selectedRate.id,
    p_rate_snapshot: {
      rateId: selectedRate.id,
      name: selectedRate.name,
      clientId: selectedRate.client_id,
      originLocationId: selectedRate.origin_location_id,
      destinationLocationId: selectedRate.destination_location_id,
      serviceType: selectedRate.service_type,
      validFrom: selectedRate.valid_from,
      validUntil: selectedRate.valid_until,
      versionNumber: selectedRate.version_number,
      currencyCode: selectedRate.currency_code,
      components: selectedRate.components_json,
      supplementRules: selectedRate.supplement_rules_json,
    },
    p_input_snapshot: {
      orderId,
      customerId: orderResult.data.customer_id,
      transportType: orderResult.data.transport_type,
      serviceDate,
      billableKm: orderResult.data.billable_km,
      deliveryStops,
      packages,
      weightKg,
      volumeM3,
      selectedSupplements: supplementsResult.data,
      manualAdjustments: adjustmentsResult.data,
    },
    p_breakdown: result,
    p_base_amount: Number(result.baseAmount),
    p_supplements_amount: Number(result.supplementsAmount),
    p_adjustments_amount: Number(result.adjustmentsAmount),
    p_total_amount: Number(result.totalAmount),
    p_currency_code: result.currencyCode,
    p_correlation: correlationId,
    p_key: idempotencyKey,
  });

  if (persist.error) return databaseError(persist.error.code, persist.error.message);
  return respond(200, {
    ...(record(persist.data) ? persist.data : {}),
    breakdown: result,
    selectedRateId: selectedRate.id,
  });
}

async function runRpc(db: Client, name: string, args: Record<string, unknown>) {
  const result = await db.rpc(name, args);
  if (result.error) return databaseError(result.error.code, result.error.message);
  return respond(200, record(result.data) ? result.data : { result: result.data });
}

async function authorize(db: Client, userId: string, organizationId: string, moduleCode: string) {
  const [profile, platform, membership, organization, module] = await Promise.all([
    db.from("profiles").select("status").eq("user_id", userId).maybeSingle(),
    db.from("platform_admins").select("role,status").eq("user_id", userId).maybeSingle(),
    db.from("organization_memberships").select("organization_id,role,status").eq("user_id", userId).eq(
      "organization_id",
      organizationId,
    ).maybeSingle(),
    db.from("organizations").select("status").eq("id", organizationId).maybeSingle(),
    db.from("modules").select("id").eq("code", moduleCode).single(),
  ]);

  if (profile.error || platform.error || membership.error || organization.error || module.error) {
    return deny(500, "access_check_failed", "No se pudo verificar el acceso.");
  }
  if (profile.data?.status !== "active") return deny(403, "forbidden", "Perfil inactivo.");
  if (platform.data?.role === "superadmin" && platform.data.status === "active") {
    return { ok: true as const, scope: "platform" as Scope };
  }
  if (
    organization.data?.status !== "active" || membership.data?.role !== "admin_empresa" ||
    membership.data.status !== "active"
  ) return deny(403, "forbidden", "Acceso empresarial no autorizado.");

  const [subscription, override] = await Promise.all([
    db.from("organization_subscriptions").select("plan_id").eq("organization_id", organizationId).maybeSingle(),
    db.from("organization_module_overrides").select("override_mode").eq("organization_id", organizationId).eq(
      "module_id",
      module.data.id,
    ).maybeSingle(),
  ]);

  if (subscription.error || override.error) {
    return deny(500, "access_check_failed", "No se pudo resolver el módulo.");
  }

  let enabled = override.data?.override_mode === "enabled";
  if (!override.data && subscription.data) {
    const plan = await db.from("plan_modules").select("enabled").eq("plan_id", subscription.data.plan_id).eq(
      "module_id",
      module.data.id,
    ).maybeSingle();
    if (plan.error) return deny(500, "access_check_failed", "No se pudo resolver el plan.");
    enabled = plan.data?.enabled === true;
  }
  if (override.data?.override_mode === "disabled" || !enabled) {
    return deny(403, "module_disabled", "El módulo de facturación está desactivado.");
  }
  return { ok: true as const, scope: "organization" as Scope };
}

function requiredArray(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) throw new Error("Se requiere al menos un componente de tarifa.");
  return value;
}

function optionalArray(value: unknown) {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) throw new Error("El valor debe ser una lista.");
  return value;
}

function requiredRateComponents(value: unknown): BillingRateComponentInput[] {
  if (!Array.isArray(value)) throw new Error("La tarifa no contiene componentes válidos.");
  return value.map((row) => {
    if (!record(row) || typeof row.componentKind !== "string" || typeof row.amount !== "string") {
      throw new Error("El componente de tarifa es inválido.");
    }
    if (!["base", "distance_km", "delivery_stop", "package", "weight_kg", "volume_m3"].includes(row.componentKind)) {
      throw new Error("El tipo de componente de tarifa es inválido.");
    }
    return {
      componentKind: row.componentKind as BillingRateComponentInput["componentKind"],
      amount: row.amount,
    };
  });
}

function requiredChargeArray(value: unknown): BillingOrderChargeInput[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    if (
      !record(row) || typeof row.code !== "string" || typeof row.name !== "string" ||
      typeof row.chargeMode !== "string" || typeof row.amount !== "string"
    ) {
      throw new Error("La regla de suplemento es inválida.");
    }
    if (!["fixed", "percent", "per_unit"].includes(row.chargeMode)) {
      throw new Error("La regla de suplemento tiene un modo de cargo inválido.");
    }
    return {
      code: row.code,
      name: row.name,
      chargeMode: row.chargeMode as BillingOrderChargeInput["chargeMode"],
      amount: row.amount,
      unitCode: typeof row.unitCode === "string" ? row.unitCode : undefined,
      percentageBase:
        row.percentageBase === "subtotal_before_percentage" || row.percentageBase === "subtotal_before_adjustments"
          ? row.percentageBase
          : undefined,
    };
  });
}

function requiredUuid(value: unknown) {
  if (typeof value !== "string" || !uuid(value)) throw new Error("Identificador inválido.");
  return value;
}

function optionalUuid(value: unknown) {
  return value === undefined || value === null || value === "" ? null : requiredUuid(value);
}

function requiredUuidArray(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) throw new Error("Se requiere una lista de identificadores.");
  return value.map((item) => requiredUuid(item));
}

function requiredText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Texto obligatorio.");
  return value.trim();
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredNumber(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error("Número inválido.");
  return number;
}

function optionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  return requiredNumber(value);
}

function requiredSmallint(value: unknown) {
  const number = Number(value);
  if (!Number.isInteger(number) || ![-1, 1].includes(number)) throw new Error("Signo inválido.");
  return number;
}

function requiredCurrency(value: unknown) {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value.trim())) throw new Error("Moneda inválida.");
  return value.trim();
}

function requiredStatus(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "active";
  if (!["active", "inactive", "archived"].includes(text)) throw new Error("Estado de tarifa inválido.");
  return text;
}

function keyFrom(body: unknown, header: string | null) {
  const value = typeof body === "string" ? body : header ?? crypto.randomUUID();
  return uuid(value) ? value : null;
}

function numberToMoneyText(value: number | string | null) {
  const number = Number(value ?? 0);
  return number.toFixed(4).replace(/0+$/, "").replace(/\.$/, "") || "0";
}

function numberToQuantityText(value: number | string | null) {
  const number = Number(value ?? 0);
  return number.toString();
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const deny = (status: number, code: string, message: string) => ({ ok: false as const, status, code, message });

function databaseError(code: string | undefined, message: string) {
  if (code === "23505") return fail(409, "idempotency_conflict", message);
  if (code === "P0002") return fail(404, "not_found", message);
  if (code === "42501") return fail(403, "forbidden", message);
  if (["23514", "22P02", "22023", "55000", "23503"].includes(String(code))) {
    return fail(409, "operation_rejected", message);
  }
  return fail(500, "command_failed", "No se pudo ejecutar el comando de facturación.");
}
