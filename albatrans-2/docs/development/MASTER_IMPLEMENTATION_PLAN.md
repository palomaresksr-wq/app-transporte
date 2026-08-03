# Plan maestro de implementación

## Método de ejecución

Cada fase se desarrolla en una rama propia desde un checkpoint limpio. Se aprueba alcance, migración y criterios antes de comenzar; después el equipo implementa autónomamente todo el bloque. Los errores menores de TypeScript, lint o tests se corrigen y se repite la suite sin detener el bloque. Solo se detiene ante una decisión de producto, incompatibilidad real, cambio legal no resuelto o riesgo de producción. Se entrega un único informe al completar la fase.

Orden común: checkpoint → contratos → dominio → migración → RLS → repositorios/Edge → UI → pruebas → integración → documentación → informe → aprobación. Ninguna fase modifica una migración aplicada.

## Fase A — Datos maestros

- **Objetivo:** establecer identidades y activos operativos canónicos antes de crear transportes.
- **Alcance:** entidad `drivers`, clientes y contactos, ubicaciones, vehículos, remolques y asignaciones básicas. Separar persona operativa de cuenta Auth.
- **Tablas:** `drivers`, `customers`, `customer_contacts`, `locations`, `vehicles`, `trailers`, `driver_vehicle_assignments`; referencias a `organizations` y opcionalmente a memberships.
- **Contratos:** altas, edición, estados, búsquedas paginadas, identificadores internos y asignaciones con vigencia.
- **Dominio:** unicidad por organización, matrículas normalizadas, solapamientos de asignación, archivado y dependencia de cuentas.
- **Pantallas:** catálogos CRUD responsive, fichas, filtros, importación futura preparada y selectores reutilizables.
- **Edge Functions:** comandos de alta/edición/archivo y asignación; Auth permanece separado.
- **RLS:** tenant estricto; superadmin global; administradores de empresa según módulos; conductor solo su ficha permitida.
- **Migraciones:** nuevas tablas, índices, constraints, triggers y políticas; backfill opcional desde memberships sin tocar legacy.
- **Pruebas:** dominio, CRUD, duplicados, RLS cruzada, archivos, asignaciones y paginación.
- **Dependencias:** núcleo actual estable y decisión de campos operativos del conductor.
- **Riesgos:** mezclar Auth con driver, duplicados legacy, datos fiscales/personales y asignaciones solapadas.
- **Aceptación:** catálogos completos, aislamiento probado, cero escrituras legacy y conductor operativo enlazable opcionalmente a Auth.
- **Rollback:** deshabilitar rutas y revertir consumidores; conservar tablas nuevas hasta exportar datos, sin borrar automáticamente.
- **Orden:** drivers → clientes/contactos → ubicaciones → vehículos/remolques → asignaciones.

## Fase B — Transporte canónico

- **Objetivo:** representar cualquier servicio de transporte con un modelo único y trazable.
- **Alcance:** órdenes, paradas, mercancías, asignaciones, estados, incidencias e historial de eventos.
- **Tablas:** `transport_orders`, `transport_stops`, `transport_items`, `transport_assignments`, `transport_incidents`, `transport_events`.
- **Contratos:** comandos de ciclo de vida, secuenciación de paradas, carga y asignación.
- **Dominio:** máquina de estados, coherencia temporal, pesos/cantidades, roles y transiciones idempotentes.
- **Pantallas:** tablero, listado, ficha, planificación inicial, timeline e incidencias.
- **Edge Functions:** crear/editar/asignar/transicionar/cancelar, siempre con auditoría.
- **RLS:** empresa ve su operación; conductor solo asignaciones propias; cliente todavía sin acceso.
- **Migraciones:** modelo canónico, índices por organización/estado/fecha y claves de idempotencia.
- **Pruebas:** matriz completa de estados, concurrencia, RLS, aislamiento y auditoría.
- **Dependencias:** Fase A completa.
- **Riesgos:** modelar según legacy, carreras de asignación y estados irreversibles incorrectos.
- **Aceptación:** servicio completo expresable sin tablas legacy y timeline inmutable.
- **Rollback:** congelar nuevos comandos y exportar órdenes; no eliminar historial.
- **Orden:** orden → paradas/items → asignaciones → estados/eventos → incidencias.

## Fase C — Portal del conductor

- **Objetivo:** ejecutar servicios asignados desde móvil incluso con conectividad deficiente.
- **Alcance:** lista de servicios, estados, cámara, POD, firma, geolocalización y cola offline.
- **Tablas:** `driver_action_queue`, `proofs_of_delivery`, `signatures`, `location_events` y referencias a transportes.
- **Contratos:** comandos idempotentes con timestamps cliente/servidor y conflictos explícitos.
- **Dominio:** autorización por asignación, orden de eventos, consentimiento y retención de ubicación.
- **Pantallas:** agenda, detalle, parada, captura, firma, incidencias y sincronización.
- **Edge Functions:** sincronización por lotes, subida firmada y confirmación de eventos.
- **RLS:** conductor solo sus servicios; Storage privado por organización/asignación.
- **Migraciones:** colas/eventos, políticas Storage y claves idempotentes.
- **Pruebas:** móvil, offline/reintento, duplicados, permisos, accesibilidad táctil y pérdida de sesión.
- **Dependencias:** Fase B y decisión de Storage.
- **Riesgos:** conflictos offline, geolocalización sensible, archivos incompletos y batería.
- **Aceptación:** flujo completo reproducible offline con sincronización segura.
- **Rollback:** desactivar captura nueva y conservar cola/eventos para reconciliación.
- **Orden:** lectura → estados → offline → cámara/POD → firma → geolocalización.

## Fase D — Documentación y OCR

- **Objetivo:** centralizar documentos privados y extraer información con revisión humana.
- **Alcance:** `documents`, Storage privado, OCR, revisión, migración progresiva de bucket POD y adaptación de `leer-albaran`.
- **Tablas:** `documents`, `document_versions`, `ocr_jobs`, `ocr_results`, `document_reviews`, `storage_migrations`.
- **Contratos:** subida, clasificación, extracción versionada, revisión y aceptación.
- **Dominio:** checksum, estados de procesamiento, confianza, retención y vinculación polimórfica controlada.
- **Pantallas:** bandeja documental, visor, comparación OCR y revisión.
- **Edge Functions:** URLs firmadas, jobs OCR, callbacks autenticados y migración por lotes.
- **RLS:** metadatos y objetos aislados por tenant; workers con privilegio mínimo.
- **Migraciones:** tablas, buckets/policies y seguimiento de migración sin mover todavía producción.
- **Pruebas:** formatos, malware/size gates, OCR fallido, RLS Storage, reintentos y checksums.
- **Dependencias:** Fases B/C; proveedor OCR pendiente.
- **Riesgos:** PII, coste, archivos maliciosos, OCR incorrecto y compatibilidad POD.
- **Aceptación:** documento privado trazable, OCR revisable y migración reanudable.
- **Rollback:** parar workers y volver a lectura del origen; conservar mapa de migración.
- **Orden:** documentos/Storage → versiones → jobs → revisión → POD → leer-albaran.

## Fase E — Administración de empresa

- **Objetivo:** ofrecer al administrador empresarial una consola operativa integral.
- **Alcance:** planificación, operaciones, clientes, vehículos, conductores, documentos y exportaciones.
- **Tablas:** usa A–D; añade preferencias, vistas guardadas y export jobs si procede.
- **Contratos:** consultas agregadas, filtros, exportaciones y acciones masivas acotadas.
- **Dominio:** permisos empresariales, módulos efectivos, límites y segregación de funciones.
- **Pantallas:** dashboard, planificación, catálogos, operaciones, documentos y exportaciones.
- **Edge Functions:** agregados, export jobs y acciones masivas auditadas.
- **RLS:** admin de empresa dentro de su tenant y módulos; sin facultades de plataforma.
- **Migraciones:** solo preferencias/jobs necesarios.
- **Pruebas:** navegación por módulos, límites, aislamiento, grandes volúmenes y responsive.
- **Dependencias:** A–D.
- **Riesgos:** consultas pesadas, autorización basada solo en UI y UX saturada.
- **Aceptación:** operación diaria sin Superadmin y sin exposición cruzada.
- **Rollback:** feature flags por módulo; conservar datos y accesos básicos.
- **Orden:** shell/contexto → dashboard → planificación → catálogos → docs → exportaciones.

## Fase F — Cumplimiento documental

- **Objetivo:** generar y custodiar documentos legales verificables.
- **Alcance:** DeCA, eCMR, firma electrónica, sellado temporal, integridad, trazabilidad y formatos versionados.
- **Tablas:** `legal_documents`, `legal_document_versions`, `signature_evidence`, `timestamp_evidence`, `compliance_validations`.
- **Contratos:** esquemas versionados y resultados de validación.
- **Dominio:** requisitos oficiales vigentes, inmutabilidad, hash, firmantes y evidencias.
- **Pantallas:** asistentes, validación, firma, custodia y exportación.
- **Edge Functions:** generación, firma, sellado, validación y entrega.
- **RLS:** acceso mínimo por parte y organización; evidencias inmutables.
- **Migraciones:** modelos versionados después de revisión legal oficial.
- **Pruebas:** fixtures oficiales, firmas inválidas, integridad, reloj y conservación.
- **Dependencias:** B–D y dictamen legal actualizado.
- **Riesgos:** normativa cambiante, afirmaciones de homologación y validez transfronteriza.
- **Aceptación:** conformidad demostrada con fuente oficial y versión normativa documentada.
- **Rollback:** desactivar emisión de versión afectada; conservar evidencias y permitir exportación.
- **Orden:** investigación oficial → modelo versionado → validación → DeCA → eCMR → firma/sellado.

## Fase G — Facturación

- **Objetivo:** transformar servicios en documentos económicos trazables.
- **Alcance:** tarifas, series, facturas, líneas, impuestos, PDF, factura electrónica, pagos y rectificaciones.
- **Tablas:** `rates`, `invoice_series`, `invoices`, `invoice_lines`, `taxes`, `payments`, `credit_notes`.
- **Contratos:** borrador, emisión inmutable, rectificación, cobro y exportación electrónica.
- **Dominio:** numeración, redondeo, impuestos, moneda, vencimiento y cierre.
- **Pantallas:** tarifas, facturación, cobros, PDF y rectificaciones.
- **Edge Functions:** cálculo, emisión transaccional, PDF, factura electrónica y conciliación futura.
- **RLS:** finanzas del tenant; permisos específicos futuros.
- **Migraciones:** secuencias seguras, importes decimales e índices fiscales.
- **Pruebas:** cálculos, concurrencia de serie, impuestos, rectificaciones y formatos oficiales.
- **Dependencias:** B/E y verificación legal de factura electrónica.
- **Riesgos:** errores monetarios, duplicidad de números y cambios fiscales.
- **Aceptación:** factura reproducible, inmutable tras emisión y rectificable legalmente.
- **Rollback:** detener emisión, conservar borradores y nunca borrar facturas emitidas.
- **Orden:** tarifas/impuestos → series → borradores → emisión/PDF → electrónica → pagos.

## Fase H — Personal

- **Objetivo:** gestionar tiempo y expedientes laborales sin mezclar identidad Auth.
- **Alcance:** fichajes, vacaciones, ausencias, turnos y expedientes.
- **Tablas:** `employees`, `time_entries`, `leave_requests`, `absences`, `shifts`, `employee_documents`.
- **Contratos:** fichaje idempotente, solicitudes, aprobaciones y calendarios.
- **Dominio:** husos horarios, solapamientos, correcciones, aprobación y retención.
- **Pantallas:** reloj, calendario, solicitudes, aprobaciones y expediente.
- **Edge Functions:** fichar, corregir, aprobar y exportar.
- **RLS:** empleado propio; responsables del tenant; datos especialmente protegidos.
- **Migraciones:** modelo laboral separado de drivers y memberships.
- **Pruebas:** DST, offline, duplicados, RLS y flujos de aprobación.
- **Dependencias:** A/E y revisión laboral/privacidad oficial.
- **Riesgos:** normativa laboral, geolocalización y datos sensibles.
- **Aceptación:** registro íntegro, corregible con trazabilidad y exportable.
- **Rollback:** captura manual controlada y exportación de registros existentes.
- **Orden:** employees → turnos → fichajes → ausencias/vacaciones → expedientes.

## Fase I — Portal del cliente

- **Objetivo:** dar visibilidad segura al cliente sobre su actividad.
- **Alcance:** servicios, seguimiento, POD, documentos, facturas e incidencias.
- **Tablas:** `customer_users`, `customer_access_grants`, preferencias/notificaciones.
- **Contratos:** acceso limitado por cliente y permisos concedidos.
- **Dominio:** relación usuario-cliente, revocación y visibilidad documental.
- **Pantallas:** dashboard, seguimiento, documentos, facturas e incidencias.
- **Edge Functions:** invitaciones, grants, descargas firmadas y comunicaciones.
- **RLS:** organización + customer scope; nunca solo organization scope.
- **Migraciones:** grants e identidad de portal.
- **Pruebas:** cliente cruzado, revocación, enlaces y documentos.
- **Dependencias:** B, D, G.
- **Riesgos:** exposición entre clientes y enlaces compartidos.
- **Aceptación:** cada cliente ve solo sus datos y evidencias autorizadas.
- **Rollback:** revocar grants y mantener operación empresarial.
- **Orden:** identidad/grants → servicios → documentos/POD → facturas → incidencias.

## Fase J — Business Intelligence

- **Objetivo:** convertir datos operativos y económicos en decisiones.
- **Alcance:** KPIs, rentabilidad, productividad, costes y análisis por clientes, vehículos, conductores, OCR y facturación.
- **Tablas:** vistas/materializadas, `metric_snapshots`, `report_definitions`, `report_runs`.
- **Contratos:** métricas versionadas, dimensiones, filtros y exportación.
- **Dominio:** definición única de KPI, periodos, moneda y calidad de datos.
- **Pantallas:** cuadros, comparativas, drill-down e informes.
- **Edge Functions:** agregación pesada y export jobs.
- **RLS:** agregados siempre tenant-scoped; prevenir inferencia entre tenants.
- **Migraciones:** vistas e índices; posible almacén analítico posterior.
- **Pruebas:** exactitud, zonas horarias, rendimiento e aislamiento.
- **Dependencias:** datos suficientes de B, D, G y H.
- **Riesgos:** KPIs ambiguos, consultas caras y datos incompletos.
- **Aceptación:** métricas reconciliables con datos fuente y tiempos acordados.
- **Rollback:** desactivar vistas/reportes sin afectar transacciones.
- **Orden:** diccionario KPI → snapshots → dashboards → drill-down → exportación.

## Fase K — Inteligencia Artificial

- **Objetivo:** asistir sin sustituir control humano ni trazabilidad.
- **Alcance:** asistente administrativo, OCR avanzado, errores, incidencias, planificación, atención, IA comercial y rentabilidad.
- **Tablas:** `ai_jobs`, `ai_artifacts`, `ai_feedback`, `prompt_versions`, `ai_approvals`.
- **Contratos:** entradas mínimas, salidas estructuradas, confianza, fuentes y aprobación.
- **Dominio:** políticas de uso, PII, retención, costes y acciones permitidas.
- **Pantallas:** asistentes contextuales, revisión, feedback y actividad.
- **Edge Functions:** gateway de proveedores, redacción, cuotas y auditoría.
- **RLS:** aislamiento completo y acceso explícito por módulo.
- **Migraciones:** jobs, artefactos, versiones y consentimiento.
- **Pruebas:** evaluaciones, prompt injection, fuga tenant, alucinación, coste y fallback.
- **Dependencias:** datos maduros, gobernanza y proveedores aprobados.
- **Riesgos:** privacidad, alucinaciones, lock-in, coste y decisiones ilegales.
- **Aceptación:** ninguna acción crítica autónoma; resultados evaluados, citables y auditados.
- **Rollback:** kill switch por capacidad/proveedor y procesos manuales disponibles.
- **Orden:** gobernanza → gateway → OCR/error → administrativo → incidencias/planificación → comercial/BI.

## Fase L — Comercialización

- **Objetivo:** convertir la plataforma en servicio operable y vendible.
- **Alcance:** onboarding, demo, prueba gratuita, pagos, suscripciones automáticas, landing, soporte y documentación comercial.
- **Tablas:** `onboarding_runs`, `trials`, `billing_accounts`, `payment_provider_events`, `support_cases`.
- **Contratos:** onboarding, checkout, webhook idempotente, trial y soporte.
- **Dominio:** elegibilidad, conversión, impagos, cancelación y retención.
- **Pantallas:** onboarding, demo, billing, landing, ayuda y soporte.
- **Edge Functions:** provisioning, webhooks firmados, lifecycle y notificaciones.
- **RLS:** cuenta comercial separada del dato operativo; soporte con acceso auditado.
- **Migraciones:** lifecycle comercial y eventos externos.
- **Pruebas:** webhooks repetidos, impagos, cancelación, trial, demo y recuperación.
- **Dependencias:** producto estable, pricing validado, legal y proveedor de pago.
- **Riesgos:** promesas comerciales no validadas, fraude, PCI y soporte insuficiente.
- **Aceptación:** onboarding reproducible, cobro conciliable, baja segura y comunicación veraz.
- **Rollback:** pausar altas/cobros, mantener acceso contratado y conciliación manual.
- **Orden:** propuesta/precios → onboarding/demo → trial → pagos → automatización → landing/soporte.

## Checkpoint previo recomendado

Antes de Fase A: versionar correctamente el proyecto; impedir secretos Git; actualizar dependencias vulnerables; dejar lint verde; ejecutar SQL en una base efímera; añadir typecheck/lint de Edge Functions y fijar una estrategia de transacciones y reservas de cuota. Este checkpoint no amplía producto: reduce riesgo para todas las fases posteriores.
