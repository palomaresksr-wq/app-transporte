# Estado actual — 3 de agosto de 2026

## Completado funcionalmente

- Monorepo npm con React, contratos y dominio.
- Supabase Auth local y resolución ordenada de acceso.
- RLS forzada, multiempresa y superadmin singleton.
- Layout, dashboard y métricas de plataforma.
- Creación, listado, detalle y edición general de empresas.
- Estados operativos y archivado lógico.
- Plan, suscripción, pago y vencimiento.
- Módulos y límites efectivos editables.
- Administradores y conductores de acceso mediante Supabase Auth.
- Auditoría de acciones sensibles.

## Verificaciones de cierre

| Control | Resultado |
|---|---|
| TypeScript | Pasa |
| Tests frontend | 39 pasan; 21 integraciones omitidas sin variables |
| Tests de dominio | 46 pasan |
| Build Vite | Pasa; 140 módulos, JS 131.27 kB gzip |
| ESLint | Falla: 8 variables no usadas en tests |
| SQL/RLS sobre instancia preparada | 7 archivos pasan; 2 chocan con singleton; esquema falla 5 supuestos de base vacía |
| Integraciones específicas recientes | Administradores, conductores y límites pasan contra Supabase local |
| Dependencias | 1 crítica y 4 altas según `npm audit` |
| Fixtures funcionales | Sin residuos detectados |
| Git | Todo `albatrans-2` está sin seguimiento desde el repositorio padre |
| Legacy | Sin diferencias tracked detectadas |

## Riesgos prioritarios

1. **Crítico — control de versiones y secretos.** `albatrans-2` está sin seguimiento y `supabase/.temp` no está ignorado; contiene secretos locales.
2. **Crítico — dependencias.** Vitest vulnerable y vulnerabilidades altas en React Router, Vite y `brace-expansion`; existen actualizaciones compatibles.
3. **Alto — SQL no idempotente.** Dos suites intentan crear un segundo superadmin y el test de esquema exige base vacía.
4. **Alto — atomicidad.** Auth + Postgres y auditoría usan compensación best-effort, no una transacción distribuida.
5. **Medio — duplicación.** Administradores y conductores duplican gran parte de Edge, repositorio, UI y pruebas.
6. **Medio — mantenibilidad.** Edge Functions y componentes usan líneas extensas y alta densidad lógica.
7. **Medio — cobertura.** No hay cobertura cuantificada, axe/E2E ni chequeo TypeScript/lint específico para Deno Edge.
8. **Medio — accesibilidad.** Los diálogos carecen de gestión completa de foco y las tablas nuevas reutilizan estilos sin auditoría visual automatizada.
9. **Medio — rendimiento.** Listar administradores/conductores hace una llamada Auth por usuario (N+1) y no pagina.
10. **Bajo — artefactos.** Hay logs locales antiguos; están ignorados, pero deben limpiarse antes del checkpoint.

## Auditoría técnica por área

- **Monorepo:** separación adecuada entre web, contratos y dominio; faltan scripts raíz para SQL, integración completa, cobertura y chequeo Deno.
- **Arquitectura:** las dependencias apuntan correctamente hacia contratos/dominio. La lógica privilegiada está aislada en Edge, aunque sin una capa compartida para guard, auditoría y compensación.
- **Contratos y dominio:** tipado estricto y reglas puras con buena cobertura; algunos contratos de respuesta se validan manualmente de forma repetitiva.
- **React:** guards y pantallas funcionales con estados principales. `OrganizationDetailPage` monta varios managers que realizan cargas independientes, aumentando peticiones y acoplamiento de refresco.
- **Repositorios:** consultas explícitas y tipadas. El listado de empresas está paginado; administradores y conductores no lo están y consultan Auth usuario a usuario.
- **Edge Functions:** revalidan JWT, perfil y singleton de plataforma. Son archivos densos, sin lint/typecheck Deno en la matriz raíz y con compensaciones best-effort.
- **Supabase Auth:** credenciales separadas del perfil; invitación y recuperación seguras. No se copian contraseñas legacy.
- **RLS y multiempresa:** RLS forzada en todas las tablas públicas y cobertura pgTAP amplia. La ejecución sobre la base preparada no es idempotente, por lo que falta una validación limpia reproducible en CI.
- **Auditoría:** eventos limitados y accesibles al superadmin. El rollback depende de llamadas posteriores que podrían fallar sin alerta operacional.
- **Planes, suscripciones, módulos y límites:** resolución coherente plan + override; cero tiene semántica clara; se conserva configuración al cambiar plan. La reserva concurrente de cuota sigue pendiente.
- **Administradores y conductores:** funcionales y auditados; existe duplicación estructural y escalabilidad limitada por N+1 de Auth.
- **Dependencias y borrado:** comprobaciones explícitas antes de eliminar identidades. Solo cubren las tablas existentes; cada futura tabla operativa deberá incorporarse al grafo de dependencias.
- **Código duplicado/muerto:** duplicación alta entre managers y Edge de identidades. ESLint identifica ocho símbolos de test no usados; no se detectaron `TODO`, `FIXME`, `any` productivo ni supresiones TypeScript.
- **Seguridad:** `service_role` no aparece en React. Riesgos abiertos: dependencias vulnerables, `.temp` no ignorado y ausencia de rate limiting/idempotency keys en comandos.
- **Rendimiento:** métricas usan conteos `head`; listado paginado. Faltan mediciones, `EXPLAIN`, caching y paginación de identidades.
- **Errores:** respuestas estructuradas en comandos recientes; las funciones antiguas mezclan todavía cuerpos `{error: string}` y `{error:{code,message}}`.
- **Accesibilidad:** labels, roles, estados y foco CSS básicos presentes. Faltan focus trap/Escape, auditoría axe y prueba completa por teclado/lector.
- **Responsive:** existen breakpoints y tabla responsive de empresas; las tablas de módulos, límites e identidades dependen principalmente de scroll horizontal.
- **Cobertura:** buenas pruebas unitarias/UI y pgTAP, pero sin porcentaje, E2E de navegador, performance, visual regression ni pipeline CI visible.
- **Nombres:** mezcla histórica de ruta `/platform/empresas/nueva` con `/platform/organizations`; conviene unificar en fase de saneamiento sin romper enlaces.

## Decisiones pendientes

- Entidad operativa `drivers` y su identificador empresarial.
- Estrategia transaccional para comandos Auth + Postgres.
- Base efímera para SQL/integración en CI.
- Diseño legal versionado para DeCA, eCMR y factura electrónica.
- Validación comercial del primer año gratuito.

## Recomendación inmediata

Antes de Fase A, realizar un checkpoint de saneamiento no funcional: inicializar/versionar correctamente `albatrans-2`, excluir `.temp`, actualizar dependencias vulnerables, dejar ESLint verde y hacer idempotente la suite SQL en una base efímera. Después iniciar Datos Maestros.
