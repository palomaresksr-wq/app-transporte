# Rollback de Fase F

La Fase F es aditiva y forward-only.
No se elimina ni se reescribe historico previo de OCR ni de operaciones.

Rollback operativo recomendado:

1. Desactivar la funcion Edge `ocr` para el flujo de aplicacion.
2. Bloquear el acceso de la UI a `prepare_application`, `decide_application_proposals` y `apply_proposals`.
3. Conservar las propuestas, eventos y auditoria para investigacion.
4. Revocar temporalmente los permisos de escritura sobre `ocr_application_proposals` y `apply_ocr_proposals` si se necesita cortar la aplicacion en backend.
5. Revisar y reanudar solo despues de validar la integridad del lote pendiente.

Rollback estructural, solo tras copia y validacion completa:

1. Revocar permisos y policies de `ocr_application_proposals` y `ocr_application_command_idempotency`.
2. Retirar la funcion `apply_ocr_proposals`.
3. Retirar la tabla de propuestas y su idempotencia.
4. Retirar `transport_orders.external_reference` solo si existe una migracion de compensacion validada y nunca en produccion sin analisis previo.

Reglas de seguridad:

- No borrar documentos, versiones ni ordenes origen como parte del rollback normal.
- No eliminar auditoria, eventos ni notificaciones mientras exista una investigacion abierta.
- No ejecutar SQL destructivo automatico en produccion sin validacion manual.
