-- =========================================
-- TABLA: documentos_unidad
-- Fotos y archivos de presupuestos, diagnósticos, etc.
-- =========================================
create table documentos_unidad (
  id uuid primary key default gen_random_uuid(),
  unidad_id uuid references unidades(id) not null,
  tipo text not null check (tipo in ('presupuesto','diagnostico','otro')),
  titulo text not null,
  url text not null,
  notas text,
  created_at timestamptz default now()
);
create index idx_documentos_unidad on documentos_unidad(unidad_id, created_at desc);
alter table documentos_unidad enable row level security;
create policy "Acceso publico documentos" on documentos_unidad for all using (true) with check (true);

-- Storage bucket para documentos
insert into storage.buckets (id, name, public)
values ('flota-documentos', 'flota-documentos', true)
on conflict (id) do nothing;

create policy "Lectura publica documentos" on storage.objects
  for select using (bucket_id = 'flota-documentos');
create policy "Subida publica documentos" on storage.objects
  for insert with check (bucket_id = 'flota-documentos');
create policy "Borrado publico documentos" on storage.objects
  for delete using (bucket_id = 'flota-documentos');

-- =========================================
-- TABLA: push_subscriptions
-- Suscripciones push de cada dispositivo/chofer
-- =========================================
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  chofer_id uuid references choferes(id),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);
create index idx_push_chofer on push_subscriptions(chofer_id);
alter table push_subscriptions enable row level security;
create policy "Acceso publico push" on push_subscriptions for all using (true) with check (true);
