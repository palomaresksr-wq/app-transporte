# Operación de documentos reglamentarios

## Flujo de oficina

Desde una orden: crear borrador, revisar errores/warnings, emitir, generar PDF, firmar, completar o crear revisión. Emisión reserva `DC-AAAA-NNNNNN` por organización bajo lock transaccional. Una clave idempotente repetida con idéntico payload devuelve el resultado anterior; con payload distinto genera conflicto.

El PDF y el export JSON se producen desde el snapshot emitido. El export usa `albatrans.regulatory.v1` y no afirma compatibilidad con un estándar eCMR externo.

## Portal conductor

El conductor asignado puede consultar el documento, abrir el PDF firmado temporalmente y firmar reutilizando el canvas móvil de recepción. Reasignar la orden revoca inmediatamente el acceso. No puede cambiar participantes, mercancías ni otros datos administrativos.

## Incidencias operativas

- Si faltan datos esenciales, corregir la orden antes de emitir el borrador actual o reconstruirlo mediante revisión según su estado.
- Un documento emitido no se edita; crear revisión con motivo.
- No publicar URLs de Storage.
- No interpretar SHA-256 como firma legal.
- El período legal de conservación debe validarse antes de producción regulada; el sistema sólo garantiza archivado lógico e historia no borrable por uso ordinario.

## Validación local de cierre

El 22-08-2026 se verificó con Auth real local el flujo admin/conductor: borrador idempotente, emisión, número `DC-AAAA-NNNNNN`, SHA-256, PDF privado descargable, firma dibujada reutilizando Fase D, reintento de firma sin efectos duplicados, export `albatrans.regulatory.v1`, revisión 2, IDOR y revocación inmediata al desasignar. Resultado: 2/2 tests de integración. Los fixtures se retiraron después (organizaciones, usuarios, documentos y objetos Storage residuales: 0).

En desarrollo local, la URL firmada se exterioriza usando `x-forwarded-host`, `x-forwarded-port` y `x-forwarded-proto`; la ruta y el token firmados por Storage no se alteran.
