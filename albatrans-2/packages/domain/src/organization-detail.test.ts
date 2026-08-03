import { describe, expect, it } from "vitest";
import { usagePercentage } from "./organization-detail";
describe("porcentaje de uso", () => { it("resuelve configurado y no configurado", () => { expect(usagePercentage(5, 10)).toBe(50); expect(usagePercentage(5, null)).toBeNull(); expect(usagePercentage(20, 10)).toBe(100); }); });
