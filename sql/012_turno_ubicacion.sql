-- Turno seleccionado manualmente por el operador y ubicación para vuelos sin tramo
alter table public.registro_vuelos add column if not exists turno_manual text;
alter table public.registro_vuelos add column if not exists ubicacion_manual text;
