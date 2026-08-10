-- ============================================================
-- Halcón — Carga de datos/Operadores.csv
-- ⚠️ Reemplaza los emails de ejemplo (@lobarnechea.cl) por los reales
-- ANTES o DESPUÉS de ejecutar esto (puedes hacer UPDATE más tarde).
-- Estos emails deben coincidir exactamente con los que se usen para
-- crear los usuarios en Supabase Auth (paso manual, ver guía).
-- ============================================================

insert into public.operadores (halcon_n, nombre, rol, email) values
  ('1',   'Carlos Tapia',       'Operador',   'halcon1@lobarnechea.cl'),
  ('2',   'Ahmed Allami',       'Operador',   'halcon2@lobarnechea.cl'),
  ('3',   'José Correa',        'Operador',   'halcon3@lobarnechea.cl'),
  ('4',   'Esteban Cáceres',    'Operador',   'halcon4@lobarnechea.cl'),
  ('5',   'Sebastián Castillo', 'Operador',   'halcon5@lobarnechea.cl'),
  ('6',   'Miguel Gallardo',    'Operador',   'halcon6@lobarnechea.cl'),
  ('7',   'Juan Gutiérrez',     'Operador',   'halcon7@lobarnechea.cl'),
  ('S4',  'Ignacio Vidal',      'Supervisor', 'ividal@lobarnechea.cl'),
  ('S23', 'Claudio Garay',      'Supervisor', 'cgaray@amszo.cl')
on conflict (halcon_n) do update set
  nombre = excluded.nombre,
  rol    = excluded.rol,
  email  = excluded.email;
