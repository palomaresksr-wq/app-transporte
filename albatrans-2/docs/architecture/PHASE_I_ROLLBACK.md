# Rollback de Fase I

La corrección aditiva `202608160002_phase_i_signature_completion_fix.sql` forma parte del cierre y debe mantenerse junto a la migración base. Retirarla aisladamente reintroduciría la consulta inválida de estado de firma durante la finalización.

Rollback lógico, sin borrar historia operativa:

1. Retirar las rutas `/driver` y la función Edge `driver-portal`.
2. Revocar `execute_driver_transport_operation` a `authenticated` y `service_role`.
3. Restaurar mediante una migración nueva las políticas RLS anteriores si se retira por completo el producto móvil.
4. Conservar `transport_events`, auditoría, incidencias, notas, POD y firmas ya creados.
5. La tabla `driver_completion_policies` puede quedar inerte; no eliminarla si contiene configuración.

No se revierten migraciones anteriores ni se borran objetos de Storage. La desactivación inmediata también puede hacerse deshabilitando `transport_execution` para la organización.
