# Roadmap maestro

## Estado actual

El núcleo de plataforma está funcional: autenticación, autorización, multiempresa, Superadmin, empresas, estados, suscripciones, planes, módulos, límites, administradores, conductores de acceso y auditoría. La entidad de conductor actual es una identidad de acceso; todavía no es la entidad operativa definitiva.

## Secuencia futura

1. **Fase A — Datos maestros.** Drivers operativos, clientes, contactos, ubicaciones, vehículos, remolques y asignaciones básicas.
2. **Fase B — Transporte canónico.** Órdenes, paradas, mercancías, asignaciones, estados, incidencias e historial.
3. **Fase C — Portal del conductor.** Servicios, estados, cámara, POD, firma, geolocalización y tolerancia a desconexión.
4. **Fase D — Documentación y OCR.** Documentos privados, OCR, revisión humana y transición del bucket POD.
5. **Fase E — Administración empresarial.** Planificación y operación integral desde empresa.
6. **Fase F — Cumplimiento documental.** DeCA, eCMR, firma, sellado temporal e integridad.
7. **Fase G — Facturación.** Tarifas, impuestos, facturas, PDF, factura electrónica, pagos y rectificaciones.
8. **Fase H — Personal.** Fichajes, vacaciones, ausencias, turnos y expedientes.
9. **Fase I — Portal del cliente.** Seguimiento, POD, documentos, facturas e incidencias.
10. **Fase J — Business Intelligence.** KPIs, costes, rentabilidad y productividad.
11. **Fase K — Inteligencia Artificial.** Asistentes y automatizaciones gobernadas.
12. **Fase L — Comercialización.** Onboarding, demo, pruebas, pagos, landing y soporte.

## Puertas de calidad

Cada fase requiere checkpoint inicial, rama propia, migración reversible, contratos antes de UI, RLS y pruebas de aislamiento, integración local, auditoría, revisión de accesibilidad, actualización documental y aprobación antes de pasar a la siguiente.

## Próximo bloque recomendado

Comenzar por la Fase A como un bloque grande pero controlado. Orden interno recomendado: modelo `drivers`, clientes/contactos, ubicaciones, vehículos/remolques y finalmente asignaciones. Este orden elimina la ambigüedad actual entre identidad Auth y persona/activo operativo, y proporciona referencias estables para el transporte canónico.

