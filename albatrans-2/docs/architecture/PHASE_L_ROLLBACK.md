# Rollback Fase L

El rollback funcional recomendado es desactivar el módulo `client_portal` mediante override. Esto corta rutas, Edge y RLS sin perder identidades ni histórico.

No eliminar tablas mientras existan memberships, comandos o auditoría. Si fuera imprescindible retirar el esquema en un entorno no productivo: exportar auditoría, revocar accesos Auth, retirar primero policies nuevas sobre entidades compartidas, luego tablas `client_portal_*`, funciones `phase_l_*`/`client_portal_*`, columna de visibilidad y finalmente el módulo. Los documentos, transportes, facturas y clientes originales no se eliminan.

Producción requiere una migración forward-only revisada; nunca editar ni borrar las migraciones de Fase L aplicadas.
