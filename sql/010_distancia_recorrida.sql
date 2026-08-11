-- Agrega campo de distancia recorrida al registro de vuelos.
alter table public.registro_vuelos
  add column if not exists distancia text;
