# Decisiones de arquitectura — Fase C

## Separación planificación/ejecución

`transport_orders` conserva la intención planificada. `transport_executions` representa la realidad operativa con relación única 1:1. Sus máquinas de estado no se mezclan.

## Estados, timestamps y tiempos

El dominio valida para respuesta inmediata y PostgreSQL actúa como autoridad. Los timestamps se asignan al entrar por primera vez en cada estado y no pueden sobrescribirse. `transport_waiting_times` calcula duraciones mediante una vista `security_invoker`; no se duplican valores derivables.

## Timeline, auditoría y notificaciones

`transport_events` es la timeline oficial append-only. `audit_events` permanece append-only. `internal_notifications` es una bandeja interna sin email ni push. Los tres registros comparten el comando y se confirman junto con la mutación.

## Atomicidad e idempotencia

La Edge valida JWT, perfil, organización, rol, módulo y payload. Genera `correlation_id` e idempotency key cuando no se aporta, y realiza una única llamada a `execute_transport_operation`.

PostgreSQL revalida el contexto, bloquea con `FOR UPDATE`, muta y registra timeline, auditoría, notificación y resultado en una transacción. No hay compensación manual. La key se delimita por organización y su hash se calcula en la base; una repetición devuelve el mismo resultado y un payload distinto se rechaza. Las pruebas fuerzan fallos en timeline, auditoría y notificación y confirman rollback total.

## Incidencias, notas y seguridad modular

Las incidencias tienen ciclo propio y no se admiten sobre órdenes archivadas. Las notas usan archivado lógico y visibilidad explícita. `transport_execution` se resuelve mediante plan + override. Menú, URL, Edge y RLS comprueban el módulo; el frontend no usa `service_role` ni escribe tablas.

## Patrón para fases futuras

- POD/documentos: transacción para metadatos, auditoría y outbox; saga para Storage.
- OCR: ledger transaccional de cuota y reconciliación externa.
- Facturación: numeración y emisión inmutables con outbox.
- Cuotas: reservas idempotentes con locking por tenant y periodo.

## Fuera de alcance

No se incorporan mapas, OCR, POD, fotografías, firmas, eCMR, DeCA, facturación ni IA.
