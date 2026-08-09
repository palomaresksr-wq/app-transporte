# Decisiones de Fase E

## Proveedor inicial

- mock_local es el proveedor por defecto para desarrollo e integracion local.
- legacy_leer_albaran se implementa como adaptador local opcional.
- No se contrata ni conecta proveedor externo de pago en esta fase.

## Modelo y mutabilidad

- ocr_jobs representa el ciclo de vida del proceso por version concreta.
- ocr_results y ocr_field_results son inmutables por trigger.
- ocr_field_corrections es append-only; nunca sustituye historial.

## Cuotas y concurrencia

- Se reserva cuota en request_document_ocr de forma atomica.
- Se compromete cuota al inicio de processing (proveedor arrancado).
- Se libera cuota solo si el proveedor no llego a procesar.
- Se serializa reserva por organizacion usando lock de fila.

## Revision humana

- needs_review se activa por:
  - confianza global por debajo de umbral;
  - warnings;
  - campos invalid;
  - ausencia de campos importantes;
  - tipo documental no detectado.
- No se aplican cambios automaticos sobre ordenes en Fase E.

## Seguridad

- raw_response_json queda restringido a backend.
- Frontend consume normalized_data_json y campos normalizados.
- RLS exige modulo ocr activo para lectura tenant.
- anon sin acceso.

## Operativa

- Se agrega outbox OCR para reconciliacion y trazabilidad.
- Sin worker permanente, process_next se ejecuta manualmente en local.
- reconcile_ocr_jobs expone candidatos para saneamiento operativo.
