import type {
  EffectiveLimit,
  EffectiveModule,
  LimitCode,
  LimitValue,
  ModuleCode,
  ModuleOverrideMode,
  OrganizationLimitOverride,
  PlanCode
} from "@albatrans/contracts";

const STARTER_MODULES = [
  "transport_management",
  "client_management",
  "vehicle_management",
  "pod_signature",
  "electronic_delivery_notes"
] as const satisfies readonly ModuleCode[];

const PROFESSIONAL_MODULES = [
  ...STARTER_MODULES,
  "ocr",
  "billing",
  "time_tracking",
  "leave_management",
  "exports",
  "reports",
  "support_access",
  "audit_access"
] as const satisfies readonly ModuleCode[];

const ENTERPRISE_MODULES = [
  ...PROFESSIONAL_MODULES,
  "api_access"
] as const satisfies readonly ModuleCode[];

export const DEFAULT_PLAN_MODULES: Readonly<
  Record<PlanCode, readonly ModuleCode[]>
> = {
  starter: STARTER_MODULES,
  professional: PROFESSIONAL_MODULES,
  enterprise: ENTERPRISE_MODULES,
  custom: []
};

export const DEFAULT_PLAN_LIMITS: Readonly<
  Record<PlanCode, Readonly<Partial<Record<LimitCode, LimitValue>>>>
> = {
  starter: {
    max_admins: { value: 1 },
    max_drivers: { value: 5 }
  },
  professional: {
    max_admins: { value: 5 },
    max_drivers: { value: 25 }
  },
  enterprise: {
    max_admins: { value: 100 },
    max_drivers: { value: 1000 },
    max_documents_total: { value: 1000000 },
    max_documents_monthly: { value: 100000 },
    max_ocr_monthly: { value: 50000 },
    max_storage_bytes: { value: 10995116277760 },
    max_exports_monthly: { value: 100000 }
  },
  custom: {}
};

export function planIncludesModule(
  planCode: PlanCode,
  moduleCode: ModuleCode
): boolean {
  return DEFAULT_PLAN_MODULES[planCode].includes(moduleCode);
}

export function resolveEffectiveModule(
  code: ModuleCode,
  planEnabled: boolean | undefined,
  overrideMode: ModuleOverrideMode | null | undefined
): EffectiveModule {
  if (overrideMode === "enabled") {
    return { code, enabled: true, source: "organization_override" };
  }

  if (overrideMode === "disabled") {
    return { code, enabled: false, source: "organization_override" };
  }

  if (planEnabled !== undefined) {
    return { code, enabled: planEnabled, source: "plan" };
  }

  return { code, enabled: false, source: "not_in_plan" };
}

export function resolveEffectiveLimit(
  code: LimitCode,
  planLimit: LimitValue | undefined,
  override: Pick<OrganizationLimitOverride, "mode" | "value"> | null | undefined
): EffectiveLimit {
  if (override?.mode === "custom") {
    if (
      override.value === null ||
      !Number.isSafeInteger(override.value) ||
      override.value < 0
    ) {
      throw new Error(`Valor inválido para el límite ${code}.`);
    }

    return {
      code,
      value: override.value,
      source: "organization_override"
    };
  }

  if (planLimit) {
    assertValidLimitValue(code, planLimit);
    return { code, ...planLimit, source: "plan" };
  }

  throw new Error(`El límite ${code} no está configurado.`);
}

export function canConsumeLimit(
  limit: EffectiveLimit,
  currentUsage: number,
  requestedAmount = 1
): boolean {
  if (
    !Number.isSafeInteger(currentUsage) ||
    currentUsage < 0 ||
    !Number.isSafeInteger(requestedAmount) ||
    requestedAmount < 0
  ) {
    return false;
  }

  return currentUsage + requestedAmount <= limit.value;
}

export function validateCustomLimitValue(value: number): string | null {
  if (!Number.isSafeInteger(value) || value < 0) return "El límite debe ser un número entero igual o mayor que cero.";
  return null;
}

function assertValidLimitValue(code: LimitCode, limit: LimitValue): void {
  if (
    !Number.isSafeInteger(limit.value) ||
    limit.value < 0
  ) {
    throw new Error(`Valor inválido para el límite ${code}.`);
  }
}
