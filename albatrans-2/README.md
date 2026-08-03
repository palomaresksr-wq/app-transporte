# Albatrans 2.0

Plataforma SaaS multiempresa desarrollada en paralelo a Albatrans Legacy.

## Fase actual

La Fase 1 establece:

- React, TypeScript y Vite en monorepo npm;
- Supabase Auth;
- perfiles personales sin rol ni empresa;
- organizaciones y membresías;
- roles `superadmin`, `admin_empresa` y `conductor`;
- planes, suscripciones, pago y vencimiento;
- módulos y límites configurables por empresa;
- auditoría;
- RLS y pruebas de aislamiento;
- preparación de vínculos con usuarios legacy.

El superadmin es un rol de plataforma independiente y no pertenece a ninguna
empresa.

Enterprise usa límites numéricos altos y configurables; no existe un caso
especial de límites ilimitados. El catálogo inicial incluye también el módulo
`support_access`. La auditoría empresarial dispone de un entitlement separado:
`audit_access`.

## Fuera de alcance

La Fase 1 no migra ni modifica:

- `deliveries`;
- `entregas`;
- OCR;
- Storage;
- facturación;
- fichajes;
- vacaciones;
- contraseñas legacy.

No se ejecutan migraciones de producción durante el desarrollo de esta fase.

## Configuración local

1. Copiar `.env.example` a `.env.local`.
2. Completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Ejecutar `npm install`.
4. Ejecutar `npm run dev`.

Sin variables de entorno, la aplicación falla de forma segura y muestra que
Supabase está pendiente de configurar.

## Seguridad

- Las contraseñas pertenecen exclusivamente a Supabase Auth.
- `profiles` no contiene rol ni organización.
- Las operaciones sensibles pasan por Edge Functions.
- `service_role` nunca se incluye en React.
- Ocultar una ruta o un módulo en React no sustituye RLS.
- Desactivar una empresa o un módulo conserva sus datos.

El diseño detallado se encuentra en
`docs/architecture/phase-1.md`.
