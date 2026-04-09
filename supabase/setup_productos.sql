-- Tabla base de productos para un proyecto Supabase nuevo.
-- Crea catalogo, permisos y una carga inicial minima.

begin;

create extension if not exists "pgcrypto";

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  precio numeric(12,2) not null default 0,
  imagen_url text not null default '',
  stock numeric(12,2) not null default 0,
  categoria text not null default 'Sin categoria',
  descripcion text,
  activo boolean not null default true,
  costo_fabrica numeric(12,2) not null default 0,
  margen_ganancia numeric(6,2) not null default 60,
  en_oferta boolean not null default false,
  precio_oferta numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.productos add column if not exists nombre text;
alter table public.productos add column if not exists precio numeric(12,2) not null default 0;
alter table public.productos add column if not exists imagen_url text not null default '';
alter table public.productos add column if not exists stock numeric(12,2) not null default 0;
alter table public.productos add column if not exists categoria text not null default 'Sin categoria';
alter table public.productos add column if not exists descripcion text;
alter table public.productos add column if not exists activo boolean not null default true;
alter table public.productos add column if not exists costo_fabrica numeric(12,2) not null default 0;
alter table public.productos add column if not exists margen_ganancia numeric(6,2) not null default 60;
alter table public.productos add column if not exists en_oferta boolean not null default false;
alter table public.productos add column if not exists precio_oferta numeric(12,2) not null default 0;
alter table public.productos add column if not exists created_at timestamptz not null default now();
alter table public.productos add column if not exists updated_at timestamptz not null default now();

create index if not exists productos_nombre_idx on public.productos(nombre);
create index if not exists productos_categoria_idx on public.productos(categoria);
create index if not exists productos_activo_idx on public.productos(activo);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_productos_updated_at on public.productos;

create trigger set_productos_updated_at
before update on public.productos
for each row
execute function public.set_updated_at();

alter table public.productos enable row level security;

create or replace function public.es_admin_email()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'giannattasio.nicolas@hotmail.com';
$$;

drop policy if exists "productos_select_public" on public.productos;
drop policy if exists "productos_insert_admin" on public.productos;
drop policy if exists "productos_update_admin" on public.productos;
drop policy if exists "productos_delete_admin" on public.productos;

create policy "productos_select_public"
on public.productos
for select
to anon, authenticated
using (true);

create policy "productos_insert_admin"
on public.productos
for insert
to authenticated
with check (public.es_admin_email());

create policy "productos_update_admin"
on public.productos
for update
to authenticated
using (public.es_admin_email())
with check (public.es_admin_email());

create policy "productos_delete_admin"
on public.productos
for delete
to authenticated
using (public.es_admin_email());

grant usage on schema public to anon, authenticated;
grant select on table public.productos to anon, authenticated;
grant insert, update, delete on table public.productos to authenticated;

insert into public.productos (
  nombre,
  precio,
  categoria,
  descripcion,
  imagen_url,
  stock,
  activo,
  costo_fabrica,
  margen_ganancia,
  en_oferta,
  precio_oferta
)
select *
from (
  values
    ('Pan de molde sin gluten', 1850, 'Panificados', 'Pan de molde esponjoso, ideal para sandwiches. Sin TACC.', '', 12, true, 1100, 68, false, 0),
    ('Pan de hamburguesa sin gluten', 950, 'Panificados', 'Pack de 4 panes de hamburguesa suaves y sin gluten.', '', 10, true, 560, 70, false, 0),
    ('Facturas sin gluten', 2200, 'Panificados', 'Surtido de medialunas y vigilantes recien horneados.', '', 8, true, 1350, 63, false, 0),
    ('Fideos tallarines sin gluten', 1100, 'Pastas', 'Fideos de arroz y maiz con buena textura. Aptos celiaquia.', '', 20, true, 650, 69, false, 0),
    ('Fideos tirabuzon sin gluten', 1100, 'Pastas', 'Tirabuzones de arroz ideales para salsas intensas.', '', 20, true, 650, 69, false, 0),
    ('Noquis sin gluten', 1400, 'Pastas', 'Noquis de papa listos para cocinar. Sin TACC.', '', 14, true, 820, 71, false, 0),
    ('Galletitas de arroz', 750, 'Galletitas', 'Galletitas crocantes de arroz para snack o desayuno.', '', 18, true, 430, 74, false, 0),
    ('Galletitas de chocolate sin gluten', 980, 'Galletitas', 'Galletitas dulces con chips de chocolate. Sin TACC.', '', 16, true, 580, 69, true, 890),
    ('Alfajores sin gluten', 1650, 'Galletitas', 'Alfajores rellenos de dulce de leche con coco.', '', 12, true, 970, 70, false, 0),
    ('Premezcla para torta', 1300, 'Postres y Dulces', 'Premezcla lista para una torta humeda de vainilla.', '', 15, true, 760, 71, false, 0),
    ('Brownie sin gluten', 1500, 'Postres y Dulces', 'Premezcla para brownie de chocolate intenso.', '', 15, true, 890, 68, true, 1350),
    ('Bizcochos de grasa sin gluten', 1200, 'Panificados', 'Bizcochos crujientes y sabrosos para mate o desayuno.', '', 10, true, 710, 69, false, 0),
    ('Harina de arroz', 850, 'Harinas', 'Harina fina ideal para rebozados y reposteria.', '', 22, true, 500, 70, false, 0),
    ('Premezcla para pan', 1100, 'Harinas', 'Premezcla especial para pan casero sin gluten.', '', 18, true, 650, 69, false, 0),
    ('Harina de mandioca', 720, 'Harinas', 'Harina de mandioca versatil para cocina sin gluten.', '', 20, true, 420, 71, false, 0),
    ('Tostadas de maiz', 880, 'Galletitas', 'Tostadas crocantes de maiz, ideales para desayuno.', '', 17, true, 510, 72, false, 0)
) as seed(
  nombre,
  precio,
  categoria,
  descripcion,
  imagen_url,
  stock,
  activo,
  costo_fabrica,
  margen_ganancia,
  en_oferta,
  precio_oferta
)
where not exists (select 1 from public.productos limit 1);

commit;