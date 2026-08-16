# Operaciones de factura

## Preparacion

Un `admin_empresa` con `billing` efectivo configura datos fiscales, serie principal y tipos impositivos desde Facturacion. La razon social, NIF/CIF y direccion son obligatorios. La numeracion siguiente es informativa en UI; PostgreSQL es la unica autoridad que la asigna.

## Emision

1. Aprobar una prefactura.
2. Elegir serie, impuesto, fecha y vencimiento.
3. Emitir una vez. La operacion bloquea la prefactura y la serie, captura snapshots, crea lineas, actualiza ordenes, auditoria y timeline.
4. Repetir la misma solicitud con la misma `idempotency_key` devuelve el resultado previo. Una carga distinta con la misma clave produce conflicto.

La demo matematica esperada para PRE-2026-0001 es base 346,50 EUR; IVA 21 % 72,765 EUR, redondeado por linea a 72,77 EUR; total 419,27 EUR.

## Cobros y vencimiento

Los cobros son anotaciones manuales: no mueven dinero. Cada comando bloquea la factura y rechaza importes superiores al pendiente. 200,00 EUR dejan 219,27 EUR; un segundo cobro de 219,27 EUR deja estado `paid`. No se editan ni borran pagos. `mark_invoice_overdue` registra el vencimiento de una factura pendiente cuando su fecha ya ha pasado.

## PDF

`generate_invoice_pdf` compone el documento exclusivamente desde la factura y sus snapshots. Lo registra como `invoice_pdf` en `documents`/`document_versions`, lo almacena en el bucket privado `albatrans-documents` y audita la generacion. La descarga usa una URL firmada de 120 segundos. No se crea un segundo sistema documental.

## Rectificacion y cancelacion

La rectificativa requiere base positiva a corregir (hasta la base original), motivo, fecha y serie. El documento resultante contiene importes negativos y enlace a la original. La cancelacion no elimina ni libera numeracion. Ante dudas fiscales, detener la operacion y consultar asesoria: esta fase no certifica cumplimiento normativo.
