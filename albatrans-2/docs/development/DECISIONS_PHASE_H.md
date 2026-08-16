# Decisiones de Fase H

## Alcance

Fase H aporta facturacion fiscal basica: series, emision desde prefactura aprobada, impuestos por linea, snapshots, cobros manuales, rectificativas y PDF privado. No afirma ni implementa certificacion AEAT, VeriFactu, Facturae, FACe o asesoramiento fiscal automatico.

## Numeracion y estados

No se crean borradores numerados. La conversion de prefactura emite directamente y reserva el numero en la misma transaccion mediante bloqueo de la fila de serie. Esto evita huecos por borradores abandonados. Un numero emitido no se borra ni reutiliza. `calendar_year` incluye el ano en la representacion; el contador sigue siendo monotono para toda la serie. Para reiniciar numeracion anual se debe crear una serie nueva de forma explicita.

Los estados soportados son `draft`, `issued`, `partially_paid`, `paid`, `overdue`, `cancelled` y `rectified`. `draft` queda reservado para una ampliacion compatible, pero el flujo de Fase H no lo usa. Cobros y vencimiento actualizan solo estado y saldos; no alteran los datos fiscales emitidos.

## Inmutabilidad y snapshots

La factura y sus lineas guardan emisor, cliente, impuesto, prefactura, orden y valoracion en JSON de snapshot. Los triggers impiden cambiar o borrar los campos fiscales de una factura emitida y cualquier linea emitida. Los pagos son append-only. Cambios posteriores en cliente, empresa, tarifa o impuesto no afectan al historico.

## Impuestos y redondeo

Cada linea conserva codigo, nombre, clase, porcentaje e importe fiscal. Se incluyen modelos iniciales para IVA 21, 10, 4, 0 y exento. Los importes usan `numeric`; el IVA se redondea a centimos por linea, mitad alejandose de cero. El motivo de exencion es obligatorio. La configuracion no sustituye validacion de un asesor fiscal.

## Rectificativas y cancelacion

Una emitida no se edita. La rectificativa es otra factura, de importe negativo, enlazada por `rectified_invoice_id`, total o parcial, con motivo obligatorio y serie seleccionable. Fase H limita a una rectificativa activa por factura original para eliminar carreras ambiguas. Facturas sin cobros en `issued`/`overdue` pueden cancelarse conservando numero, motivo, usuario y fecha; las cobradas requieren rectificativa.

## Seguridad

Todas las tablas fiscales tienen RLS y FORCE RLS. El acceso autenticado es de solo lectura, tenant-aware y condicionado al modulo `billing`; las escrituras pasan por la Edge Function y RPC backend-only con comprobacion de actor. El frontend no recibe `service_role`.
