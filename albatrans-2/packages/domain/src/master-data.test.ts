import { describe, expect, it } from "vitest";
import { driverCanBeAssigned, MasterDataValidationError, nonNegative, requiredText, resourceModule, validAssignmentPeriod, validCoordinates, vehicleCanBeAssigned } from "./master-data";
describe("datos maestros", () => {
  it("normaliza texto y rechaza vacíos", () => { expect(requiredText("  Camión   rígido ", "Tipo")).toBe("Camión rígido"); expect(() => requiredText("   ", "Tipo")).toThrow(MasterDataValidationError); });
  it("resuelve módulos", () => { expect(resourceModule("drivers")).toBe("transport_management"); expect(resourceModule("locations")).toBe("client_management"); expect(resourceModule("trailers")).toBe("vehicle_management"); });
  it("valida capacidades y coordenadas", () => { expect(nonNegative(0,"Capacidad")).toBe(0); expect(() => nonNegative(-1,"Capacidad")).toThrow(); expect(validCoordinates(-3.7,40.4)).toEqual({latitude:-3.7,longitude:40.4}); expect(() => validCoordinates(91,2)).toThrow(); });
  it("solo permite asignar activos y periodos válidos", () => { expect(driverCanBeAssigned("active")).toBe(true); expect(driverCanBeAssigned("on_leave")).toBe(false); expect(vehicleCanBeAssigned("maintenance")).toBe(false); expect(() => validAssignmentPeriod("2026-01-02","2026-01-01")).toThrow(); });
});
