-- Agrega 'Justificado' como estado válido en pdo_dia.
-- Se usa cuando el operador no realizó el sobrevuelo por estar
-- en otra tarea (apoyo, colación, sobrevuelo extra SIC/jefatura).

ALTER TABLE public.pdo_dia DROP CONSTRAINT pdo_dia_estado_check;

ALTER TABLE public.pdo_dia ADD CONSTRAINT pdo_dia_estado_check
  CHECK (estado IN ('Pendiente', 'Realizado', 'No realizado', 'Justificado'));
