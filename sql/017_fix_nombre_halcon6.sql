-- Corrige el nombre del funcionario Halcón 6: estaba "Miguel Gallardo",
-- el nombre correcto es "Miguel Cortez".

update public.operadores
set nombre = 'Miguel Cortez'
where halcon_n = '6';
