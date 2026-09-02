# Decisiones Fase L

## Identidad y aislamiento

Los usuarios externos usan Supabase Auth y `profiles`, pero no `organization_memberships`. La vinculación explícita `client_portal_memberships` fija una sola organización transportista y un solo `clients.id`. Los roles `client_admin` y `client_viewer` son tipos separados de los roles internos.

La cadena de autorización es JWT → profile activo → membership externa activa → organización activa → cliente activo → suscripción/módulo efectivo → pertenencia de la entidad. Los identificadores recibidos del navegador nunca determinan por sí solos el tenant.

## Visibilidad y privacidad

`client_portal_visibility_policies` configura estado, fechas, mercancía, incidencias, POD, documentos reglamentarios, facturas y firmas. Las incidencias nacen como `internal`; sólo `client_visible` puede atravesar RLS. No se exponen pricing, prefacturas, OCR, notas internas ni auditoría completa.

Las descargas usan URLs firmadas de 60 segundos creadas en `client-portal` después de comprobar organización, cliente, documento/factura y estado. Storage sigue privado.

## Administración

El alta directa reutiliza el patrón saga/idempotente de Fase K mediante `client_portal_commands`. La identidad Auth se crea confirmada y la base se completa atómicamente; si falla la segunda parte, se compensa eliminando exclusivamente la identidad recién creada. `client_admin` no gestiona usuarios en esta fase: se reserva a `admin_empresa`/superadmin para reducir superficie de escalada.

No se implementan acceso público, GPS continuo, chat, email masivo ni interoperabilidad eCMR externa.
