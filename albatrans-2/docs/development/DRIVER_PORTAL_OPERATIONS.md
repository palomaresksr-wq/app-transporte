# Operación del portal del conductor

## Resultado de cierre local

Auth real, Edge Functions, Storage privado, hash SHA-256, timeline, auditoría, revocación inmediata por reasignación e idempotencia quedaron validados. Resultado SQL/RLS: 20 archivos y 373 aserciones. La validación visual manual en 360x800, 390x844 y 430x932 queda pendiente cuando el navegador integrado esté disponible; no se atribuye un resultado visual no observado.

## Rutas y flujo

- `/driver` redirige a `/driver/transports`.
- `/driver/transports` muestra hoy, próximos y completados recientes (máximo 30).
- `/driver/transports/:orderId` muestra la siguiente acción válida, mercancía, incidencias, notas y entrega.

Flujo: avisado → trayecto a carga → llegada → espera/carga → cargado → salida → llegada a destino → espera/descarga → entregado → documentación → completado.

Las horas proceden de PostgreSQL. El contador de espera debe derivarse de `transport_waiting_times`; nunca se acepta una hora arbitraria del dispositivo.

## Seguridad operativa

El conductor sólo ve la orden que sigue asignada a su ficha vinculada. Cambiar un `orderId` devuelve no disponible. Perfil, membership, organización y conductor deben estar activos. La oficina continúa usando sus rutas y permisos existentes.

## Incidencias, notas y entrega

Incidencias y discrepancias usan `transport_incidents`; notas usan `transport_notes` con visibilidad de conductor y administración. POD, fotos y firma permanecen en almacenamiento privado y deben recorrer el pipeline documental (MIME, tamaño, hash y confirmación) antes de considerarse disponibles.

## Mala cobertura

No recargar durante la edición. Cuando aparezca “Sin conexión”, esperar cobertura y reintentar manualmente. La misma petición reintentada debe conservar su `idempotency_key`; no existe todavía una cola offline persistente.

## Limitaciones de esta fase

No hay GPS continuo, navegación propia, push móvil, caché offline sensible ni firma cualificada. La captura documental móvil reutiliza Fase D; una futura mejora podrá añadir cola cifrada y progreso durable sin cambiar el modelo operativo.

Validaciones técnicas de cierre: TypeScript y ESLint verdes; 160 tests Vitest pasados; 371 aserciones pgTAP pasadas; Deno fmt/lint/check verde para 12 entrypoints; build de producción verde; `npm audit --audit-level=high` sin vulnerabilidades.
