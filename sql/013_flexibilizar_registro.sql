-- Permitir vuelos sin tramo (otros vuelos operativos)
alter table public.registro_vuelos alter column tramo_n drop not null;

-- Agregar aeronaves ADVANCED y ZOOM
alter table public.registro_vuelos drop constraint if exists registro_vuelos_aeronave_check;
alter table public.registro_vuelos add constraint registro_vuelos_aeronave_check
  check (aeronave in ('DUAL', 'AUTEL', '3TD', 'MATRICE 300', 'AIR 2', 'ADVANCED', 'ZOOM'));

-- Ampliar tipificaciones para incluir otros vuelos
alter table public.registro_vuelos drop constraint if exists registro_vuelos_tipificacion_check;
alter table public.registro_vuelos add constraint registro_vuelos_tipificacion_check
  check (tipificacion in (
    'Paneo Preventivo',
    'Paneo Focalizado',
    'Informe Situacional',
    'Monitoreo Preventivo',
    'Constancia de Servicio',
    'Detección de Ruco',
    'Monitoreo de Quebradas',
    'Sospechoso Interior de Domicilio',
    'Sospechoso en Vía Pública',
    'Robo en Lugar Habitado',
    'Robo en Lugar no Habitado',
    'Servicio Farellones'
  ));
