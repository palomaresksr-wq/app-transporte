# ADR-002: Atomicidad, concurrencia e idempotencia

- Estado: aceptada como requisito previo de producción; implementación pendiente.
- Fecha: 2026-08-04.
- Alcance: comandos con efectos externos, cuotas y auditoría.

## Contexto

Supabase Auth y Postgres no comparten una transacción distribuida. Además, una
comprobación de cuota seguida de una escritura permite carreras concurrentes.
Reintentar peticiones sin una clave estable puede duplicar usuarios, consumos,
facturas o eventos de auditoría.

Este ADR no implementa mecanismos nuevos. Define las garantías que deben existir
antes de habilitar las operaciones indicadas al final.

## Decisión

### Auth y Postgres

Los comandos que combinan Auth y Postgres se modelarán como una saga explícita:

1. El cliente enviará una `idempotency_key` por intención de negocio.
2. Postgres registrará un comando con estado (`pending`, `completed`, `failed` o
   `compensation_required`) y conservará su resultado estable.
3. Cada efecto Auth será repetible o detectable mediante identificadores
   persistidos; no se confiará solo en el correo.
4. Si falla Postgres después de Auth, se intentará compensar el usuario Auth. Si
   la compensación falla, el comando quedará pendiente de reconciliación y no se
   presentará como completado.
5. Un reconciliador procesará fallos parciales con trazabilidad y alertas.

No se prometerá rollback distribuido. Se prometerá convergencia observable y una
respuesta idempotente para la misma clave y payload. Reutilizar una clave con un
payload distinto será un conflicto.

### Cuotas y concurrencia

Las cuotas duras se reservarán mediante una función SQL transaccional. La función
bloqueará la fila de cuota o un registro de control por organización, calculará
el límite efectivo dentro de la misma transacción y escribirá un ledger de
reserva/consumo antes de devolver éxito. Un `SELECT` seguido de un `INSERT` desde
la aplicación no será válido para hacer cumplir límites.

Cada reserva tendrá clave idempotente, cantidad, unidad, periodo y estado. La
liberación o confirmación será asimismo idempotente. Los contadores derivados se
podrán reconstruir desde el ledger.

### Reintentos y fallos parciales

- Solo se reintentará automáticamente una operación idempotente.
- Se aplicará backoff exponencial con jitter y máximo acotado.
- Errores de validación, permisos o conflicto de payload no se reintentarán.
- Timeouts se resolverán consultando el comando por su clave antes de repetir.
- Los trabajos agotados pasarán a reconciliación manual/automática con alerta.

### Auditoría y eventos

La mutación de negocio y su evento de auditoría se escribirán en la misma
transacción Postgres. Si existe un efecto externo posterior, se añadirá un evento
outbox en esa misma transacción. Un worker publicará el outbox con entrega al
menos una vez y consumidores idempotentes. La auditoría no contendrá secretos,
tokens, contraseñas ni payloads completos de proveedores.

Los intentos fallidos relevantes se registrarán por separado sin convertir un
fallo de auditoría en un cambio de negocio parcialmente confirmado.

## Puertas obligatorias

Antes de crear usuarios en producción:

- tabla/contrato de comandos idempotentes;
- saga Auth + Postgres y compensación probada;
- reconciliador y alertas;
- auditoría transaccional sin secretos.

Antes de consumir OCR:

- reserva atómica mensual;
- confirmación/liberación idempotente;
- ledger y reconciliación con el proveedor OCR.

Antes de controlar almacenamiento:

- reserva atómica de bytes antes de aceptar la carga;
- compensación por carga fallida y conciliación periódica con Storage;
- política definida para sobrepasos por operaciones simultáneas.

Antes de emitir facturas:

- número fiscal reservado en transacción según la serie aplicable;
- comando de emisión idempotente e inmutable;
- outbox para entrega/proveedor externo;
- correcciones mediante documentos compensatorios, nunca borrado o reescritura;
- reglas fiscales revisadas específicamente antes de producción.

## Consecuencias

La solución añade estados operativos, ledger, outbox y reconciliación, pero evita
duplicados y sobreconsumo bajo concurrencia. Hasta implementarla, las funciones
actuales son válidas para el entorno local y la validación del Superadmin, pero
no autorizan usuarios productivos ni consumos duros de OCR, almacenamiento o
facturación.
