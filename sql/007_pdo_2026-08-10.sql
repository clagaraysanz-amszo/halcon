-- ============================================================
-- Halcón — PDO real del LUNES 10 DE AGOSTO DE 2026 (sección Drone/RPA)
-- Fuente: "PDO DOCUMENTO UNICO 10-08-2026.xlsx", hojas TURNO A-SE / B-C / N.
--
-- Mapeo operador -> halcon_n:
--   Turno A: Gutiérrez Purran Juan     -> Halcón 7 (Juan Gutiérrez)
--   Turno B: Hatem Allami Ahmed        -> Halcón 2 (Ahmed Allami)
--   Turno N: Cáceres Gatica Esteban    -> Halcón 4 (Esteban Cáceres)
--
-- El turno N cruza medianoche; el PDO se fecha por el día en que INICIA
-- el turno (README §5.5), así que TODAS las filas van con fecha 2026-08-10,
-- incluidas las de 00:30 / 01:30 / etc.
--
-- Se borran primero las filas de esa fecha para poder re-ejecutar sin duplicar.
-- ============================================================

delete from public.pdo_dia where fecha = '2026-08-10';

insert into public.pdo_dia (fecha, turno, halcon_n, tramo_n, hora) values
  -- Turno A — Halcón 7 (Juan Gutiérrez)
  ('2026-08-10', 'A', '7', 68, '09:10'),
  ('2026-08-10', 'A', '7', 15, '10:30'),
  ('2026-08-10', 'A', '7', 31, '11:30'),
  ('2026-08-10', 'A', '7', 27, '13:00'),
  -- Turno B — Halcón 2 (Ahmed Allami)
  ('2026-08-10', 'B', '2', 23, '14:20'),
  ('2026-08-10', 'B', '2', 68, '16:00'),
  ('2026-08-10', 'B', '2', 28, '18:00'),
  ('2026-08-10', 'B', '2', 15, '19:00'),
  ('2026-08-10', 'B', '2', 31, '20:15'),
  ('2026-08-10', 'B', '2', 27, '21:10'),
  -- Turno N — Halcón 4 (Esteban Cáceres) — cruza medianoche, misma fecha operativa
  ('2026-08-10', 'N', '4', 23, '22:20'),
  ('2026-08-10', 'N', '4', 66, '23:30'),
  ('2026-08-10', 'N', '4', 68, '00:30'),
  ('2026-08-10', 'N', '4', 15, '01:30'),
  ('2026-08-10', 'N', '4', 68, '02:30'),
  ('2026-08-10', 'N', '4', 31, '04:00'),
  ('2026-08-10', 'N', '4', 27, '05:30');
