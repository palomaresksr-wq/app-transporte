# Operacion OCR local

## Alcance

Fase E incorpora OCR documental con revision humana sobre documentos privados.
En local, el proveedor por defecto es mock_local.

No se conecta produccion ni proveedores de pago.
No se modifica el sistema legacy leer-albaran.

## Requisitos previos

1. Supabase local levantado con migraciones de Fase E.
2. Usuario autenticado como superadmin o admin_empresa activo.
3. Modulo ocr habilitado para la organizacion objetivo.
4. Documento y version en estado available.

## Flujo operativo recomendado

1. Solicitar OCR desde UI (Procesar con OCR).
2. Si hay cola pendiente, ejecutar Procesar cola OCR local.
3. Revisar estado del job (queued, processing, needs_review, succeeded, failed).
4. Abrir revision humana para jobs en needs_review.
5. Registrar correcciones append-only por campo.
6. Aprobar o rechazar revision.

## Worker local

La Edge Function ocr soporta accion process_next:

- toma el siguiente job queued/failed elegible;
- marca processing y compromete cuota;
- descarga el objeto privado desde backend;
- ejecuta proveedor mock_local o adaptador legacy local;
- persiste resultado o fallo de forma transaccional.

Si no existe infraestructura permanente de worker, ejecutar process_next manualmente desde UI.

## Reintentos seguros

1. Si el job falla antes de iniciar proveedor, la cuota se libera.
2. Si el proveedor ya empezo, la cuota queda comprometida.
3. Reintentar creando una nueva solicitud OCR con nueva idempotency key.
4. Mantener historico; no reabrir jobs terminales.

## Reconciliacion

Usar accion reconcile de la Edge o funcion SQL reconcile_ocr_jobs para detectar:

- jobs processing bloqueados;
- reservas reserved expiradas;
- eventos outbox pendientes/fallidos.

Luego:

1. evaluar cada job bloqueado;
2. confirmar si proveedor proceso o no;
3. completar resultado o marcar fail_ocr_job;
4. reprocesar outbox segun politica local.

## Diagnostico rapido

Errores esperados:

- module_disabled: modulo ocr desactivado.
- quota_exhausted: sin capacidad mensual.
- operation_rejected: documento/version no aptos o payload invalido.
- provider_timeout: timeout simulado por mock.
- provider_failure: fallo del proveedor.
- idempotency_conflict: misma key con payload diferente.

## Limpieza de fixtures

1. Eliminar primero correcciones y revisiones OCR de la organizacion de prueba.
2. Eliminar resultados y jobs OCR de la organizacion de prueba.
3. Eliminar reservas y outbox OCR de la organizacion de prueba.
4. Limpiar objetos de storage solo si son fixtures locales.

## Seguridad y privacidad

- Archivos privados; no exponer service_role al frontend.
- No persistir URLs firmadas.
- No guardar raw_response_json en auditoria/timeline.
- No registrar contenido documental completo en logs visibles.
- Mantener secretos de proveedor solo en variables de entorno backend.

## Pendiente para produccion

1. Worker permanente con scheduler.
2. Politica de retries/backoff para outbox OCR.
3. Alertado operativo para jobs stuck.
4. Integracion progresiva y autorizada de proveedor real.
5. Validacion legal y DPA antes de transferencias fuera del entorno local.
