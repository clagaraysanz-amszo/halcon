-- Inventario de drones AMSZO para bitácora DGAC.
-- Propietario: Asociación de Municipalidades para la Seguridad Zona Oriente
-- RUT 65.118.035-K · Av. El Rodeo Interior 13541, Lo Barnechea.

create table if not exists public.drones (
  id serial primary key,
  codigo text not null unique,       -- código corto usado en la app (DUAL, 3TD, ZOOM, etc.)
  marca text not null,
  modelo text not null,
  numero_serie text not null,
  matricula_dgac text,               -- RPA-XXXX (null si está pendiente)
  peso_max_kg numeric(6,3) not null,
  autonomia_min int not null,
  paracaidas text,
  jornada text default 'Diurno y nocturno',
  activo boolean default true,
  created_at timestamptz default now()
);

-- Mapeo codigo ↔ aeronave usada en registro_vuelos:
--   ADVANCED / DUAL → selección manual al generar bitácora (hay varios Mavic 2)
--   ZOOM            → selección manual (hay 2 Zoom)
--   3TD             → selección manual (hay 2 Matrice 3TD)
--   MATRICE 300     → único
--   AUTEL           → único
--   HUNTER          → Robomotic Hunter

insert into public.drones (codigo, marca, modelo, numero_serie, matricula_dgac, peso_max_kg, autonomia_min, paracaidas, jornada) values
  ('M2EA',       'DJI',       'Mavic 2 Enterprise Advanced',  '4GCCJCHR0B06U7',       'RPA-2424', 0.970, 30, 'FlyFire Manti 2',  'Diurno y nocturno'),
  ('M2EZ-1',     'DJI',       'Mavic 2 Enterprise Zoom',      '276CJ1PR0A0JWG',       'RPA-1744', 0.960, 30, 'Sí',               'Diurno y nocturno'),
  ('M2EZ-2',     'DJI',       'Mavic 2 Enterprise Zoom',      '276DFAP001W6J7',       'RPA-1745', 0.950, 30, 'Sí',               'Diurno y nocturno'),
  ('M2E',        'DJI',       'Mavic 2 Enterprise',            '298CH8GR0A0HLB',       'RPA-1617', 0.950, 30, 'Sí',               'Diurno y nocturno'),
  ('M3ET',       'DJI',       'Mavic 3 Enterprise Thermal',    '1581F5FJB22A700A0F8A', 'RPA-2967', 1.050, 40, 'Mantis 3 Plus',    'Diurno y nocturno'),
  ('3TD-1',      'DJI',       'Matrice 3TD (RTK)',             '1581FQ8D244V00EH5XZ',  'RPA-4749', 1.410, 50, 'Sí',               'Diurno y nocturno'),
  ('3TD-2',      'DJI',       'Matrice 3TD (RTK)',             '1581F6Q8D246Q001ZKR3', 'RPA-4750', 1.410, 50, 'Sí',               'Diurno y nocturno'),
  ('M300',       'DJI',       'Matrice 300 RTK Series',        '1ZNBK3J00C001T',      'RPA-2423', 8.525, 55, 'Sí',               'Diurno y nocturno'),
  ('AUTEL',      'Autel',     'EVO 2 Pro Enterprise',          'HA292143I1I45',        'RPA-2425', 1.215, 40, 'Sí',               'Diurno y nocturno'),
  ('HUNTER',     'Robomotic', 'Hunter',                        'RBMVT0L002',           null,       8.000, 50, 'Sí',               'Diurno y nocturno');

-- RLS: lectura para usuarios autenticados
alter table public.drones enable row level security;

create policy "Lectura de drones para autenticados"
  on public.drones for select
  using (auth.role() = 'authenticated');
