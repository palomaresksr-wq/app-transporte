# Decisiones de arquitectura de Albatrans 2.0

Este documento registra las decisiones aprobadas. Cualquier cambio posterior
debe documentar el motivo, el impacto, la fecha y la aprobación antes de
implementarse.

## Producto y alcance

1. Albatrans 2.0 es un SaaS multiempresa.
2. Se desarrolla en paralelo a Albatrans Legacy.
3. La Fase 1 no modifica tablas, autenticación, OCR, Storage ni funcionalidades
   operativas del sistema legacy.
4. No se ejecutan migraciones en producción durante el desarrollo.
5. `deliveries` y `entregas` no se copiarán al modelo definitivo.
6. La futura fuente de verdad del transporte será `transport_orders`, con
   paradas, asignaciones, estados y documentos.

## Identidad

1. Supabase Auth gestiona exclusivamente las contraseñas.
2. No se copian contraseñas legacy.
3. `profiles` representa a la persona y no contiene rol ni organización.
4. Cada usuario pertenece como máximo a una empresa en la primera versión.
5. Esa restricción se aplica en `organization_memberships`, no en `profiles`.
6. Los roles iniciales son `superadmin`, `admin_empresa` y `conductor`.
7. No existen permisos personalizados en la primera versión.

## Superadministración

1. Existe un único superadmin: el propietario de Albatrans.
2. Es un rol de plataforma independiente.
3. No tiene `organization_membership`.
4. Se representa mediante `auth.users`, `profiles` y `platform_admins`.
5. No puede ver contraseñas.
6. Puede gestionar empresas, administradores, estados, planes, pago,
   vencimiento, notas, módulos, límites, consumo y auditoría.
7. Las empresas se suspenden o archivan sin borrar datos.
8. Las operaciones sensibles pasan por Edge Functions y generan auditoría.
9. `service_role` nunca se expone en React.

## Organizaciones

Estados aprobados:

- `pending`;
- `active`;
- `maintenance`;
- `blocked`;
- `suspended`;
- `archived`.

Solo `active` permite acceso empresarial normal. Mantenimiento, bloqueo,
suspensión y archivado conservan los datos.

Una organización archivada no se reactiva directamente. Para interrupciones
reversibles se usan `maintenance`, `blocked` o `suspended`.

## Planes

Planes iniciales:

- Starter;
- Profesional;
- Enterprise;
- Personalizado.

Starter incluye 1 administrador, 5 conductores, transportes, clientes,
vehículos, POD y firma y albaranes electrónicos.

Profesional incluye 5 administradores, 25 conductores, todo Starter, OCR,
facturación, fichajes, vacaciones, exportaciones, informes, auditoría
empresarial y soporte prioritario.

Enterprise incluye todos los módulos. No utiliza el concepto de ilimitado:
todos los límites son valores numéricos altos y configurables mediante el mismo
mecanismo de overrides.

Personalizado parte sin módulos ni límites heredados y se configura
manualmente.

## Módulos

Catálogo inicial:

- `transport_management`;
- `client_management`;
- `vehicle_management`;
- `pod_signature`;
- `electronic_delivery_notes`;
- `ocr`;
- `billing`;
- `time_tracking`;
- `leave_management`;
- `exports`;
- `reports`;
- `api_access`;
- `support_access`;
- `audit_access`.

La fórmula de resolución es:

`configuración del plan + override de empresa = módulo efectivo`

Un override tiene prioridad sobre el plan. Un módulo no declarado queda
desactivado.

Desactivar un módulo:

- no borra datos;
- lo oculta del menú;
- bloquea la ruta directa;
- bloquea Edge Functions;
- bloquea el acceso mediante RLS;
- permite recuperar los datos al reactivarlo.

`audit_access` es el entitlement futuro para que un administrador consulte la
auditoría autorizada de su propia organización. Starter lo tiene desactivado;
Profesional y Enterprise, activado; Personalizado, desactivado hasta override.
No se confunde con informes ni soporte. El acceso del superadmin a auditoría no
depende de este módulo.

## Límites

Límites iniciales:

- `max_admins`;
- `max_drivers`;
- `max_documents_total`;
- `max_documents_monthly`;
- `max_ocr_monthly`;
- `max_storage_bytes`;
- `max_exports_monthly`.

Todos los límites son numéricos y configurables. No existe un valor especial
de ilimitado. Cero impide consumo. Los overrides de empresa tienen prioridad
sobre el plan.

Valores Enterprise iniciales:

- 100 administradores;
- 1.000 conductores;
- 1.000.000 documentos totales;
- 100.000 documentos mensuales;
- 50.000 operaciones OCR mensuales;
- 10 TiB de almacenamiento;
- 100.000 exportaciones mensuales.

Estos valores no son privilegios especiales y pueden cambiarse desde
superadministración.

## Seguridad

1. React oculta módulos y protege rutas para mejorar la experiencia.
2. React no constituye la autorización efectiva.
3. RLS comprueba identidad, empresa, membresía, estado y módulo.
4. Las Edge Functions repiten las comprobaciones antes de operaciones
   sensibles.
5. El rol `anon` no accede a las tablas de Fase 1.
6. Las pruebas incluyen dos empresas y accesos cruzados.
7. Los eventos de auditoría no se actualizan ni eliminan desde clientes.

## Transición legacy

1. Los usuarios legacy continúan funcionando durante la migración.
2. La vinculación se prepara mediante una tabla puente.
3. Los IDs legacy se representan como texto para no asumir tipos.
4. Los conflictos de identidad requieren verificación.
5. Vincular una identidad no desactiva automáticamente su acceso legacy.

## Implementación por bloques

1. Documentación y contratos.
2. Reglas de dominio.
3. Migración SQL propuesta, sin ejecución remota.
4. Pruebas SQL y RLS.
5. AuthContext y guards.
6. Edge Functions de plataforma.
7. Panel básico de superadmin.
8. Portal básico de empresa.
9. Preparación de la vinculación legacy.
10. Tests locales y build.
