-- Ampliar tipificaciones para incluir "Verificación de Incivilidades"
alter table public.registro_vuelos drop constraint if exists registro_vuelos_tipificacion_check;
alter table public.registro_vuelos add constraint registro_vuelos_tipificacion_check
  check (tipificacion in (
    'Paneo Preventivo',
    'Paneo Focalizado',
    'Informe Situacional',
    'Monitoreo Preventivo',
    'Constancia de Servicio',
    'Detección de Ruco',
    'Verificación de Incivilidades',
    'Monitoreo de Quebradas',
    'Sospechoso Interior de Domicilio',
    'Sospechoso en Vía Pública',
    'Robo en Lugar Habitado',
    'Robo en Lugar no Habitado',
    'Servicio Farellones'
  ));
