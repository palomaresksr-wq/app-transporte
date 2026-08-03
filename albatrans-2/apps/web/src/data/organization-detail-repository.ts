import type { LimitCode, ModuleCode, Organization, OrganizationDetail } from "@albatrans/contracts";
import { usagePercentage } from "@albatrans/domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../infrastructure/supabase/client";
import type { Database } from "../infrastructure/supabase/database.types";

export async function loadOrganizationDetail(organizationId: string, client: SupabaseClient<Database> = requireClient()): Promise<OrganizationDetail | null> {
  const organizationResult = await client.from("organizations").select("id,legal_name,trade_name,tax_id,email,phone,country_code,timezone,currency_code,status,status_reason,status_changed_at,status_changed_by,internal_notes,created_by,created_at,updated_at,archived_at").eq("id", organizationId).maybeSingle();
  if (organizationResult.error) throw new Error(`No se pudo cargar la empresa: ${organizationResult.error.message}`);
  if (!organizationResult.data) return null;
  const organization = mapOrganization(organizationResult.data);
  const [subscriptionResult, modulesResult, overridesResult, definitionsResult, limitOverridesResult, usageResult, membershipsResult, auditResult] = await Promise.all([
    client.from("organization_subscriptions").select("id,organization_id,plan_id,status,payment_status,starts_at,current_period_starts_at,current_period_ends_at,paid_through,grace_period_ends_at,cancel_at_period_end,notes,created_at,updated_at,plans(code,name)").eq("organization_id", organizationId).maybeSingle(),
    client.from("modules").select("id,code,name,category,sort_order").order("sort_order"),
    client.from("organization_module_overrides").select("module_id,override_mode,reason,changed_at,changed_by").eq("organization_id", organizationId),
    client.from("limit_definitions").select("id,code,name,unit").eq("status", "active"),
    client.from("organization_limit_overrides").select("limit_definition_id,override_mode,limit_value").eq("organization_id", organizationId),
    client.from("organization_usage_counters").select("metric_code,usage_value,updated_at").eq("organization_id", organizationId).order("updated_at", { ascending: false }),
    client.from("organization_memberships").select("id,user_id,role,joined_at").eq("organization_id", organizationId).eq("status", "active"),
    client.from("audit_events").select("id,action,actor_scope,reason,occurred_at,entity_type").eq("organization_id", organizationId).order("occurred_at", { ascending: false }).limit(10)
  ]);
  if (subscriptionResult.error) throw new Error(`No se pudo cargar la suscripción: ${subscriptionResult.error.message}`);
  if (modulesResult.error) throw new Error(`No se pudieron cargar los módulos: ${modulesResult.error.message}`);
  if (!modulesResult.data) throw new Error("Supabase no devolvió el catálogo de módulos.");
  if (overridesResult.error) throw new Error(`No se pudieron cargar los overrides de módulos: ${overridesResult.error.message}`);
  if (!overridesResult.data) throw new Error("Supabase no devolvió los overrides de módulos.");
  if (definitionsResult.error) throw new Error(`No se pudieron cargar las definiciones de límites: ${definitionsResult.error.message}`);
  if (!definitionsResult.data) throw new Error("Supabase no devolvió las definiciones de límites.");
  if (limitOverridesResult.error) throw new Error(`No se pudieron cargar los overrides de límites: ${limitOverridesResult.error.message}`);
  if (!limitOverridesResult.data) throw new Error("Supabase no devolvió los overrides de límites.");
  if (usageResult.error) throw new Error(`No se pudieron cargar los consumos: ${usageResult.error.message}`);
  if (!usageResult.data) throw new Error("Supabase no devolvió los consumos.");
  if (membershipsResult.error) throw new Error(`No se pudieron cargar las memberships: ${membershipsResult.error.message}`);
  if (!membershipsResult.data) throw new Error("Supabase no devolvió las memberships.");
  if (auditResult.error) throw new Error(`No se pudo cargar la auditoría: ${auditResult.error.message}`);
  if (!auditResult.data) throw new Error("Supabase no devolvió la auditoría.");
  const subscriptionRow = subscriptionResult.data;
  const planId = subscriptionRow?.plan_id ?? null;
  const [planModulesResult, planLimitsResult, profilesResult] = await Promise.all([
    planId ? client.from("plan_modules").select("module_id,enabled").eq("plan_id", planId) : Promise.resolve({ data: [], error: null }),
    planId ? client.from("plan_limits").select("limit_definition_id,limit_value").eq("plan_id", planId) : Promise.resolve({ data: [], error: null }),
    membershipsResult.data.length || overridesResult.data.length ? client.from("profiles").select("user_id,display_name").in("user_id", [...new Set([...membershipsResult.data.map((row) => row.user_id), ...overridesResult.data.map((row) => row.changed_by)])]) : Promise.resolve({ data: [], error: null })
  ]);
  if (planModulesResult.error) throw new Error(`No se pudieron cargar los módulos del plan: ${planModulesResult.error.message}`);
  if (!planModulesResult.data) throw new Error("Supabase no devolvió los módulos del plan.");
  if (planLimitsResult.error) throw new Error(`No se pudieron cargar los límites del plan: ${planLimitsResult.error.message}`);
  if (!planLimitsResult.data) throw new Error("Supabase no devolvió los límites del plan.");
  if (profilesResult.error) throw new Error(`No se pudieron cargar los perfiles: ${profilesResult.error.message}`);
  if (!profilesResult.data) throw new Error("Supabase no devolvió los perfiles.");
  const modules = modulesResult.data.flatMap((module) => {
    const code = moduleCode(module.code); if (!code) return [];
    const override = overridesResult.data.find((row) => row.module_id === module.id);
    const planModule = planModulesResult.data.find((row) => row.module_id === module.id);
    const enabled = override?.override_mode === "enabled" ? true : override?.override_mode === "disabled" ? false : (planModule?.enabled ?? false);
    const source = override?.override_mode === "enabled" ? "override_enabled" as const : override?.override_mode === "disabled" ? "override_disabled" as const : planModule ? "plan" as const : "not_in_plan" as const;
    return [{ code, name: module.name, category: module.category, planIncluded: planModule?.enabled ?? false, enabled, source, overrideMode: override?.override_mode ?? null, overrideReason: override?.reason ?? null, changedAt: override?.changed_at ?? null, changedBy: override?.changed_by ?? null, changedByDisplayName: override ? profilesResult.data.find((profile) => profile.user_id === override.changed_by)?.display_name ?? null : null }];
  });
  const memberUsage = { max_admins: membershipsResult.data.filter((row) => row.role === "admin_empresa").length, max_drivers: membershipsResult.data.filter((row) => row.role === "conductor").length };
  const limits = definitionsResult.data.flatMap((definition) => {
    const code = limitCode(definition.code); if (!code) return [];
    const override = limitOverridesResult.data.find((row) => row.limit_definition_id === definition.id);
    const planLimit = planLimitsResult.data.find((row) => row.limit_definition_id === definition.id);
    const limit = override?.override_mode === "custom" ? override.limit_value : (planLimit?.limit_value ?? null);
    const usage = code === "max_admins" ? memberUsage.max_admins : code === "max_drivers" ? memberUsage.max_drivers : usageResult.data.find((row) => row.metric_code === metricCode(code))?.usage_value ?? 0;
    const source = override?.override_mode === "custom" ? "organization_override" as const : planLimit ? "plan" as const : "unconfigured" as const;
    return [{ code, name: definition.name, unit: definition.unit, planValue: planLimit?.limit_value ?? null, overrideMode: override?.override_mode ?? null, overrideValue: override?.limit_value ?? null, usage, limit, percentage: usagePercentage(usage, limit), source }];
  });
  const members = membershipsResult.data.map((member) => ({ id: member.id, userId: member.user_id, displayName: profilesResult.data.find((profile) => profile.user_id === member.user_id)?.display_name ?? "Usuario sin perfil", role: member.role, joinedAt: member.joined_at }));
  const subscription = subscriptionRow && subscriptionRow.plans ? { planId: subscriptionRow.plan_id, planCode: subscriptionRow.plans.code, planName: subscriptionRow.plans.name, status: subscriptionRow.status, paymentStatus: subscriptionRow.payment_status, startsAt: subscriptionRow.starts_at, periodStartsAt: subscriptionRow.current_period_starts_at, periodEndsAt: subscriptionRow.current_period_ends_at, paidThrough: subscriptionRow.paid_through, gracePeriodEndsAt: subscriptionRow.grace_period_ends_at, cancelAtPeriodEnd: subscriptionRow.cancel_at_period_end, notes: subscriptionRow.notes, raw: { id: subscriptionRow.id, organizationId: subscriptionRow.organization_id, planId: subscriptionRow.plan_id, status: subscriptionRow.status, paymentStatus: subscriptionRow.payment_status, startsAt: subscriptionRow.starts_at, currentPeriodStartsAt: subscriptionRow.current_period_starts_at, currentPeriodEndsAt: subscriptionRow.current_period_ends_at, paidThrough: subscriptionRow.paid_through, gracePeriodEndsAt: subscriptionRow.grace_period_ends_at, cancelAtPeriodEnd: subscriptionRow.cancel_at_period_end, notes: subscriptionRow.notes, createdAt: subscriptionRow.created_at, updatedAt: subscriptionRow.updated_at } } : null;
  return { organization, subscription, limits, modules, activeAdminCount: memberUsage.max_admins, activeDriverCount: memberUsage.max_drivers, members, audit: auditResult.data.map((row) => ({ id: row.id, action: row.action, actorScope: row.actor_scope, reason: row.reason, occurredAt: row.occurred_at, entityType: row.entity_type })) };
}
function mapOrganization(row: Database["public"]["Tables"]["organizations"]["Row"]): Organization { return { id: row.id, legalName: row.legal_name, tradeName: row.trade_name, taxId: row.tax_id, email: row.email, phone: row.phone, countryCode: row.country_code, timezone: row.timezone, currencyCode: row.currency_code, status: row.status, statusReason: row.status_reason, statusChangedAt: row.status_changed_at, statusChangedBy: row.status_changed_by, internalNotes: row.internal_notes, createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at, archivedAt: row.archived_at }; }
function moduleCode(value: string): ModuleCode | null { switch(value) { case "transport_management": case "client_management": case "vehicle_management": case "pod_signature": case "electronic_delivery_notes": case "ocr": case "billing": case "time_tracking": case "leave_management": case "exports": case "reports": case "api_access": case "support_access": case "audit_access": return value; default: return null; } }
function limitCode(value: string): LimitCode | null { switch(value) { case "max_admins": case "max_drivers": case "max_documents_total": case "max_documents_monthly": case "max_ocr_monthly": case "max_storage_bytes": case "max_exports_monthly": return value; default: return null; } }
function metricCode(code: LimitCode): string { return code.replace(/^max_/, ""); }
function requireClient(): SupabaseClient<Database> { const client = getSupabaseClient(); if (!client) throw new Error("Supabase no está configurado."); return client; }
