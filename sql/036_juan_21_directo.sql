-- Carga directa de los sobrevuelos de Juan (Halcón 7, turno C) para el
-- 21-08-2026, sin depender de la carga por Excel. Borra cualquier fila
-- vieja (Pendiente) que haya quedado mal cargada y la reemplaza limpia.

DELETE FROM public.pdo_dia
WHERE fecha = '2026-08-21'
  AND halcon_n = '7'
  AND estado = 'Pendiente';

INSERT INTO public.pdo_dia (fecha, turno, halcon_n, tramo_n, hora) VALUES
  ('2026-08-21', 'C', '7', 28, '17:20'),
  ('2026-08-21', 'C', '7', 12, '19:00'),
  ('2026-08-21', 'C', '7', 59, '20:00'),
  ('2026-08-21', 'C', '7', 60, '21:00'),
  ('2026-08-21', 'C', '7', 8,  '22:00'),
  ('2026-08-21', 'C', '7', 3,  '23:00');

-- Verificación
SELECT fecha, halcon_n, turno, tramo_n, hora, estado
FROM public.pdo_dia
WHERE fecha = '2026-08-21' AND halcon_n = '7'
ORDER BY hora;
