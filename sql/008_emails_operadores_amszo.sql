-- ============================================================
-- Halcón — Correos internos de los operadores (login por selección de Halcón)
-- Los operadores entran tocando "Halcón N" (sin clave); la app usa por debajo
-- el usuario interno halcon<N>@amszo.cl. Estos correos NO son buzones reales,
-- solo el identificador que enlaza cada operador con sus vuelos (RLS).
-- Deben coincidir EXACTO con los usuarios que crees en Supabase Auth.
--
-- Ejecutar después de 003 (idempotente).
-- ============================================================

update public.operadores set email = 'halcon1@amszo.cl' where halcon_n = '1';
update public.operadores set email = 'halcon2@amszo.cl' where halcon_n = '2';
update public.operadores set email = 'halcon3@amszo.cl' where halcon_n = '3';
update public.operadores set email = 'halcon4@amszo.cl' where halcon_n = '4';
update public.operadores set email = 'halcon5@amszo.cl' where halcon_n = '5';
update public.operadores set email = 'halcon6@amszo.cl' where halcon_n = '6';
update public.operadores set email = 'halcon7@amszo.cl' where halcon_n = '7';

-- Supervisores
update public.operadores set email = 'ividal@amszo.cl' where halcon_n = 'S4';
