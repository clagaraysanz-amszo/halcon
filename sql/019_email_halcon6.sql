-- Actualiza el email de Halcón 6 (Miguel Cortez) al correo personal.
-- Este email debe coincidir con el usuario creado en Supabase Auth.

update public.operadores
set email = 'Mcortes@amszo.cl'
where halcon_n = '6';
