-- ============================================================
-- Halcón — Ubicación GPS del vuelo (README §7)
-- Agrega latitud/longitud a registro_vuelos. La app captura el GPS del
-- dispositivo al confirmar el vuelo (navigator.geolocation); el Panel de
-- Supervisión enlaza esas coordenadas a Google Maps.
--
-- Columnas NULLABLES a propósito: la captura es "best effort" — si el
-- operador niega el permiso o no hay señal, el vuelo se guarda sin ubicación.
--
-- Ejecutar DESPUÉS de 001_schema.sql (idempotente; seguro de re-ejecutar).
-- ============================================================

alter table public.registro_vuelos
  add column if not exists latitud  numeric(9,6),
  add column if not exists longitud numeric(9,6);

comment on column public.registro_vuelos.latitud  is 'Latitud capturada por GPS del dispositivo al confirmar el vuelo (nullable).';
comment on column public.registro_vuelos.longitud is 'Longitud capturada por GPS del dispositivo al confirmar el vuelo (nullable).';
