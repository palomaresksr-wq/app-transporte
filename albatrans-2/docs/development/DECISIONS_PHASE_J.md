# Decisiones de Fase J

## Alcance y advertencia normativa

Fase J implementa un núcleo técnico para Documento de Control y un `ecmr_draft` estructural. No certifica, homologa ni acredita conformidad jurídica con Documento de Control, eCMR, eIDAS o una norma externa. La validación jurídica y técnica externa sigue siendo obligatoria antes de uso regulado.

## Modelo único y snapshots

`transport_regulatory_documents` referencia `transport_orders`; no duplica el transporte. El borrador se construye desde orden, organización, cliente, paradas, mercancías, conductor y vehículo. Al emitir, el JSONB versionado se canoniza mediante la representación determinista de PostgreSQL `jsonb::text`, se calcula SHA-256 y se conserva en `transport_regulatory_revisions`. Los datos vivos posteriores no alteran lo emitido.

## Ciclo y revisiones

Estados: draft, ready, issued, in_execution, completed, amended, cancelled y archived. Un cambio material crea una nueva revisión con razón, actor, fecha, snapshot y enlace a la revisión previa. La política inicial exige evaluar y obtener firmas nuevas para cada revisión; las firmas previas siguen unidas a su versión documental histórica.

## Entitlement y seguridad

Se reutiliza `electronic_delivery_notes`, además del pipeline `document_management`. No se amplía el catálogo de módulos aprobado. Admin empresa opera en su tenant; conductor sólo lee/descarga/exporta/firma documentos de su orden actualmente asignada; superadmin conserva acceso auditado. Anon no accede y frontend no contiene `service_role`.

## Integridad, PDF y QR

El hash es evidencia de integridad técnica, no firma criptográfica legal. El PDF nace exclusivamente del snapshot emitido, se versiona en el bucket privado existente y se descarga mediante URL firmada breve. El QR se deja preparado conceptualmente pero no se imprime en esta fase: no existe aún una URL pública de verificación segura.

## Campos especiales y validación

ADR y temperatura se serializan bajo `specialRequirements.schemaVersion=1.0`; no se implementa normativa sectorial completa. Las políticas de validación son versionables. El dominio puro y PostgreSQL comprueban transportista, origen, destino y mercancía; matrícula ausente es warning.

## Frontera de comandos

Los RPC mutadores sólo conceden `execute` a `service_role` y además verifican el rol efectivo. La Edge Function autentica y autoriza primero al usuario, y sólo entonces ejecuta el comando con su cliente backend, conservando actor, alcance, correlación e idempotencia. El JWT del usuario nunca obtiene permiso directo sobre estos RPC.
