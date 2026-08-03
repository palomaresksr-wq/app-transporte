import type { AdministratorIdentityInput } from "@albatrans/contracts";
import { describe, expect, it } from "vitest";
import { canAssignAdministrator, normalizeAdministratorIdentity, validateAdministratorIdentity } from "./organization-administrators";

const valid: AdministratorIdentityInput = { email: "admin@empresa.es", displayName: "Ana Admin", phone: "+34 900", locale: "es", timezone: "Europe/Madrid" };
describe("administradores de empresa", () => {
  it("valida y normaliza la identidad sin admitir roles", () => { expect(validateAdministratorIdentity(valid)).toEqual({ valid: true, errors: {} }); expect(normalizeAdministratorIdentity({ ...valid, email: " ADMIN@EMPRESA.ES ", displayName: " Ana " })).toMatchObject({ email: "admin@empresa.es", displayName: "Ana" }); });
  it("rechaza campos obligatorios y formatos inválidos", () => { expect(validateAdministratorIdentity({ ...valid, email: "incorrecto", displayName: " ", timezone: "" }).errors).toMatchObject({ email: expect.any(String), displayName: expect.any(String), timezone: expect.any(String) }); });
  it("aplica el límite efectivo", () => { expect(canAssignAdministrator(0, 1)).toBe(true); expect(canAssignAdministrator(1, 1)).toBe(false); expect(canAssignAdministrator(25, null)).toBe(true); });
});
