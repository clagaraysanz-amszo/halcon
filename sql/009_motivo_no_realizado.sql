-- Agrega campo para justificar vuelos no realizados.
-- El operador puede marcar un vuelo como "No realizado" e indicar el motivo.
alter table public.pdo_dia
  add column if not exists motivo text;
