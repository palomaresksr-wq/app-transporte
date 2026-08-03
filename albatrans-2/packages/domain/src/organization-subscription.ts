import type { ManageOrganizationSubscriptionErrors, ManageOrganizationSubscriptionInput } from "@albatrans/contracts";

export function validateOrganizationSubscription(input: ManageOrganizationSubscriptionInput): { valid: boolean; errors: ManageOrganizationSubscriptionErrors } {
  const errors: ManageOrganizationSubscriptionErrors = {};
  const startsAt = instant(input.startsAt);
  const periodStartsAt = optionalInstant(input.currentPeriodStartsAt);
  const periodEndsAt = optionalInstant(input.currentPeriodEndsAt);
  const paidThrough = optionalInstant(input.paidThrough);
  const graceEndsAt = optionalInstant(input.gracePeriodEndsAt);
  if (startsAt === null) errors.startsAt = "La fecha de inicio no es válida.";
  if (periodStartsAt === false) errors.currentPeriodStartsAt = "El inicio del periodo no es válido.";
  if (periodEndsAt === false) errors.currentPeriodEndsAt = "El fin del periodo no es válido.";
  if (paidThrough === false) errors.paidThrough = "La fecha pagada hasta no es válida.";
  if (graceEndsAt === false) errors.gracePeriodEndsAt = "El fin del periodo de gracia no es válido.";
  if (typeof periodStartsAt === "number" && typeof periodEndsAt === "number" && periodEndsAt < periodStartsAt) errors.currentPeriodEndsAt = "El fin del periodo no puede ser anterior al inicio.";
  if (typeof graceEndsAt === "number" && typeof periodEndsAt === "number" && graceEndsAt < periodEndsAt) errors.gracePeriodEndsAt = "El periodo de gracia no puede terminar antes que el periodo contratado.";
  if (input.notes.trim().length > 2000) errors.notes = "Las notas no pueden superar 2.000 caracteres.";
  if (input.reason.trim().length > 1000) errors.reason = "El motivo no puede superar 1.000 caracteres.";
  if (subscriptionReasonRequired(input) && !input.reason.trim()) errors.reason = "El motivo es obligatorio para este cambio.";
  return { valid: Object.keys(errors).length === 0, errors };
}

export function normalizeOrganizationSubscription(input: ManageOrganizationSubscriptionInput): ManageOrganizationSubscriptionInput {
  return { ...input, startsAt: input.startsAt.trim(), currentPeriodStartsAt: input.currentPeriodStartsAt.trim(), currentPeriodEndsAt: input.currentPeriodEndsAt.trim(), paidThrough: input.paidThrough.trim(), gracePeriodEndsAt: input.gracePeriodEndsAt.trim(), notes: input.notes.trim(), reason: input.reason.trim() };
}

export function subscriptionReasonRequired(input: Pick<ManageOrganizationSubscriptionInput, "status" | "paymentStatus">): boolean {
  return input.paymentStatus === "failed" || input.paymentStatus === "overdue" || input.status === "suspended" || input.status === "cancelled" || input.status === "expired";
}

export function subscriptionDaysRemaining(periodEndsAt: string | null, now: Date = new Date()): number | null {
  if (!periodEndsAt) return null;
  const end = new Date(periodEndsAt).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.ceil((end - now.getTime()) / 86_400_000);
}

function instant(value: string): number | null { if (!value.trim()) return null; const parsed = new Date(value).getTime(); return Number.isFinite(parsed) ? parsed : null; }
function optionalInstant(value: string): number | false | null { if (!value.trim()) return null; const parsed = new Date(value).getTime(); return Number.isFinite(parsed) ? parsed : false; }
