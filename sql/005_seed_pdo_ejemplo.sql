-- ============================================================
-- Halcón — Carga de datos/PDO_Dia_ejemplo.csv (OPCIONAL, solo para pruebas)
-- En producción el supervisor carga el PDO real cada día desde la
-- pantalla "Cargar PDO" (README §6.9) — este script es solo para tener
-- datos de prueba y ver la app funcionando de inmediato.
--
-- El CSV de ejemplo usa la fecha 2026-08-05. Si estás probando en otra
-- fecha, cambia el valor de la variable :fecha más abajo (o reemplaza
-- '2026-08-05' por CURRENT_DATE en los 15 INSERT).
-- ============================================================

insert into public.pdo_dia (fecha, turno, halcon_n, tramo_n, hora) values
  ('2026-08-05', 'A', '2', 68, '09:10'),
  ('2026-08-05', 'A', '2', 15, '10:30'),
  ('2026-08-05', 'A', '2', 31, '11:30'),
  ('2026-08-05', 'A', '2', 27, '13:00'),
  ('2026-08-05', 'B', '5', 23, '14:20'),
  ('2026-08-05', 'B', '5', 68, '16:00'),
  ('2026-08-05', 'B', '5', 15, '19:00'),
  ('2026-08-05', 'B', '5', 31, '20:15'),
  ('2026-08-05', 'B', '5', 27, '21:10'),
  ('2026-08-05', 'N', '1', 23, '22:20'),
  ('2026-08-05', 'N', '1', 66, '23:30'),
  ('2026-08-05', 'N', '1', 68, '00:30'),
  ('2026-08-05', 'N', '1', 15, '01:30'),
  ('2026-08-05', 'N', '1', 31, '04:00'),
  ('2026-08-05', 'N', '1', 27, '05:30');
