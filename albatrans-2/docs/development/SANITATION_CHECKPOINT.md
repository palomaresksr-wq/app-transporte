# Checkpoint de saneamiento previo a Fase A

Fecha: 2026-08-04.

## Seguridad local

`supabase/.temp` contiene estado generado por el CLI, configuración de arranque
y credenciales exclusivamente locales. Se conserva porque forma parte del
entorno preparado, pero queda ignorado junto con `.env*` locales, ramas y estado
del CLI, dumps, backups y temporales. Ningún valor secreto se documenta aquí.

Antes de cualquier alta en Git se debe repetir el escaneo de secretos y revisar
el conjunto staged. En este checkpoint `albatrans-2` todavía no tiene archivos
seguidos por el repositorio padre.

## Versionado recomendado

Versionar `albatrans-2` dentro del repositorio padre `app-transporte`, en una
rama propia y como directorio de la nueva aplicación. No crear un repositorio
anidado: fragmentaría el historial, el CI y las revisiones que deben demostrar
que Legacy permanece intacto.

El repositorio padre también contiene entradas no seguidas fuera de
`albatrans-2`; deben revisarse por separado antes de un commit. Este checkpoint
no las modifica ni las incorpora.

## Validación reproducible

- Node: `npm install`, `npm run typecheck`, `npm run lint`, tests y build.
- SQL limpio: `npm run sql:test:ephemeral`.
- Edge Functions: `npm run edge:check`.
- Integración persistente: ejecutar los archivos autocontenidos secuencialmente
  (`--no-file-parallelism --maxWorkers=1`) porque comparten la misma instancia.

Las pruebas de autenticación comparan las métricas aportadas por sus fixtures
contra una línea base tomada antes de crearlos; así validan tanto una instalación
limpia como una instancia persistente sin asumir que esta última está vacía.

## Dependencias

Se actualizaron de forma dirigida Vite, Vitest, React Router y las ramas
transitivas de `brace-expansion`. La auditoría quedó temporalmente limpia, pero
el advisory `GHSA-qwww-vcr4-c8h2`, publicado después, afecta React Router desde
7.12 hasta antes de 8.3.0. El registro npm aún no publica 8.3.0 y rechaza su
instalación con `ETARGET`; bajar a 7.11 reabriría avisos anteriores. Se mantiene
7.18.2 y el riesgo queda explícitamente pendiente hasta que exista una versión
segura publicable. No se usó `npm audit fix --force`.

## Alcance

No se implementaron Datos Maestros ni funcionalidades nuevas. No se modificó la
migración aplicada, no se conectó un proyecto remoto, no se alteró producción y
no se inicializó, confirmó ni publicó ningún repositorio.
