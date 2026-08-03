# Identificador interno de conductor pendiente

La gestión inicial de conductores no almacena `employee_number`, `internal_reference` ni equivalentes.
Estos datos no pertenecen a Supabase Auth, `profiles`, `organization_memberships` ni `legacy_identity_links`.

Cuando se diseñe la entidad operativa definitiva `drivers`, se decidirá en ese dominio si incorpora
`employee_number`, `internal_reference` u otro identificador empresarial interno.
