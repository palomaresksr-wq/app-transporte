import { describe, expect, it } from "vitest";
import { classifyDriverTransport, driverAlternativeActions, driverCompletion, nextDriverAction } from "./driver-portal";

describe("portal conductor", () => {
  it("expone sólo la acción operativa siguiente", () => {
    expect(nextDriverAction("driver_notified")).toBe("heading_to_pickup");
    expect(driverAlternativeActions("arrived_pickup")).toEqual(["waiting_pickup", "loading"]);
    expect(nextDriverAction("completed")).toBeNull();
  });
  it("aplica requisitos configurables y avisa por incidencia crítica", () => {
    expect(driverCompletion({ requirePod: true, requireSignature: false, requireDocument: false }, { status: "delivered", hasPod: false, hasSignature: false, hasDocument: false, hasOpenCriticalIncident: true })).toEqual({ allowed: false, missing: ["pod"], warning: "Hay una incidencia crítica abierta." });
    expect(driverCompletion({ requirePod: false, requireSignature: false, requireDocument: false }, { status: "delivered", hasPod: false, hasSignature: false, hasDocument: false, hasOpenCriticalIncident: false }).allowed).toBe(true);
  });
  it("clasifica hoy, próximos y completados", () => {
    const now = new Date("2026-08-16T10:00:00Z");
    expect(classifyDriverTransport("2026-08-16T12:00:00Z", "pending", now)).toBe("today");
    expect(classifyDriverTransport("2026-08-17T12:00:00Z", "pending", now)).toBe("upcoming");
    expect(classifyDriverTransport(null, "completed", now)).toBe("recent");
  });
});
