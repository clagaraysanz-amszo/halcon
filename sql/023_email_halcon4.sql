-- Actualiza el email de Halcón 4 al correo personal.
-- Este email debe coincidir con el usuario creado en Supabase Auth.

update public.operadores
set email = 'ecaceres@amszo.cl'
where halcon_n = '4';
