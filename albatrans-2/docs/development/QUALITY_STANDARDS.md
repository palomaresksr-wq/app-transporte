# Estándares de calidad

## Código

- TypeScript estricto; prohibidos `any`, `@ts-ignore`, `@ts-expect-error` y casts amplios.
- Validar `unknown` en fronteras externas.
- Usar tipos `Database` generados y tipos `Insert/Update` en fixtures.
- Dominio puro, repositorios explícitos y UI sin acceso privilegiado.
- Sin contraseñas, tokens, claves o PII innecesaria en logs y auditoría.
- Sin código muerto, imports no usados ni warnings de lint.

## Seguridad

- JWT y autorización se revalidan en cada Edge Function.
- RLS forzada y pruebas de tenant para toda tabla.
- Principio de mínimo privilegio; `service_role` solo en backend.
- Payloads exactos, límites de longitud y errores estructurados.
- Dependencias auditadas y vulnerabilidades altas/críticas resueltas antes de release.
- `.env`, `.temp`, logs y artefactos locales excluidos de Git.
- Normativa validada en fuentes oficiales antes de implementar requisitos legales.

## Datos y operaciones

- Sin borrado físico cuando exista historial o dependencia.
- Toda acción sensible auditable.
- Cambios multi-recurso atómicos o con estrategia de compensación probada y observable.
- Migraciones inmutables una vez aplicadas.
- Fixtures prefijados, idempotentes y eliminados incluso tras fallos.
- Ninguna prueba local puede depender del orden o de una base vacía salvo que se ejecute en una base efímera.

## UI

- Estados de carga, vacío, error, éxito y ausencia de resultados.
- HTML semántico, labels accesibles, navegación por teclado y foco visible.
- Diálogos con foco inicial, focus trap, Escape y devolución de foco.
- Contraste WCAG AA y pruebas en 320, 768, 1024 y 1440 píxeles.
- Tablas con alternativa responsive legible.
- No usar índices frágiles ni clases CSS como selectores de tests.

## Rendimiento

- Paginación y consultas selectivas; no cargar filas innecesarias.
- `count: exact` y `head: true` cuando solo se cuenta.
- Evitar N+1; si Auth obliga a consultas individuales, medir y paginar.
- Presupuesto inicial: JS gzip inferior a 150 kB, interacción principal sin bloqueos visibles y consultas indexadas verificadas con `EXPLAIN` antes de producción.

## Pruebas mínimas

- Dominio: reglas y matrices de transición.
- UI: comportamiento y accesibilidad semántica.
- Repositorio: mapping, errores y respuestas inválidas.
- Edge: auth, payload, autorización, rollback y auditoría.
- SQL: esquema, constraints, RLS y aislamiento.
- Integración local: camino feliz y fallos críticos con limpieza.
- Regresión completa, TypeScript, ESLint y build.

