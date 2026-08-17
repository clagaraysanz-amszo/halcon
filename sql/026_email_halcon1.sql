-- Actualiza el email de Halcón 1 (Carlos Tapia) al correo personal.
-- Este email debe coincidir con el usuario creado en Supabase Auth.

update public.operadores
set email = 'ctapia@amszo.cl'
where halcon_n = '1';
