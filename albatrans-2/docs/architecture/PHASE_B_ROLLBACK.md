# Rollback operativo de Fase B

La migración `202608040004_phase_b_transport_core.sql` es aditiva. En producción no debe revertirse sin backup y aprobación explícita.

Orden de retirada, solo si no existen datos que deban conservarse: desactivar rutas y Edge Function; exportar `transport_events`, asignaciones, items, stops y órdenes; retirar policies y triggers; eliminar tablas en el orden inverso de dependencias; eliminar funciones y finalmente los cuatro enums.

Los contadores y números de orden no deben reconstruirse ni reutilizarse. Ante rollback parcial se conservan las tablas y se deshabilita la superficie de escritura.
