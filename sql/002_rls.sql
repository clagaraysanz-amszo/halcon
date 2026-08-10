-- ============================================================
-- Halcón — Row Level Security (RLS)
-- Un operador solo lee/escribe sus propios registros; el supervisor
-- lee (y en el caso de pdo_dia, escribe) todo. Mapeo por email
-- (Supabase Auth) -> operadores.halcon_n.
-- Ejecutar DESPUÉS de 001_schema.sql y de crear los usuarios en Auth.
-- ============================================================

-- ---------- funciones helper ----------
-- Devuelven el halcon_n / rol del usuario autenticado según su email.
-- security definer: pueden leer 'operadores' aunque quien las invoca
-- todavía no tenga permiso (evita problemas de recursión en las policies).

create or replace function public.current_halcon_n()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select halcon_n from public.operadores where email = auth.jwt() ->> 'email'
$$;

create or replace function public.is_supervisor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.operadores
    where email = auth.jwt() ->> 'email' and rol = 'Supervisor'
  )
$$;

-- ---------- activar RLS ----------
alter table public.tramos enable row level security;
alter table public.operadores enable row level security;
alter table public.pdo_dia enable row level security;
alter table public.registro_vuelos enable row level security;

-- ---------- tramos: dato maestro, lectura para cualquier usuario autenticado ----------
drop policy if exists "tramos_select_authenticated" on public.tramos;
create policy "tramos_select_authenticated"
  on public.tramos for select
  to authenticated
  using (true);

-- ---------- operadores: lectura para cualquier usuario autenticado ----------
-- (se necesita para mapear el email logueado -> fila de operador, y para
-- que supervisor/operador vean nombres en listas y paneles)
drop policy if exists "operadores_select_authenticated" on public.operadores;
create policy "operadores_select_authenticated"
  on public.operadores for select
  to authenticated
  using (true);

-- ---------- pdo_dia ----------
-- Lectura: el operador solo sus filas; el supervisor, todas.
drop policy if exists "pdo_dia_select" on public.pdo_dia;
create policy "pdo_dia_select"
  on public.pdo_dia for select
  to authenticated
  using (halcon_n = public.current_halcon_n() or public.is_supervisor());

-- Inserción: solo supervisor (carga del PDO del día).
drop policy if exists "pdo_dia_insert_supervisor" on public.pdo_dia;
create policy "pdo_dia_insert_supervisor"
  on public.pdo_dia for insert
  to authenticated
  with check (public.is_supervisor());

-- Actualización: supervisor (edición del PDO) u operador dueño de la fila
-- (marcar 'Realizado' al confirmar un vuelo que vino de una asignación).
drop policy if exists "pdo_dia_update" on public.pdo_dia;
create policy "pdo_dia_update"
  on public.pdo_dia for update
  to authenticated
  using (public.is_supervisor() or halcon_n = public.current_halcon_n())
  with check (public.is_supervisor() or halcon_n = public.current_halcon_n());

-- Eliminación: solo supervisor (correcciones del PDO).
drop policy if exists "pdo_dia_delete_supervisor" on public.pdo_dia;
create policy "pdo_dia_delete_supervisor"
  on public.pdo_dia for delete
  to authenticated
  using (public.is_supervisor());

-- ---------- registro_vuelos ----------
-- Lectura: el operador solo sus propios vuelos; el supervisor, todos.
drop policy if exists "registro_vuelos_select" on public.registro_vuelos;
create policy "registro_vuelos_select"
  on public.registro_vuelos for select
  to authenticated
  using (halcon_n = public.current_halcon_n() or public.is_supervisor());

-- Inserción: el operador solo puede insertar vuelos propios (halcon_n = el suyo).
drop policy if exists "registro_vuelos_insert_propio" on public.registro_vuelos;
create policy "registro_vuelos_insert_propio"
  on public.registro_vuelos for insert
  to authenticated
  with check (halcon_n = public.current_halcon_n());
