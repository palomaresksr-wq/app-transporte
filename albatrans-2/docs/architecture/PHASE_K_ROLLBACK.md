# Rollback de Fase K

Fase K es aditiva. Antes de retirar tablas o funciones debe deshabilitarse la UI y detener nuevas operaciones de `user-management`.

1. Resolver todos los comandos `prepared` o `reconciliation_required` comparando Auth y PostgreSQL.
2. Retirar el trigger de bootstrap, políticas y grants específicos.
3. Retirar funciones backend de preparación, finalización y fallo.
4. Conservar o exportar `audit_events`; nunca borrar identidades Auth ni históricos operativos como parte de un rollback automático.
5. Sólo después, retirar `organization_onboarding`, `user_management_commands` y `company_user_lifecycle` si una revisión de datos demuestra que no son necesarios.

El rollback no debe desactivar RLS, exponer `service_role`, borrar usuarios con transportes/documentos/facturas ni modificar migraciones ya aplicadas. La reversión de Auth exige una operación explícita, auditada y por identidad.
