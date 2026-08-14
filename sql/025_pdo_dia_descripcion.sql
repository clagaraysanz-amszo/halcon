-- Guarda el texto literal de la labor asignada al Operador Drone cuando el
-- PDO no trae sector puntual (p.ej. "VIGILANCIA SECTOR ÑILHUE - HUALLALOLEN
-- - NOVILLO MUERTO - RIO MAPOCHO DESDE PLAZA SAN ENRIQUE AL CC9 CON DRON"),
-- para mostrarlo tal cual al piloto y al supervisor en vez de un genérico.
alter table public.pdo_dia add column if not exists descripcion text;
