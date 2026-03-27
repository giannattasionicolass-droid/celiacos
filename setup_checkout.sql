-- ============================================================
-- CeliaShop: normalizar checkout y tabla pedidos
-- Ejecutar completo en Supabase > SQL Editor
-- ============================================================

create extension if not exists "pgcrypto";

-- 1. Crear la tabla si no existe
create table if not exists public.pedidos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid,
  total           numeric(12,2) not null default 0,
  direccion_envio text not null default '',
  email           text,
  telefono        text,
  estado          text not null default 'Pendiente',
  fecha           timestamptz not null default now(),
  productos       jsonb not null default '[]'::jsonb
);

-- 2. Completar columnas faltantes en instalaciones viejas
alter table public.pedidos add column if not exists id uuid default gen_random_uuid();
alter table public.pedidos add column if not exists user_id uuid;
alter table public.pedidos add column if not exists total numeric(12,2) not null default 0;
alter table public.pedidos add column if not exists direccion_envio text not null default '';
alter table public.pedidos add column if not exists email text;
alter table public.pedidos add column if not exists telefono text;
alter table public.pedidos add column if not exists estado text not null default 'Pendiente';
alter table public.pedidos add column if not exists fecha timestamptz not null default now();
alter table public.pedidos add column if not exists productos jsonb not null default '[]'::jsonb;

-- 3. Migrar datos desde nombres viejos si existen
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pedidos' and column_name = 'perfil_id'
  ) then
    execute 'update public.pedidos set user_id = coalesce(user_id, perfil_id) where user_id is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pedidos' and column_name = 'usuario_id'
  ) then
    execute 'update public.pedidos set user_id = coalesce(user_id, usuario_id) where user_id is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pedidos' and column_name = 'direccion_entrega'
  ) then
    execute 'update public.pedidos set direccion_envio = coalesce(nullif(direccion_envio, ''''), direccion_entrega)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pedidos' and column_name = 'direccion'
  ) then
    execute 'update public.pedidos set direccion_envio = coalesce(nullif(direccion_envio, ''''), direccion)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pedidos' and column_name = 'created_at'
  ) then
    execute 'update public.pedidos set fecha = coalesce(fecha, created_at)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pedidos' and column_name = 'items'
  ) then
    execute 'update public.pedidos set productos = coalesce(productos, items, ''[]''::jsonb)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pedidos' and column_name = 'carrito'
  ) then
    execute 'update public.pedidos set productos = coalesce(productos, carrito, ''[]''::jsonb)';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'perfiles'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'perfiles' and column_name = 'email'
    ) then
      execute 'update public.pedidos p set email = coalesce(p.email, pf.email) from public.perfiles pf where pf.id = p.user_id';
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'perfiles' and column_name = 'telefono'
    ) then
      execute 'update public.pedidos p set telefono = coalesce(p.telefono, pf.telefono) from public.perfiles pf where pf.id = p.user_id';
    end if;
  end if;
end $$;

-- 4. Asegurar PK si la tabla vieja no la tenía
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pedidos'::regclass
      and contype = 'p'
  ) then
    alter table public.pedidos add primary key (id);
  end if;
end $$;

-- 5. Índices
create index if not exists pedidos_user_id_idx on public.pedidos(user_id);
create index if not exists pedidos_fecha_idx on public.pedidos(fecha desc);

-- 6. Políticas y permisos
alter table public.pedidos enable row level security;

drop function if exists public.es_admin_email();
create or replace function public.es_admin_email()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'giannattasio.nicolas@hotmail.com';
$$;

drop policy if exists "pedidos_select_own" on public.pedidos;
drop policy if exists "pedidos_insert_own" on public.pedidos;
drop policy if exists "pedidos_update_own" on public.pedidos;
drop policy if exists "pedidos_select_admin_or_own" on public.pedidos;
drop policy if exists "pedidos_insert_admin_or_own" on public.pedidos;
drop policy if exists "pedidos_update_admin_or_own" on public.pedidos;

create policy "pedidos_select_admin_or_own"
on public.pedidos
for select
to authenticated
using (public.es_admin_email() or auth.uid() = user_id);

create policy "pedidos_insert_admin_or_own"
on public.pedidos
for insert
to authenticated
with check (public.es_admin_email() or auth.uid() = user_id);

create policy "pedidos_update_admin_or_own"
on public.pedidos
for update
to authenticated
using (public.es_admin_email() or auth.uid() = user_id)
with check (public.es_admin_email() or auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select on table public.pedidos to authenticated;
grant insert, update on table public.pedidos to authenticated;

-- 7. Función RPC opcional para el frontend
drop function if exists public.crear_pedido(uuid, jsonb, numeric, text);
drop function if exists public.crear_pedido(uuid, jsonb, numeric, text, text, text);

create or replace function public.crear_pedido(
  p_perfil_id uuid,
  p_productos jsonb,
  p_total numeric,
  p_direccion text,
  p_email text default null,
  p_telefono text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.pedidos (user_id, productos, total, direccion_envio, email, telefono, estado, fecha)
  values (p_perfil_id, coalesce(p_productos, '[]'::jsonb), coalesce(p_total, 0), coalesce(p_direccion, ''), p_email, p_telefono, 'Pendiente', now())
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.crear_pedido(uuid, jsonb, numeric, text, text, text) to authenticated;

notify pgrst, 'reload schema';
