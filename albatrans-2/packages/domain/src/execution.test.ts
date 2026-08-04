import { describe, expect, it } from "vitest";
import { allowedExecutionTransitions, requiredExecutionText, validateExecutionTransition, validateIncidentTransition } from "./execution";
describe("execution domain", () => {
  it("permite la secuencia operativa y cancelación", () => {
    expect(allowedExecutionTransitions("arrived_pickup")).toEqual(["waiting_pickup", "loading", "cancelled"]);
    expect(validateExecutionTransition("unloading", "delivered")).toBe("delivered");
  });
  it("impide saltos, retrocesos y salida de terminal", () => {
    expect(() => validateExecutionTransition("pending", "loading")).toThrow();
    expect(() => validateExecutionTransition("completed", "pending")).toThrow();
  });
  it("valida el ciclo de incidencias", () => {
    expect(validateIncidentTransition("open", "resolved")).toBe("resolved");
    expect(() => validateIncidentTransition("closed", "open")).toThrow();
  });
  it("normaliza texto obligatorio", () => {
    expect(requiredExecutionText("  avería   motor ", "Título")).toBe("avería motor");
    expect(() => requiredExecutionText(" ", "Título")).toThrow();
  });
});
