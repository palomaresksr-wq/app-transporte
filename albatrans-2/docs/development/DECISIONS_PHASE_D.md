# Decisiones de Fase D

## Alcance y autorización

- `document_management` es un módulo independiente porque los documentos generales no deben depender de OCR, POD ni albaranes electrónicos. Está activo en Starter, Profesional y Enterprise; Personalizado hereda `false` hasta override.
- POD y firmas requieren además `pod_signature`.
- En esta fase solo `admin_empresa` de la organización activa y `superadmin` activo acceden. No se habilita al conductor hasta definir su portal y permisos explícitos.
- Las fotografías usan `documents` y `document_versions`; no se duplica un modelo binario específico.

## Storage y saga

El bucket `albatrans-documents` es privado. La ruta física es determinista y no contiene el nombre original: `organization_id/documents/document_id/version_id/object`. El frontend nunca recibe `service_role`.

La subida es una saga idempotente:

1. `begin_document_upload` o `begin_document_version_upload` bloquea/valida y confirma en PostgreSQL el metadata `pending_upload`, auditoría, timeline y outbox.
2. La Edge Function emite una URL de subida firmada y el navegador carga directamente al bucket privado.
3. La Edge Function descarga el objeto con credenciales backend, comprueba MIME y tamaño, calcula SHA-256 y llama a `confirm_document_upload`.
4. La confirmación cambia versión y documento a `available`, establece `current_version_id`, y escribe auditoría, timeline y outbox en una sola transacción.
5. Ante fallo externo, el metadata nunca se declara disponible. `fail_document_upload` conserva el fallo y crea `storage.cleanup_required`.

Las URLs firmadas duran 120 segundos, no se almacenan y nunca aparecen en auditoría. El archivo original no se borra desde la interfaz; el archivado es lógico.

## Idempotencia e inmutabilidad

Cada comando persiste `organization_id + idempotency_key`, hash canónico del payload y resultado. Repetir clave y payload devuelve el mismo resultado; cambiar el payload produce conflicto. Las versiones disponibles son inmutables. Las firmas solo permiten una revocación con motivo. Timeline y auditoría continúan append-only.

## Limitaciones deliberadas

- Una firma dibujada o tipada se describe como representación básica, no como firma electrónica cualificada.
- No hay OCR, certificados, sellado temporal, DeCA, eCMR, facturación, IA ni portales completos.
- La reconciliación local expone la cola pendiente para operación manual. Un worker programado y borrado físico con retención deberán diseñarse antes de producción a escala.
