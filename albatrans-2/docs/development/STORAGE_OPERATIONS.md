# Operación de Storage documental

## Flujo local

1. Iniciar Supabase local: `npx supabase start`.
2. Aplicar migraciones: `npx supabase migration up --local`.
3. Servir las Edge Functions locales según el procedimiento general del proyecto.
4. Acceder con `superadmin` o `admin_empresa` activo y módulo efectivo habilitado.
5. Subir desde la ficha de una orden. El documento solo figura como disponible tras la confirmación.

Bucket: `albatrans-documents`, privado, 10 MiB por objeto, MIME permitidos JPEG, PNG, WebP y PDF. No deben crearse URLs públicas ni almacenar URLs firmadas.

## Reconciliación manual

La acción Edge `reconcile` lista hasta 100 eventos pendientes o fallidos cuyo `next_attempt_at` ha vencido. Se contrastan `document_versions.pending_upload`, `document_outbox` y los objetos del bucket:

- metadata sin objeto: marcar mediante `fail_upload`, conservando auditoría y generando cleanup;
- objeto sin metadata: registrar `storage.orphan_detected` antes de cualquier limpieza;
- objeto y metadata concordantes: confirmar con una nueva clave idempotente;
- fallo temporal: incrementar intentos, guardar un error sin secretos y programar `next_attempt_at`.

No se borra un objeto manualmente sin verificar organización, ruta determinista, retención y ausencia de referencia. Toda limpieza física futura debe ser un worker idempotente y auditado.

## Diagnóstico seguro

Nunca imprimir `SUPABASE_SERVICE_ROLE_KEY`, tokens de subida o URLs firmadas. Los logs pueden contener IDs, `correlation_id`, estado, tamaño y MIME, pero no binarios, hashes de firma reutilizables, credenciales ni URLs temporales.

Validación estática: `npm run edge:check`. Suite SQL/RLS desde cero: `npm run sql:test:ephemeral`.
