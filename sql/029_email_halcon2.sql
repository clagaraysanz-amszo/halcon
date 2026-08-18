-- Actualiza el email de Halcón 2 (Ahmed Allami) al correo institucional.
-- Este email debe coincidir con el usuario creado en Supabase Auth.

update public.operadores
set email = 'aallami@amszo.cl'
where halcon_n = '2';
