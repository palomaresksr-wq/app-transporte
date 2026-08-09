# ADR-002: Atomicidad, concurrencia e idempotencia

- Estado: aceptada; patrón PostgreSQL implementado para Fase C.
- Fecha: 2026-08-04.

## Decisión

Los comandos contenidos íntegramente en PostgreSQL deben ejecutar mutación, timestamps, timeline, auditoría, notificación y resultado idempotente en una sola transacción. Fase C es la implementación de referencia mediante `execute_transport_operation`.

La función bloquea la orden y la entidad operativa con `FOR UPDATE`. La clave idempotente es única por organización y PostgreSQL calcula el hash del contexto y payload normalizados. Una repetición idéntica devuelve el resultado persistido; reutilizar la key con otro payload es un conflicto.

La Edge Function valida JWT, perfil, organización, rol, módulo y payload, genera `correlation_id` y la key cuando no la aporta el cliente, y efectúa una sola llamada RPC. PostgreSQL vuelve a validar actor, tenant y módulo.

La función es `SECURITY DEFINER`, sin SQL dinámico, con `search_path` fijo. `PUBLIC`, `anon` y `authenticated` no pueden ejecutarla; solo `service_role`. Las tablas de negocio continúan sin escritura directa desde frontend.

## Auth y efectos externos

Auth, Storage y proveedores no comparten transacción con PostgreSQL. Esos flujos serán sagas idempotentes: comando persistido, efecto externo detectable, compensación, reconciliación y alertas. No se prometerá rollback distribuido, sino convergencia observable.

## Estandar aplicado

- POD y documentos: metadatos, auditoría y outbox transaccionales; Storage mediante saga.
- OCR (Fase E): reserva atomica de cuota antes de proveedor, commit al inicio de processing, liberacion solo si proveedor no inicio, resultado inmutable, revision humana append-only y outbox OCR reconciliable.
- Facturación: numeración, documento fiscal, auditoría y outbox atómicos e inmutables.
- Cuotas: ledger de reservas con bloqueo por empresa, periodo y métrica.

## Reintentos

Solo se reintentan comandos idempotentes. Tras un timeout se consulta o repite la misma key. Validación, permisos y conflicto de payload no se reintentan. Los efectos externos agotados pasan a reconciliación.

## Consecuencias

Fase C queda protegida frente a cambios parciales y carreras sobre una orden. Fase E aplica el mismo patrón al OCR documental y su cuota mensual. El patrón no autoriza todavía operaciones productivas con proveedores externos de OCR o facturación sin validación contractual, legal y operativa adicional.
