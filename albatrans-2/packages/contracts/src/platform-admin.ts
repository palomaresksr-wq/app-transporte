export const AUDIT_ACTOR_SCOPES = [
  "platform",
  "organization",
  "system"
] as const;
export type AuditActorScope = (typeof AUDIT_ACTOR_SCOPES)[number];

export interface AuditEvent {
  id: string;
  organizationId: string | null;
  actorUserId: string | null;
  actorScope: AuditActorScope;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeData: Readonly<Record<string, unknown>> | null;
  afterData: Readonly<Record<string, unknown>> | null;
  reason: string | null;
  correlationId: string;
  occurredAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export const LEGACY_ENTITY_TYPES = [
  "admin_empresa",
  "conductor"
] as const;
export type LegacyEntityType = (typeof LEGACY_ENTITY_TYPES)[number];

export const LEGACY_MIGRATION_STATUSES = [
  "pending",
  "matched",
  "invited",
  "activated",
  "conflict",
  "retired"
] as const;
export type LegacyMigrationStatus =
  (typeof LEGACY_MIGRATION_STATUSES)[number];

export interface LegacyIdentityLink {
  id: string;
  organizationId: string;
  membershipId: string;
  legacyEntityType: LegacyEntityType;
  legacyTable: "admins_empresa" | "conductores";
  legacyIdText: string;
  legacyUsername: string | null;
  migrationStatus: LegacyMigrationStatus;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
