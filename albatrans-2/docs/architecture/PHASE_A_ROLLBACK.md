# Rollback operativo de Fase A

La migración es aditiva y no se revierte automáticamente en producción. Antes de
habilitar tráfico, el rollback consiste en retirar rutas y funciones Edge de
Datos Maestros. Si no existen datos productivos, una migración posterior puede
eliminar, en orden, policies, tablas (`driver_vehicle_assignments`, `trailers`,
`vehicles`, `locations`, `client_contacts`, `clients`, `drivers`), funciones y
tipos. Con datos existentes se conserva el esquema y se deshabilita el acceso;
nunca se ejecuta `DROP` sin exportación, aprobación y ventana específicas.
