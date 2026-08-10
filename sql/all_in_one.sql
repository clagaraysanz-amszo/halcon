-- ============================================================
-- Halcón — SETUP COMPLETO (001..006 concatenados)
-- Pega TODO esto en Supabase → SQL Editor → New query → Run.
-- El 005 (PDO de ejemplo, fechado 2026-08-05) está incluido; si no
-- lo quieres, borra ese bloque antes de correr.
-- ============================================================


-- ==================== 001_schema.sql ====================
-- ============================================================
-- Halcón — Esquema de base de datos (Supabase / Postgres)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Orden: 001_schema.sql → 002_rls.sql → 003_seed_operadores.sql
--        → 004_seed_tramos.sql → 005_seed_pdo_ejemplo.sql (opcional)
-- ============================================================

-- gen_random_uuid() viene de pgcrypto; Supabase la trae habilitada por
-- defecto, pero se declara igual para que el script sea autosuficiente.
create extension if not exists pgcrypto;

-- ---------- tramos (dato maestro, 69 filas fijas) ----------
create table if not exists public.tramos (
  tramo_n   integer primary key,
  nombre    text not null,
  cuadrante text not null,
  sector    text not null,
  latitud   numeric(9,6),
  longitud  numeric(9,6)
);

comment on table public.tramos is 'Dato maestro de los 69 tramos de sobrevuelo (cargado desde datos/Tramos.csv)';

-- ---------- operadores ----------
create table if not exists public.operadores (
  halcon_n text primary key,
  nombre   text not null,
  rol      text not null check (rol in ('Operador', 'Supervisor')),
  email    text not null unique
);

comment on table public.operadores is 'Halcones 1-7 (Operador) + S4/S23 (Supervisor). Vincula con Supabase Auth por email.';

-- ---------- pdo_dia (plan de despliegue operativo, cargado por el supervisor cada día) ----------
create table if not exists public.pdo_dia (
  id        uuid primary key default gen_random_uuid(),
  fecha     date not null,
  turno     text not null check (turno in ('A', 'B', 'N')),
  halcon_n  text not null references public.operadores (halcon_n),
  tramo_n   integer not null references public.tramos (tramo_n),
  hora      text not null,
  estado    text not null default 'Pendiente' check (estado in ('Pendiente', 'Realizado'))
);

comment on table public.pdo_dia is 'Plan de Despliegue Operativo del día: qué operador vuela qué tramo, turno y hora.';

create index if not exists idx_pdo_dia_fecha on public.pdo_dia (fecha);
create index if not exists idx_pdo_dia_halcon_fecha on public.pdo_dia (halcon_n, fecha);

-- ---------- registro_vuelos (bitácora, la llena la app al registrar) ----------
create table if not exists public.registro_vuelos (
  id             uuid primary key default gen_random_uuid(),
  fecha          date not null,
  halcon_n       text not null references public.operadores (halcon_n),
  tramo_n        integer not null references public.tramos (tramo_n),
  altura         text not null,
  minutos        integer not null check (minutos > 0),
  aeronave       text not null check (aeronave in ('DUAL', 'AUTEL', '3TD', 'MATRICE 300', 'AIR 2')),
  tipificacion   text not null check (
    tipificacion in (
      'Paneo Preventivo',
      'Paneo Focalizado',
      'Informe Situacional',
      'Monitoreo Preventivo',
      'Constancia de Servicio'
    )
  ),
  estado         text not null check (estado in ('Realizado', 'Interrumpido', 'Reprogramado')),
  observaciones  text,
  hora_inicio    text not null,
  pdo_id         uuid references public.pdo_dia (id),
  created_at     timestamptz not null default now()
);

comment on table public.registro_vuelos is 'Bitácora de vuelos registrados por los operadores. Tabla vacía al inicio.';

create index if not exists idx_registro_vuelos_fecha on public.registro_vuelos (fecha);
create index if not exists idx_registro_vuelos_halcon_fecha on public.registro_vuelos (halcon_n, fecha);


-- ==================== 002_rls.sql ====================
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


-- ==================== 003_seed_operadores.sql ====================
-- ============================================================
-- Halcón — Carga de datos/Operadores.csv
-- ⚠️ Reemplaza los emails de ejemplo (@lobarnechea.cl) por los reales
-- ANTES o DESPUÉS de ejecutar esto (puedes hacer UPDATE más tarde).
-- Estos emails deben coincidir exactamente con los que se usen para
-- crear los usuarios en Supabase Auth (paso manual, ver guía).
-- ============================================================

insert into public.operadores (halcon_n, nombre, rol, email) values
  ('1',   'Carlos Tapia',       'Operador',   'halcon1@lobarnechea.cl'),
  ('2',   'Ahmed Allami',       'Operador',   'halcon2@lobarnechea.cl'),
  ('3',   'José Correa',        'Operador',   'halcon3@lobarnechea.cl'),
  ('4',   'Esteban Cáceres',    'Operador',   'halcon4@lobarnechea.cl'),
  ('5',   'Sebastián Castillo', 'Operador',   'halcon5@lobarnechea.cl'),
  ('6',   'Miguel Gallardo',    'Operador',   'halcon6@lobarnechea.cl'),
  ('7',   'Juan Gutiérrez',     'Operador',   'halcon7@lobarnechea.cl'),
  ('S4',  'Ignacio Vidal',      'Supervisor', 'ividal@lobarnechea.cl'),
  ('S23', 'Claudio Garay',      'Supervisor', 'cgaray@amszo.cl')
on conflict (halcon_n) do update set
  nombre = excluded.nombre,
  rol    = excluded.rol,
  email  = excluded.email;


-- ==================== 004_seed_tramos.sql ====================
-- ============================================================
-- Halcón — Carga de datos/Tramos.csv (69 tramos, dato maestro fijo)
-- ============================================================

insert into public.tramos (tramo_n, nombre, cuadrante, sector, latitud, longitud) values
  (1,  'OLTEN', '113', 'La Dehesa', -33.324548, -70.503843),
  (2,  'CAMINO LOS LOTOS', '113', 'La Dehesa', -33.339113, -70.493721),
  (3,  'PARQUE EL SOL', '113', 'La Dehesa', -33.345862, -70.507699),
  (4,  'LA CUMBRE / EL ESTANQUE', '113', 'La Dehesa', -33.324330, -70.510591),
  (5,  'GOLF DE MANQUEHUE LAS HUALTATAS', '113A', 'La Dehesa', -33.337799, -70.542380),
  (6,  'GOLF LOMAS DE LA DEHESA', '113A', 'La Dehesa', -33.337895, -70.537485),
  (7,  'EXPLANADA LOS NOGALES', '113A', 'La Dehesa', -33.323113, -70.532466),
  (8,  'LA DEHESA PANORÁMICA SUR', '113A', 'La Dehesa', -33.334036, -70.521460),
  (9,  'COPEC LOS TRAPENSES', '114', 'Los Trapenses', -33.353709, -70.539872),
  (10, 'LOS LITRES', '114A', 'Manquehue', -33.316007, -70.551707),
  (11, 'LOS BRAVOS', '114A', 'Manquehue', -33.323344, -70.569764),
  (12, 'CERRO MANQUEHUE', '114A', 'Manquehue', -33.344044, -70.567670),
  (13, 'CAMINO REAL / PUENTE PIEDRA', '114A', 'Manquehue', -33.324790, -70.551673),
  (14, 'CENTRAL LBS', '115', 'Nido de Águilas', -33.351674, -70.508234),
  (15, 'COLEGIO NIDO DE ÁGUILAS', '115', 'Nido de Águilas', -33.352488, -70.501165),
  (16, 'PADRE ARTEAGA / RAÚL LABBÉ', '115', 'Nido de Águilas', -33.362717, -70.508778),
  (17, 'PARQUE DE LA CHILENIDAD', '115', 'Nido de Águilas', -33.355693, -70.493379),
  (18, 'PORTAL LA DEHESA', '115', 'Nido de Águilas', -33.357660, -70.517032),
  (19, 'PLAZA NIDO DE ÁGUILAS', '115', 'Nido de Águilas', -33.354345, -70.507821),
  (20, 'SKATEPARK', '115', 'Nido de Águilas', -33.362338, -70.500918),
  (21, 'CCS9', '115', 'Nido de Águilas', -33.364262, -70.507357),
  (22, 'VIRGEN PEREGRINA', '116', 'San Enrique', -33.365726, -70.501361),
  (23, 'CAMINO TURÍSTICO', '116A', 'San Enrique', -33.367380, -70.532718),
  (24, 'PLAZA EL CANELO', '116A', 'San Enrique', -33.360128, -70.535397),
  (25, 'CAMINO HUALLALOLÉN', '117', 'El Arrayán', -33.342206, -70.465699),
  (26, 'PASTOR FERNÁNDEZ', '117', 'El Arrayán', -33.360933, -70.480157),
  (27, 'HIJUELAS DEL ARRAYÁN', '117', 'El Arrayán', -33.346766, -70.480199),
  (28, 'ÁGUILA 1', '116', 'San Enrique', -33.365524, -70.513791),
  (29, 'PLAZA SAN ENRIQUE', '116', 'San Enrique', -33.363140, -70.493467),
  (30, 'EL RODEO / LA DEHESA', '115', 'Nido de Águilas', -33.353405, -70.518522),
  (31, 'CAPILLA EMAÚS', '117', 'El Arrayán', -33.344307, -70.470542),
  (32, 'PASTOR FERNÁNDEZ / EL CAJÓN', '117', 'El Arrayán', -33.360923, -70.480169),
  (33, 'CERRO BLANCO', '114', 'Los Trapenses', -33.361402, -70.547872),
  (34, 'EL OFICIO / LAS PATAGUAS', '114', 'Los Trapenses', -33.350431, -70.533676),
  (35, 'GOLF DE MANQUEHUE / EL PARQUE', '114', 'Los Trapenses', -33.337017, -70.548024),
  (36, 'CAMINO CENTRAL ACCESO C. DEL MEDIO', '113A', 'La Dehesa', -33.349812, -70.522785),
  (37, 'JUAN PABLO II', '116', 'San Enrique', -33.365722, -70.513664),
  (38, 'PASEO ALCALÁ / PASEO EL CID', '113A', 'La Dehesa', -33.323074, -70.535866),
  (39, 'LAS HUALTATAS / PIE ANDINO', '113A', 'La Dehesa', -33.323429, -70.538711),
  (40, 'LA DEHESA 4580', '113A', 'La Dehesa', -33.328298, -70.519661),
  (41, 'BASEL / LOS ALPES', '113', 'La Dehesa', -33.330189, -70.513922),
  (42, 'PARQUE SUR / HACIENDA', '113', 'La Dehesa', -33.333308, -70.514030),
  (43, 'BOULEVARD DE LOS PÁJAROS', '114A', 'Manquehue', -33.324711, -70.551649),
  (44, 'GRAN VISTA / MANQUECURA', '114A', 'Manquehue', -33.337376, -70.566345),
  (45, 'PUNTA DE ÁGUILAS / CAMINO LA HUERTA', '114A', 'Manquehue', -33.345629, -70.555228),
  (46, 'VALLE MONASTERIO / C. EL CIELO', '114', 'Los Trapenses', -33.347347, -70.546792),
  (47, 'ASCONA / EL PEUMO', '113', 'La Dehesa', -33.332583, -70.507847),
  (48, 'LOS CACTUS / EL TRANQUE', '113A', 'La Dehesa', -33.359760, -70.520524),
  (49, 'HUINGANAL / PIE ANDINO', '113', 'La Dehesa', -33.333179, -70.506116),
  (50, 'LOS QUINCHEROS / CERRO 18', '115', 'Nido de Águilas', -33.356625, -70.503226),
  (51, 'ETAPA 1 POBLACIÓN ERMITA (DOCK2)', '116', 'San Enrique', -33.363642, -70.498588),
  (52, 'LAS LOMAS 1 Y 2 (DOCK2)', '116', 'San Enrique', -33.363354, -70.502835),
  (53, 'ERMITA / VIRGEN PEREGRINA', '116', 'San Enrique', -33.365737, -70.501359),
  (54, 'GOLF DE MANQUEHUE / PADRE TED HUARD', '114A', 'Manquehue', -33.337079, -70.551525),
  (55, 'EL YUNQUE', '113', 'La Dehesa', -33.337891, -70.499120),
  (56, 'CAMINO EL OFICIO / EL TORDILLO', '114', 'Los Trapenses', -33.347548, -70.538252),
  (57, 'VALLE MONASTERIO 2332', '114', 'Los Trapenses', -33.352825, -70.545777),
  (58, 'AGUAS BLANCAS / AGUAS CLARAS', '114', 'Los Trapenses', -33.358898, -70.546675),
  (59, 'PUNTA DE ÁGUILAS 9300', '114A', 'Manquehue', -33.336361, -70.562333),
  (60, 'CAMINO REAL / PEDRO LIRA URQUIETA', '114A', 'Manquehue', -33.328649, -70.547997),
  (61, 'LOMAS DE LA CRUZ 400', '114', 'Los Trapenses', -33.353040, -70.542987),
  (62, 'LA DEHESA / LA CUMBRE', '113A', 'La Dehesa', -33.322895, -70.518723),
  (63, 'CAMINO EL SOL (REF. N° 3775)', '113', 'La Dehesa', -33.336635, -70.498110),
  (64, 'VALLE ESCONDIDO', '113', 'La Dehesa', -33.340142, -70.492080),
  (65, 'ROTONDA LOS TRAPENSES', '114', 'Los Trapenses', -33.343064, -70.546146),
  (66, 'CAMINO TURÍSTICO / RAÚL LABBÉ', '116A', 'San Enrique', -33.368526, -70.519857),
  (67, 'PARQUE LAS HUALTATAS', '113A', 'La Dehesa', -33.350541, -70.533751),
  (68, 'AGUAS CLARAS 350', '114', 'Los Trapenses', -33.355255, -70.546554),
  (69, 'CAMINO EL QUILLAY', '113', 'La Dehesa', -33.342874, -70.498981)
on conflict (tramo_n) do update set
  nombre    = excluded.nombre,
  cuadrante = excluded.cuadrante,
  sector    = excluded.sector,
  latitud   = excluded.latitud,
  longitud  = excluded.longitud;


-- ==================== 005_seed_pdo_ejemplo.sql ====================
-- ============================================================
-- Halcón — Carga de datos/PDO_Dia_ejemplo.csv (OPCIONAL, solo para pruebas)
-- En producción el supervisor carga el PDO real cada día desde la
-- pantalla "Cargar PDO" (README §6.9) — este script es solo para tener
-- datos de prueba y ver la app funcionando de inmediato.
--
-- El CSV de ejemplo usa la fecha 2026-08-05. Si estás probando en otra
-- fecha, cambia el valor de la variable :fecha más abajo (o reemplaza
-- '2026-08-05' por CURRENT_DATE en los 15 INSERT).
-- ============================================================

insert into public.pdo_dia (fecha, turno, halcon_n, tramo_n, hora) values
  ('2026-08-05', 'A', '2', 68, '09:10'),
  ('2026-08-05', 'A', '2', 15, '10:30'),
  ('2026-08-05', 'A', '2', 31, '11:30'),
  ('2026-08-05', 'A', '2', 27, '13:00'),
  ('2026-08-05', 'B', '5', 23, '14:20'),
  ('2026-08-05', 'B', '5', 68, '16:00'),
  ('2026-08-05', 'B', '5', 15, '19:00'),
  ('2026-08-05', 'B', '5', 31, '20:15'),
  ('2026-08-05', 'B', '5', 27, '21:10'),
  ('2026-08-05', 'N', '1', 23, '22:20'),
  ('2026-08-05', 'N', '1', 66, '23:30'),
  ('2026-08-05', 'N', '1', 68, '00:30'),
  ('2026-08-05', 'N', '1', 15, '01:30'),
  ('2026-08-05', 'N', '1', 31, '04:00'),
  ('2026-08-05', 'N', '1', 27, '05:30');


-- ==================== 006_gps_registro.sql ====================
-- ============================================================
-- Halcón — Ubicación GPS del vuelo (README §7)
-- Agrega latitud/longitud a registro_vuelos. La app captura el GPS del
-- dispositivo al confirmar el vuelo (navigator.geolocation); el Panel de
-- Supervisión enlaza esas coordenadas a Google Maps.
--
-- Columnas NULLABLES a propósito: la captura es "best effort" — si el
-- operador niega el permiso o no hay señal, el vuelo se guarda sin ubicación.
--
-- Ejecutar DESPUÉS de 001_schema.sql (idempotente; seguro de re-ejecutar).
-- ============================================================

alter table public.registro_vuelos
  add column if not exists latitud  numeric(9,6),
  add column if not exists longitud numeric(9,6);

comment on column public.registro_vuelos.latitud  is 'Latitud capturada por GPS del dispositivo al confirmar el vuelo (nullable).';
comment on column public.registro_vuelos.longitud is 'Longitud capturada por GPS del dispositivo al confirmar el vuelo (nullable).';

