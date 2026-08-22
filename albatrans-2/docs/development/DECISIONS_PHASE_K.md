# Decisiones de Fase K

## Identidad empresarial

La identidad se crea exclusivamente en `user-management`, mediante Auth Admin y con el correo confirmado administrativamente. El navegador nunca recibe la clave `service_role`. Los roles ordinarios admitidos son `admin_empresa` y `conductor`; crear privilegios de plataforma queda fuera de este flujo.

La contraseña inicial se valida en cliente y backend, se entrega a Auth y no se persiste, audita, registra ni devuelve. Por defecto el usuario debe cambiarla. Mientras `must_change_password` sea verdadero, el guard de rutas sólo permite `/change-password`.

## Coherencia Auth/PostgreSQL

La creación usa una saga: PostgreSQL reserva un comando idempotente y una plaza del plan; después se crea Auth; finalmente una función transaccional crea perfil, membership, ciclo de vida, conductor cuando corresponda y auditoría. Un fallo final intenta borrar la identidad Auth. Si la compensación falla, el comando queda como `reconciliation_required`, nunca como usuario empresarial activo silencioso.

La clave idempotente se vincula a organización y a un hash del payload que incluye un digest irreversible de la contraseña. La contraseña no queda recuperable. Una misma clave y payload devuelve el resultado; la misma clave con contenido distinto produce conflicto.

## Límites y concurrencia

La reserva usa un advisory lock transaccional por organización y rol. El uso incluye memberships existentes y comandos preparados, evitando superar `max_drivers` o `max_admins` cuando quedan pocas plazas.

## Onboarding

El primer administrador inicializa un estado persistente por organización. Los pasos se pueden reanudar; los no esenciales pueden omitirse. Las organizaciones históricas sin estado no son forzadas a repetir onboarding.
