# Decisiones de Fase F

## Alcance

- La Fase F aplica OCR de forma controlada sobre operaciones existentes.
- La fase no introduce matching por IA ni escritura silenciosa.
- La confirmación humana sigue siendo obligatoria antes de aplicar cambios.
- El flujo se separa en preparar, decidir y aplicar.

## Aplicacion controlada

- `prepare_application` solo genera propuestas deterministas.
- `decide_application_proposals` cambia el estado de revisión de las propuestas seleccionadas.
- `apply_ocr_proposals` aplica en una sola transaccion las propuestas aprobadas.
- Las propuestas rechazadas o pendientes no se aplican.

## Matching y comparacion

- El matching se basa en normalizacion determinista de texto, digitos y matriculas.
- Se usan coincidencias exactas, ambiguas, conflicto y destino ausente.
- No se sobrescriben valores actuales si la propuesta quedo obsoleta.
- `transport_orders.external_reference` se usa como referencia externa editable para el numero documental.

## Entidades afectadas

- Orden de transporte.
- Paradas de transporte.
- Items de transporte.
- Clientes.
- Localizaciones.
- Vehiculos.
- Conductores.

## Seguridad y trazabilidad

- El backend mantiene la autoridad de aplicacion.
- La app web solo consume contratos y el repositorio de propuestas.
- Cada comando usa idempotencia por tenant y clave.
- La aplicacion escribe eventos de transporte, auditoria y notificaciones internas.
- Las propuestas conservan resumen, valor actual, valor propuesto y estado de revision.

## Criterios de rechazo

- Una propuesta no se aplica si la revision no esta aprobada.
- Una propuesta no se aplica si el valor actual cambio antes de ejecutar.
- Una propuesta no se aplica si el objetivo ya no existe.
- Una propuesta no se aplica si el campo no pertenece al tipo de entidad.

## Operativa

- La aplicacion es additive y forward-only.
- No se modifican migraciones anteriores.
- No se habilita ninguna escritura automatica sin revision humana previa.
- La UX debe mostrar resumen, comparacion y confirmacion explicita antes de aplicar.
