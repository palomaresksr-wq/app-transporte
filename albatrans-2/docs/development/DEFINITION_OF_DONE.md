# Definition of Done

Un bloque está terminado solo cuando:

- El alcance y las exclusiones están aprobados.
- Existe checkpoint Git y rama específica de fase.
- Contratos y reglas de dominio están definidos y probados.
- Las migraciones nuevas son aditivas, revisadas y reversibles operacionalmente.
- RLS, grants, índices y aislamiento multiempresa están probados.
- Las Edge Functions validan JWT, rol, estado, organización y payload exacto.
- Las operaciones sensibles son atómicas o tienen compensación demostrada.
- La UI cubre carga, vacío, error, éxito, responsive y teclado.
- No existen `any`, supresiones TypeScript, errores ni warnings de lint.
- Tests unitarios, UI, SQL, Edge e integración pasan desde un entorno reproducible.
- TypeScript y build de producción pasan.
- `npm audit` no contiene vulnerabilidades altas o críticas aceptadas sin excepción documentada.
- No quedan fixtures, secretos, logs ni artefactos temporales.
- Auditoría funcional contiene solo datos permitidos.
- La documentación y el estado actual están actualizados.
- Se ha comprobado que Legacy y producción no fueron modificados.
- El informe final incluye cambios, pruebas, riesgos, rollback y pendientes.

Una prueba omitida por falta de entorno no cuenta como superada. Una excepción exige propietario, justificación, mitigación y fecha objetivo.

