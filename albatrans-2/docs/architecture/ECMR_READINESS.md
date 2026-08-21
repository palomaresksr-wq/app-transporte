# Preparación eCMR

## Disponible

El modelo interno versionado representa header, participantes extensibles, transporte, múltiples paradas, líneas de mercancía, requisitos especiales controlados, firmas/evidencias, revisiones, identificadores externos y export JSON. `ecmr_draft` indica únicamente preparación estructural.

Los serializers se seleccionan por `schema_version`; `1.0` es el primer contrato. Los históricos conservan su snapshot aunque cambien tablas vivas.

## Futuro mapeo

Una integración futura deberá introducir un adaptador por proveedor/estándar que transforme `RegulatoryDocumentExportV1`, valide contra el esquema externo oficial, gestione identificadores/estados externos y use el outbox `document.external_sync_required`. No debe modificar snapshots históricos.

## No disponible

No hay proveedor eCMR, intercambio externo, XML propietario, registro de confianza, sellado de tiempo cualificado, firma cualificada, verificación pública, certificación ni homologación. Estos puntos requieren selección de estándar/proveedor y validación jurídica/técnica externa.
