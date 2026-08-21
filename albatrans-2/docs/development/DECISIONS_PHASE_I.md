# Decisiones de Fase I

## Resultado final de integración local

La integración Auth/Edge real confirmó el flujo completo con dos conductores y un administrador temporales: acceso por asignación, IDOR 404, diez transiciones operativas, espera basada en timestamps del servidor, incidencia, nota, POD y firma dibujada en Storage privado, finalización e idempotencia. Se corrigió aditivamente la comprobación de firma activa: `document_signatures` representa la vigencia mediante `revoked_at is null`, no mediante una columna `status`. La suite efímera final ejecuta 20 archivos y 373 aserciones. Los fixtures y objetos privados se eliminaron con residuo cero.

## Un único modelo operativo

El portal usa `transport_execution_status`, los triggers de transición y los timestamps de Fase C. La interfaz sólo traduce el estado a la siguiente acción; PostgreSQL conserva la autoridad. `execute_driver_transport_operation` es un adaptador restringido, no un segundo motor.

## Autorización

El vínculo de identidad es `auth.uid()` → membership activa `conductor` → `drivers.membership_id` activo → `transport_orders.assigned_driver_id`. Se comprueba en cada lectura y comando. Una reasignación revoca el acceso inmediatamente. Los módulos mínimos son `transport_management` y `transport_execution`; POD/firma dependen además de sus módulos y política.

## Mercancía real

Una diferencia no cambia el plan. Se registra como `transport_incidents.category = missing_goods`, incluyendo previsto/real en la descripción. Así se conserva la orden original y la trazabilidad.

## Finalización

`driver_completion_policies` configura por organización POD, firma y documento mínimo. El estado `delivered` siempre es obligatorio. Una incidencia crítica abierta genera advertencia y notificación, pero no bloquea salvo futura política explícita.

## Documentos y firma

Se conserva el bucket privado `documents`, los límites y hashes de Fase D. La UI usa “Firma de recepción”; no atribuye cualificación, certificado ni conformidad eIDAS. Las URLs públicas están prohibidas.

## Cobertura y PWA

La UI detecta `navigator.onLine`, bloquea doble envío, conserva el estado de formularios montados y genera una UUID idempotente por acción. No hay cola durable todavía. El manifest permite instalación básica, sin Service Worker ni caché de datos sensibles.

## Validación final local

La migración completa se validó desde cero mediante 20 archivos pgTAP y 371 aserciones. Las pruebas conductuales cubren asignación propia, mismo tenant, tenant distinto, perfil y membership bloqueados, conductor/organización inactivos, módulo desactivado, IDOR, idempotencia y revocación inmediata tras reasignar.
