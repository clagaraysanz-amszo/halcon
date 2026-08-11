-- Permite el estado 'No realizado' en pdo_dia.
--
-- La migración 009 agregó la columna motivo para justificar vuelos no
-- realizados, pero olvidó actualizar el CHECK constraint de estado, que
-- seguía permitiendo solo 'Pendiente' y 'Realizado'. Al intentar marcar un
-- vuelo como No realizado desde la app del funcionario, Postgres rechazaba
-- la actualización con:
--   Error: new row for relation "pdo_dia" violates check constraint
--   "pdo_dia_estado_check"
--
-- Esta migración recrea el constraint incluyendo 'No realizado'.

alter table public.pdo_dia drop constraint if exists pdo_dia_estado_check;

alter table public.pdo_dia
  add constraint pdo_dia_estado_check
  check (estado in ('Pendiente', 'Realizado', 'No realizado'));
