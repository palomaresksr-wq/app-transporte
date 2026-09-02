# Operaciones del portal cliente

## Rutas

El portal independiente vive bajo `/client`: dashboard, transportes, detalle, documentos, facturas y perfil. El cambio inicial de contraseña reutiliza `/change-password`; nunca ejecuta onboarding empresarial.

La administración abre `/empresa/clientes/:customerId/accesos`. Permite alta directa, bloqueo y reactivación. Las contraseñas iniciales no se guardan en tablas, logs ni auditoría.

## Operación segura

- Mantener privado el bucket documental existente.
- Servir descargas exclusivamente mediante `client-portal` y expiración corta.
- Activar `client_portal` por plan u override; desactivarlo corta el acceso sin borrar histórico.
- Investigar accesos mediante eventos de alta, bloqueo, reactivación y reset; no auditar cada render.
- Bloquear primero la membership ante una baja urgente. RLS pierde acceso inmediatamente.

## Validación local

Usar dos clientes de una misma empresa y, adicionalmente, otro tenant. Probar IDs cruzados de transporte, documento, factura y documento reglamentario. La respuesta externa debe ser 404 o denegación genérica.
