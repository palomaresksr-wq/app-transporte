# Operación de usuarios empresariales

## Alta directa

Desde `Empresas → Empresa → Usuarios` o `Administración → Usuarios`, introducir nombre, apellidos, email, teléfono opcional, rol y contraseña inicial. No se envía ni espera correo. El usuario puede iniciar sesión inmediatamente. La contraseña debe tener al menos 12 caracteres, mayúscula, minúscula, número y símbolo.

El administrador empresarial queda fijado a su propia organización en backend, aunque se manipule la petición. Un conductor no puede invocar la función. El límite del plan se valida en backend.

## Ciclo de vida

- **Bloquear**: bloquea Auth, perfil y membership; el siguiente acceso o comando queda rechazado.
- **Reactivar**: restaura Auth, perfil, membership y conductor, si corresponde.
- **Dar de baja**: revoca el acceso y desactiva el conductor sin borrar histórico.
- **Restablecer contraseña**: establece una temporal con Auth Admin y puede exigir cambio en el siguiente acceso. No envía correo ni registra la contraseña.

## Reconciliación

Revisar `user_management_commands` con estado `reconciliation_required`. El campo `failure_code` sólo contiene un código acotado, nunca secretos. Antes de intervenir, comparar Auth, profile y membership; los estados ambiguos no deben activarse automáticamente.

Las acciones quedan en `audit_events` con actor, organización, entidad y `correlation_id`. Las contraseñas, JWT y claves de servicio están prohibidos en auditoría y logs.
