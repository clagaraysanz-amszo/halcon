-- Permite que la pantalla de login lea la lista de operadores sin estar autenticado.
-- Solo expone halcon_n, nombre, email y rol (necesarios para el login).
-- RLS ya debe estar habilitado en la tabla operadores.

alter table public.operadores enable row level security;

create policy "Login: lectura pública de operadores"
  on public.operadores
  for select
  using (true);

-- Actualiza el email de Halcón 5 (Sebastián Castillo) al correo personal.
-- Este email debe coincidir con el usuario creado en Supabase Auth.
update public.operadores
set email = 'scastillo@amszo.cl'
where halcon_n = '5';
