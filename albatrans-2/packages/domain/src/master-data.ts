import type {
  DriverEmploymentStatus,
  FleetAssetStatus,
  MasterDataResource,
  MasterDataStatus,
} from "@albatrans/contracts";

export class MasterDataValidationError extends Error {}
export const resourceModule = (resource: MasterDataResource) =>
  resource === "drivers"
    ? "transport_management" as const
    : resource === "clients" || resource === "client_contacts" ||
        resource === "locations"
    ? "client_management" as const
    : "vehicle_management" as const;
export function requiredText(
  value: unknown,
  label: string,
  maximum = 200,
): string {
  if (typeof value !== "string") {
    throw new MasterDataValidationError(`${label} es obligatorio.`);
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    throw new MasterDataValidationError(`${label} es obligatorio.`);
  }
  if (normalized.length > maximum) {
    throw new MasterDataValidationError(
      `${label} supera ${maximum} caracteres.`,
    );
  }
  return normalized;
}
export function optionalText(value: unknown, maximum = 5000): string | null {
  if (value === null || value === undefined || value === "") return null;
  return requiredText(value, "El valor", maximum);
}
export function nonNegative(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new MasterDataValidationError(`${label} no puede ser negativo.`);
  }
  return number;
}
export function validCoordinates(latitude: unknown, longitude: unknown) {
  const lat = nonNegativeCoordinate(latitude);
  const lng = nonNegativeCoordinate(longitude);
  if ((lat === null) !== (lng === null)) {
    throw new MasterDataValidationError(
      "Latitud y longitud deben informarse juntas.",
    );
  }
  if (lat !== null && (lat < -90 || lat > 90 || lng! < -180 || lng! > 180)) {
    throw new MasterDataValidationError("Las coordenadas no son válidas.");
  }
  return { latitude: lat, longitude: lng };
}
function nonNegativeCoordinate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new MasterDataValidationError("Las coordenadas no son válidas.");
  }
  return number;
}
export function validAssignmentPeriod(startsAt: string, endsAt: string | null) {
  const start = Date.parse(startsAt);
  const end = endsAt ? Date.parse(endsAt) : null;
  if (
    !Number.isFinite(start) ||
    (end !== null && (!Number.isFinite(end) || end <= start))
  ) {
    throw new MasterDataValidationError(
      "El final debe ser posterior al inicio.",
    );
  }
}
export const driverCanBeAssigned = (status: DriverEmploymentStatus) =>
  status === "active";
export const vehicleCanBeAssigned = (status: FleetAssetStatus) =>
  status === "active";
export const isArchived = (
  status: DriverEmploymentStatus | MasterDataStatus | FleetAssetStatus,
) => status === "archived";
