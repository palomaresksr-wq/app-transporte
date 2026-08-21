# Rollback de Fase J

Rollback lógico y aditivo:

1. Retirar rutas/componentes y la Edge Function `regulatory-documents`.
2. Deshabilitar `electronic_delivery_notes` para las organizaciones afectadas.
3. Revocar ejecución backend de los RPC de Fase J mediante una migración nueva.
4. Conservar documentos emitidos, revisiones, firmas, evidencias, PDF, timeline y auditoría.
5. No borrar Storage ni reutilizar números `DC-*`.

No se revierten migraciones ni se destruye historia. Las tablas pueden quedar inertes hasta una migración futura de sustitución.
