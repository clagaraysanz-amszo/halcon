-- Credenciales de Operador RPA (DGAC) por funcionario, para incluir en la
-- bitácora nocturna. Se van completando a medida que el supervisor las sube.

alter table public.operadores
  add column if not exists rut text,
  add column if not exists credencial_rpa_n text,
  add column if not exists credencial_otorgamiento date,
  add column if not exists credencial_validez date,
  add column if not exists habilitaciones text;

-- Halcón 2 — Ahmed Sadeq Allami
update public.operadores set
  rut = '25781871-3',
  credencial_rpa_n = '8855',
  credencial_otorgamiento = '2022-03-14',
  credencial_validez = '2027-12-18',
  habilitaciones = 'Matrice Series - Mavic Series - Phantom Series - Parrot Disco - VNOC'
where halcon_n = '2';

-- Halcón 5 — Sebastián Castillo Fuentes
update public.operadores set
  rut = '20583879-1',
  credencial_rpa_n = '12061',
  credencial_otorgamiento = '2023-04-10',
  credencial_validez = '2028-05-16',
  habilitaciones = 'Matrice Series - Mavic Series - Phantom Series - Agras Series - Inspire Series - VNOC'
where halcon_n = '5';

-- Halcón 7 — Juan Gutiérrez Purran
update public.operadores set
  rut = '19464281-4',
  credencial_rpa_n = '23305',
  credencial_otorgamiento = '2026-04-07',
  credencial_validez = '2029-04-07',
  habilitaciones = 'Matrice / Mavic / Enterprise / Air3 - VNOC'
where halcon_n = '7';
