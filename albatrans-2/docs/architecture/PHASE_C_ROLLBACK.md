# Rollback Fase C

Las migraciones son aditivas y forward-only. Un rollback debe desactivar `transport_execution`, detener la Edge Function y exportar tablas operativas e idempotencia. Una nueva migración compensatoria revocará y retirará `execute_transport_operation`, eliminará `transport_command_idempotency` tras conservar sus resultados y continuará con políticas, vistas, triggers, tablas y enums en orden inverso.

No se utilizará `drop ... cascade`, no se eliminará `transport_events` ni se modificará `audit_events`. Los comandos confirmados se corrigen mediante nuevos eventos, nunca borrando timeline. No se editarán las migraciones `202608040006`, `007` u `008` después de publicarlas.
