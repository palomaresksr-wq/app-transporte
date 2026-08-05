export const documentStatuses = ["pending_upload", "available", "quarantined", "archived", "failed"] as const;
export type DocumentStatus = (typeof documentStatuses)[number];
export const documentSources = ["upload", "camera", "generated", "imported", "legacy", "future_ocr"] as const;
export type DocumentSource = (typeof documentSources)[number];
export const allowedDocumentMimeTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type AllowedDocumentMimeType = (typeof allowedDocumentMimeTypes)[number];
export const podStatuses = ["pending", "captured", "confirmed", "rejected", "archived"] as const;
export type PodStatus = (typeof podStatuses)[number];
export const signatureTypes = ["drawn", "typed", "uploaded", "future_certificate"] as const;
export type SignatureType = (typeof signatureTypes)[number];
export interface DocumentRelations { transportOrderId?: string; transportStopId?: string; transportIncidentId?: string; clientId?: string; vehicleId?: string; driverId?: string; }
export interface BeginDocumentUpload { organizationId: string; documentType: string; title: string; description?: string; source: DocumentSource; originalFilename: string; mimeType: AllowedDocumentMimeType; sizeBytes: number; relations: DocumentRelations; idempotencyKey?: string; }
export interface ConfirmDocumentUpload { organizationId: string; documentId: string; versionId: string; idempotencyKey?: string; }
export interface DocumentUploadResult { documentId: string; versionId: string; storagePath: string; signedUploadUrl?: string; token?: string; eventType: string; }
export interface DocumentCommand { action: "archive" | "create_pod" | "confirm_pod" | "reject_pod" | "create_signature" | "revoke_signature"; organizationId: string; documentId?: string; versionId?: string; transportOrderId?: string; transportStopId?: string; entityId?: string; values?: Record<string, string | null>; reason?: string; idempotencyKey?: string; }
