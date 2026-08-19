-- Actualiza el email de Halcón 7 (Juan Gutierrez Purran) al correo institucional.
-- Este email debe coincidir con el usuario creado en Supabase Auth.

update public.operadores
set email = 'jgutierrez@amszo.cl'
where halcon_n = '7';
