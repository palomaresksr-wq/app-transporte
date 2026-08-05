# Rollback de Fase D

La Fase D es aditiva y forward-only. No se modifican migraciones anteriores. En un entorno con datos, el rollback operativo recomendado es desactivar `document_management` y `pod_signature` mediante overrides; los datos y objetos quedan preservados y dejan de ser accesibles por UI, Edge Function y RLS.

Un rollback estructural solo es admisible tras copia y conciliación completa:

1. Detener nuevas subidas y procesar la outbox.
2. Exportar metadatos, auditoría y listado de objetos privados.
3. Verificar que no hay `pending_upload`, huérfanos ni consumidores posteriores.
4. Revocar las funciones `begin_document_upload`, `confirm_document_upload`, `begin_document_version_upload`, `fail_document_upload`, `archive_document`, `command_proof_of_delivery` y `command_document_signature`.
5. Retirar policies y grants antes de tablas, tipos y módulo.
6. El bucket solo puede eliminarse mediante una operación de retención explícitamente autorizada; nunca forma parte del rollback ordinario.

No se proporciona SQL destructivo automático para evitar pérdida de documentos. En desarrollo efímero se reconstruye desde cero con las migraciones anteriores.
