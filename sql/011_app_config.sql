-- Tabla para guardar configuraciones de la app (tokens de OneDrive, etc.)
create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- Solo el service_role puede leer/escribir esta tabla (contiene tokens sensibles)
alter table public.app_config enable row level security;
