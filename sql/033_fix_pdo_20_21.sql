-- Repara la mezcla de PDOs: el PDO del 21-08 se cargó accidentalmente en el
-- 20-08 (el selector de fecha estaba en la fecha equivocada). Las filas del
-- 21 que no existen en el PDO real del 20 se mueven al 21-08.
--
-- PDO 20-08 real (Ahmed turno A): sectores 30, 68, 15, 31, 27
-- PDO 21-08 real (Ahmed turno A): sectores 59, 60, 11, 28 (+ servicio colegio 07:15)
-- Las filas extra del 21 mezcladas en el 20 son:
--   H2 Ahmed: tramos 59, 60, 11 (tramo 28 ya existía en el 20 para H2)
--   H3 José Correa: tramos 66, 3, 8, 62 (H3 no debería tener nada el 20)

-- 1. Mover H2 Ahmed tramos 59, 60, 11 del 20 al 21
UPDATE public.pdo_dia
SET fecha = '2026-08-21'
WHERE fecha = '2026-08-20'
  AND halcon_n = '2'
  AND tramo_n IN (59, 60, 11)
  AND estado = 'Pendiente';

-- 2. Mover toda la aparición de H3 José Correa del 20 al 21
-- (H3 no tiene PDO de dron el 20, todo lo suyo es del 21)
UPDATE public.pdo_dia
SET fecha = '2026-08-21'
WHERE fecha = '2026-08-20'
  AND halcon_n = '3'
  AND estado = 'Pendiente';

-- 3. Verificar el resultado
SELECT fecha, halcon_n, turno, tramo_n, hora, estado
FROM public.pdo_dia
WHERE fecha IN ('2026-08-20', '2026-08-21')
ORDER BY fecha, halcon_n, hora;
