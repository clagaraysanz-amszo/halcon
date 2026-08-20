-- José Correa (Halcón 3) comparte móvil con Sebastián Castillo (Halcón 5) en
-- turno B, 21-08-2026. Quedó cargado como turno N por error; se corrige a B.
UPDATE public.pdo_dia
SET turno = 'B'
WHERE fecha = '2026-08-21'
  AND halcon_n = '3';

-- Verificación
SELECT fecha, halcon_n, turno, tramo_n, hora, estado
FROM public.pdo_dia
WHERE fecha = '2026-08-21'
ORDER BY halcon_n, hora;
