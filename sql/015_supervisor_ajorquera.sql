-- Agrega al supervisor Alejandro Jorquera (S1).
--
-- Los supervisores acceden con email + contraseña (Supabase Auth).
-- Esta migración solo crea la fila en la tabla operadores, que mapea
-- el email a un halcon_n y rol Supervisor. Después de correr este SQL,
-- crea el usuario en Supabase Auth (Authentication → Users → Add user)
-- usando el email ajorquera@amszo.cl y define una contraseña inicial.

insert into public.operadores (halcon_n, nombre, rol, email) values
  ('S1', 'Alejandro Jorquera', 'Supervisor', 'ajorquera@amszo.cl')
on conflict (halcon_n) do update set
  nombre = excluded.nombre,
  rol    = excluded.rol,
  email  = excluded.email;
