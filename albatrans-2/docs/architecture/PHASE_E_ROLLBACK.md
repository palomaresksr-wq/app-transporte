# Rollback de Fase E

La Fase E es aditiva y forward-only.
No se edita ni elimina historico previo de documentos.

Rollback operativo recomendado:

1. Desactivar modulo ocr por override en la organizacion.
2. Detener ejecucion de Edge Function ocr.
3. Congelar procesado de cola OCR local.
4. Exportar tablas OCR, auditoria y timeline asociados.
5. Revisar reservas reserved y liberarlas con comando controlado.

Rollback estructural (solo tras copia/conciliacion completa):

1. Revocar funciones transaccionales OCR.
2. Retirar grants y policies OCR.
3. Retirar triggers OCR.
4. Eliminar outbox OCR y ledger de reservas.
5. Eliminar tablas OCR.
6. Eliminar tipos OCR.

Reglas de seguridad:

- Nunca borrar documentos ni versiones de origen como parte del rollback OCR.
- Nunca ejecutar SQL destructivo automatico en produccion sin validacion previa.
- Mantener trazabilidad de auditoria y correlacion para investigacion.
