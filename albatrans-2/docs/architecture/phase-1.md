# Fase 1 · Fundación SaaS, identidad y control de acceso

## Estado

Diseño aprobado para implementación local. Ninguna migración de esta fase debe
ejecutarse en producción como parte de su desarrollo.

## Objetivo

Construir la base multiempresa de Albatrans 2.0 sin alterar Albatrans Legacy:

- Supabase Auth como único gestor de contraseñas de Albatrans 2.0;
- perfiles personales sin empresa ni rol;
- organizaciones SaaS;
- una membresía empresarial como máximo por usuario;
- superadministración independiente de las empresas;
- planes, suscripciones, módulos, límites y consumo;
- auditoría de operaciones sensibles;
- preparación de vínculos con identidades legacy, sin migrarlas todavía;
- aislamiento entre empresas mediante RLS.

## Fuera de alcance

- `deliveries` y `entregas`;
- gestión operativa de transportes;
- OCR y la función `leer-albaran`;
- Storage y el bucket `pod`;
- facturación operativa;
- fichajes;
- vacaciones;
- migración o copia de contraseñas legacy;
- aplicación de migraciones remotas;
- despliegue en producción.

## Identidad y roles

`profiles` describe a la persona y no contiene `role` ni `organization_id`.

Los roles definitivos de la primera versión son:

- `superadmin`: rol de plataforma, almacenado separadamente;
- `admin_empresa`: rol de una membresía empresarial;
- `conductor`: rol de una membresía empresarial.

El único superadmin no tiene `organization_membership`. Los usuarios
empresariales pertenecen como máximo a una organización. Esta limitación se
implementará como una restricción sobre la membresía, no dentro del perfil, para
que pueda retirarse en el futuro sin rediseñar la identidad.

## Estados de acceso

Para que un usuario empresarial pueda operar deben cumplirse simultáneamente:

1. sesión válida de Supabase Auth;
2. perfil activo;
3. membresía activa;
4. organización activa;
5. módulo efectivo activo cuando la funcionalidad sea modular;
6. límite duro disponible cuando la operación consuma una cuota.

El superadmin requiere sesión válida, perfil activo y registro de plataforma
activo. No hereda permisos empresariales por pertenencia.

## Organizaciones, suscripciones y pago

La organización y la relación comercial son conceptos separados:

- `organizations.status` controla el acceso operativo;
- la suscripción indica plan, periodo y vencimiento;
- `payment_status` indica la situación de pago;
- un impago no borra información;
- bloquear, suspender o archivar conserva todos los datos.

Estados de organización:

- `pending`;
- `active`;
- `maintenance`;
- `blocked`;
- `suspended`;
- `archived`.

## Planes iniciales

### Starter

- 1 administrador;
- 5 conductores;
- transportes;
- clientes;
- vehículos;
- POD y firma;
- albaranes electrónicos;
- dashboard básico;
- sin OCR, facturación, fichajes, vacaciones ni API.

### Profesional

- 5 administradores;
- 25 conductores;
- todo Starter;
- OCR;
- facturación;
- fichajes;
- vacaciones;
- exportaciones;
- informes;
- auditoría de empresa;
- soporte prioritario.

### Enterprise

- límites numéricos altos, todos configurables desde superadministración;
- todos los módulos;
- API;
- capacidad futura para integraciones, IA avanzada, automatizaciones y
  personalización;
- soporte prioritario.

### Personalizado

Los módulos y límites se resuelven mediante configuración manual del
superadmin.

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

La disponibilidad efectiva se resuelve así:

`módulo del plan + override de empresa = módulo efectivo`

Prioridad:

1. override `enabled` o `disabled`;
2. valor heredado del plan;
3. si el plan no declara el módulo, queda desactivado.

Desactivar un módulo no elimina ni transforma datos. Debe ocultarlo del menú y
bloquear ruta, API, Edge Function y acceso RLS. Reactivarlo recupera el acceso a
los datos históricos.

`audit_access` permitirá en una fase posterior que `admin_empresa` consulte la
auditoría autorizada de su propia organización. No se reutiliza `reports` ni
`support_access` para esa capacidad. El superadmin conserva acceso a la
auditoría de plataforma y empresas con independencia de este módulo.

## Límites iniciales

- `max_admins`;
- `max_drivers`;
- `max_documents_total`;
- `max_documents_monthly`;
- `max_ocr_monthly`;
- `max_storage_bytes`;
- `max_exports_monthly`.

La resolución efectiva es:

`límite del plan + override de empresa = límite efectivo`

Todos los límites son valores numéricos configurables. Enterprise no utiliza un
estado especial de ilimitado: recibe valores altos por defecto que el
superadmin puede sobrescribir de la misma forma que en cualquier otro plan.
Cero significa que no se permite consumo.

## Operaciones sensibles

Pasan por Edge Functions y generan auditoría:

- crear o modificar organizaciones;
- cambiar el estado de una organización;
- cambiar plan, pago o vencimiento;
- invitar, bloquear o revocar administradores;
- cambiar módulos y límites;
- crear o confirmar vínculos legacy.

El frontend nunca contiene `service_role`.

## Compatibilidad temporal

Hasta adaptar Auth y los guards, los contratos antiguos de la primera maqueta
se conservan marcados como obsoletos para no romper el build entre bloques.
No forman parte del modelo definitivo ni de la futura tabla `profiles`.

## Criterio de seguridad

Los guards de React mejoran la experiencia, pero no autorizan operaciones. La
autorización efectiva se aplica en RLS y en las Edge Functions. Todas las
pruebas de aislamiento deben incluir dos organizaciones, acceso cruzado,
usuarios bloqueados, empresas suspendidas y módulos activos e inactivos.
