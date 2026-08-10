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
