-- Borra las filas viejas de Juan (Halcón 7) del 21-08 cargadas antes del fix
-- del importador (quedaron con turno B/N en vez de C, y con sectores viejos).
-- Solo borra Pendientes: si algo ya se marcó Realizado se conserva.
DELETE FROM public.pdo_dia
WHERE fecha = '2026-08-21'
  AND halcon_n = '7'
  AND estado = 'Pendiente';
