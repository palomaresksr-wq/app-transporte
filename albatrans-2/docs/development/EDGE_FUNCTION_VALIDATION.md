# Validación estática de Edge Functions

Las Edge Functions se validan con Deno 2.1.4, la misma versión declarada por el
Edge Runtime local actual. La comprobación no despliega funciones ni conecta con
un proyecto remoto.

## Local

Requisitos: Docker Desktop activo. Desde la raíz del proyecto:

```text
npm run edge:check
```

El comando ejecuta, en este orden:

1. `deno fmt --check` sobre `supabase/functions`.
2. `deno lint` con las reglas recomendadas.
3. `deno check --no-lock` sobre cada `index.ts`, incluidos imports remotos y npm.

La imagen de Deno queda fijada a `denoland/deno:2.1.4`; un cambio de versión debe
ser explícito y validarse contra la versión del Supabase Edge Runtime adoptada.

## CI

El job debe disponer de Docker y ejecutar `npm ci` seguido de
`npm run edge:check`. El proceso termina con código distinto de cero ante formato,
lint, import o typecheck inválido. No necesita secretos, Supabase remoto ni
variables de producción.
