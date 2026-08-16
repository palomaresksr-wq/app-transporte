# Rollback de Fase H

Fase H es forward-only. No borrar la migracion ni revertir en produccion de forma manual.

En un entorno no productivo sin facturas que conservar, el rollback controlado consiste en detener la Edge Function, retirar las rutas de UI y crear una migracion posterior que revoque RPCs/policies, elimine primero referencias de documentos a facturas, y despues tablas en orden: `invoice_command_idempotency`, `invoice_payments`, `invoice_lines`, `invoices`, `invoice_series`, `invoice_taxes`, `billing_fiscal_settings`; por ultimo tipos y funciones.

Si existen numeros emitidos, PDFs, pagos o auditoria, no se deben borrar: desactivar las operaciones y preparar una migracion de archivo/migracion de datos revisada por responsables fiscales. Fase G (`billing_preinvoices`, valoraciones y tarifas), el sistema documental y sus migraciones permanecen intactos.

Antes de cualquier rollback: copia verificable, inventario por organizacion, reconciliacion de Storage, prueba en clon, plan de recuperacion y aprobacion explicita. Nunca ejecutar este procedimiento contra Albatrans Legacy.
