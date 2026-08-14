-- El PDO a veces asigna al Operador Drone solo una zona de vigilancia
-- general (sin SECTOR/TRAMO numerado), típicamente por restricciones de
-- lluvia que impiden el sobrevuelo programado por tramos puntuales.
-- Se permite tramo_n nulo en pdo_dia para representar esas asignaciones
-- ("está de turno, vigilando zona general, sin sector específico").
alter table public.pdo_dia alter column tramo_n drop not null;
