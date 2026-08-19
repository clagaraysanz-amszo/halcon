-- Agrega 'C' como turno válido en pdo_dia. Turno C es un turno extendido /
-- compartido (p.ej. 16:00-00:00) que algunos operadores de dron tienen
-- cuando comparten móvil con el turno B y luego con el turno N (ver hoja
-- "TURNO B-C" del PDO). Antes de este cambio esas filas quedaban forzadas
-- a turno 'B' o 'N' según la hora, partiendo al operador en dos tarjetas.
ALTER TABLE public.pdo_dia DROP CONSTRAINT pdo_dia_turno_check;
ALTER TABLE public.pdo_dia ADD CONSTRAINT pdo_dia_turno_check
  CHECK (turno IN ('A', 'B', 'C', 'N'));

-- Corrige las filas de HOY (Halcón 7, turno C real 16:00-00:00) que quedaron
-- cargadas como 'B' o 'N' por no existir el turno C en el sistema.
UPDATE public.pdo_dia
SET turno = 'C'
WHERE fecha = '2026-08-19'
  AND halcon_n = '7';
