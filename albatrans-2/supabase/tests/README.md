# Pruebas SQL y RLS de Fase 1

La suite valida exclusivamente la fundación SaaS de Albatrans 2.0.

## Requisitos locales

- Supabase CLI instalada.
- Docker Desktop activo.
- Ejecutar los comandos desde `albatrans-2`.
- No utilizar `supabase link`, `supabase db push` ni una base remota.

## Instalación limpia (entorno efímero recomendado)

```text
powershell -ExecutionPolicy Bypass -File scripts/test-sql-ephemeral.ps1
```

El script crea un proyecto Supabase aislado con identificador, contenedor y
puertos propios, parte de cero, aplica las migraciones, ejecuta toda la suite
pgTAP y elimina exclusivamente ese entorno temporal al terminar. No ejecuta
`db reset`, no para los contenedores habituales y no altera sus datos.

`phase_1_schema.sql` es deliberadamente una prueba de instalación limpia: sus
aserciones exactas sobre catálogos y ausencia de datos empresariales no deben
ejecutarse como prueba de estado sobre una base persistente ya preparada.

## Entorno persistente

En una instancia local con datos preparados, `supabase status` y las pruebas de
integración de la aplicación validan el estado operativo sin asumir una base
vacía. No se debe ejecutar `supabase db reset` ni la suite de instalación limpia
sobre esa instancia. Los fixtures SQL están dentro de transacciones con
`ROLLBACK`, pero las pruebas singleton crean su propio superadmin y pertenecen
exclusivamente al recorrido efímero.

Para inspeccionar la instancia persistente sin modificarla:

```text
supabase status
```

La URL de PostgreSQL debe apuntar a `127.0.0.1` y al puerto local configurado
(`54322` en este proyecto).

## Archivos

- `phase_1_schema.sql`: instalación limpia, objetos, RLS, grants y catálogos.
- `phase_1_constraints.sql`: constraints y validaciones estructurales.
- `phase_1_profiles_rls.sql`: perfil propio y perfiles bloqueados.
- `phase_1_organizations_rls.sql`: visibilidad y estados de organización.
- `phase_1_memberships_rls.sql`: roles, estados y visibilidad de membresías.
- `phase_1_platform_admin_rls.sql`: superadmin único y acceso de plataforma.
- `phase_1_modules_rls.sql`: resolución de plan más override.
- `phase_1_limits.sql`: límites efectivos y capacidad.
- `phase_1_audit_rls.sql`: auditoría exclusiva del superadmin.
- `phase_1_cross_tenant_isolation.sql`: aislamiento transversal.

## Limitación conocida

`current_organization_has_capacity` comprueba una cifra, pero no reserva cuotas
de forma atómica frente a operaciones concurrentes. Ningún módulo debe consumir
cuotas duras en producción hasta incorporar esa operación.
