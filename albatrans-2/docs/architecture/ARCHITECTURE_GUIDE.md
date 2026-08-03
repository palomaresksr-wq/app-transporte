# Guía de arquitectura

## Capas

- `packages/contracts`: tipos compartidos, códigos y contratos de comandos. No contiene IO.
- `packages/domain`: reglas puras y validaciones. Depende de contratos, no de React ni Supabase.
- `apps/web/src/data`: repositorios y gateways hacia Supabase y Edge Functions.
- `apps/web/src/auth`: sesión, resolución de acceso y guards.
- `apps/web/src/pages` y `layouts`: presentación y orquestación de interfaz.
- `supabase/migrations`: esquema, funciones SQL, constraints, grants y RLS.
- `supabase/functions`: comandos privilegiados con revalidación de JWT y superadmin.
- `supabase/tests`: pgTAP para esquema, RLS y aislamiento.

El flujo de escritura sensible es UI → repositorio → Edge Function → base con service role. El frontend nunca recibe `service_role`. Las lecturas usan el JWT del usuario y RLS.

## Identidad y acceso

`auth.users` gestiona credenciales. `profiles` guarda datos personales y estado; `platform_admins` resuelve el rol de plataforma; `organization_memberships` resuelve organización, rol y estado empresarial. El orden de acceso es perfil, plataforma, membership, organización y después entitlements.

El superadmin es singleton y no pertenece a una organización. Un usuario empresarial pertenece a una sola organización en la versión actual. `admin_empresa` y `conductor` nunca deben convertirse en superadmin desde endpoints empresariales.

## Multiempresa y RLS

Todas las tablas públicas tienen RLS habilitada y forzada. `authenticated` recibe principalmente `SELECT`; las escrituras privilegiadas pertenecen a Edge Functions. Toda tabla operativa futura debe incluir `organization_id`, índices acordes y políticas de tenant. Las funciones `security definer` deben fijar `search_path`, restringir ejecución y probar aislamiento transversal.

## Entitlements

El valor efectivo de un módulo es plan + override. El valor efectivo de un límite es plan + override `custom`; `inherit` usa el plan. Cero es capacidad cero y no existe el concepto especial de ilimitado. Cambiar de plan no elimina overrides.

## Auditoría

Los comandos sensibles crean `audit_events` con actor, alcance, entidad, correlación y datos limitados. Nunca se registran contraseñas, tokens o secretos. Hasta disponer de una función SQL transaccional, las Edge Functions usan compensación; esta es una deuda conocida porque no equivale a atomicidad fuerte.

## Migraciones

- Una migración nueva por cambio aprobado; nunca editar una aplicada.
- Migraciones forward-only con rollback operativo documentado.
- Constraints e índices se diseñan junto a tablas y RLS.
- Tipos `Database` se regeneran desde el esquema local.
- Producción requiere backup, dry run, ventana, observabilidad y aprobación explícita.

## Convenciones futuras

- Nombres SQL `snake_case`; TypeScript `camelCase`; componentes `PascalCase`.
- IDs UUID; fechas UTC `timestamptz`; importes con representación decimal acordada.
- Estados mediante enums o constraints versionables.
- Contratos exactos y validación en ambos bordes.
- Repositorios explícitos y tipados; no abstraer builders de Supabase perdiendo narrowing.
- Paginación obligatoria para colecciones crecientes.

## Límites arquitectónicos actuales

- Las Edge Functions son grandes y duplican autenticación, identidad, límites y auditoría.
- No existe transacción atómica para operaciones Auth + Postgres ni para reservas de cuota concurrentes.
- El contexto empresarial todavía no carga módulos/límites para portales funcionales.
- Los diálogos son paneles con `role=dialog`, sin focus trap ni restauración de foco.
- Los artefactos Supabase `.temp` deben excluirse del control de versiones.

