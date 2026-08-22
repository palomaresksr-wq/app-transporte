# Onboarding empresarial

El onboarding comienza después del cambio obligatorio de contraseña. Su orden es: datos de empresa, configuración operativa, primer vehículo, primer conductor, primer cliente, POD/documentos y facturación opcional.

El progreso reside en `organization_onboarding`, protegido por RLS y limitado al administrador de la organización. Los pasos no esenciales pueden saltarse. Al finalizar se registra `completed_at` y no vuelve a mostrarse automáticamente.

Vehículos, clientes y ubicaciones reutilizan Datos Maestros de Fase A. POD/documentos reutilizan Fases D/J, y facturación reutiliza G/H; no se duplican modelos. Planes, módulos y límites se administran desde las pantallas de Superadmin existentes. El administrador empresarial sólo consulta sus capacidades efectivas.
