-- Registra el nombre del supervisor de torre de control SCL
-- que los operadores turno N contactan cada noche (requisito DGAC).
-- Una entrada por fecha operativa.

create table if not exists public.torre_scl (
  fecha        date primary key,
  nombre       text not null,
  halcon_n     text not null,
  created_at   timestamptz default now()
);

alter table public.torre_scl enable row level security;

create policy "torre_scl_all" on public.torre_scl
  for all using (true) with check (true);
