-- ============================================================
-- FIX CRITICOS CELIASHOP
-- Ejecutar completo en Supabase > SQL Editor
-- Soluciona:
-- 1) Error al guardar pedido (checkout)
-- 2) RPC reset_test_data para limpieza de clientes de prueba
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- PEDIDOS / CHECKOUT ----------
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

alter table public.pedidos add column if not exists id uuid default gen_random_uuid();
alter table public.pedidos add column if not exists user_id uuid;
alter table public.pedidos add column if not exists total numeric(12,2) not null default 0;
alter table public.pedidos add column if not exists direccion_envio text not null default '';
alter table public.pedidos add column if not exists email text;
alter table public.pedidos add column if not exists telefono text;
alter table public.pedidos add column if not exists estado text not null default 'Pendiente';
alter table public.pedidos add column if not exists fecha timestamptz not null default now();
alter table public.pedidos add column if not exists productos jsonb not null default '[]'::jsonb;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'pedidos' and column_name = 'perfil_id'
  ) then
    execute 'update public.pedidos set user_id = coalesce(user_id, perfil_id) where user_id is null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'pedidos' and column_name = 'usuario_id'
  ) then
    execute 'update public.pedidos set user_id = coalesce(user_id, usuario_id) where user_id is null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'pedidos' and column_name = 'direccion_entrega'
  ) then
    execute 'update public.pedidos set direccion_envio = coalesce(nullif(direccion_envio, ''''), direccion_entrega)';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'pedidos' and column_name = 'direccion'
  ) then
    execute 'update public.pedidos set direccion_envio = coalesce(nullif(direccion_envio, ''''), direccion)';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'pedidos' and column_name = 'created_at'
  ) then
    execute 'update public.pedidos set fecha = coalesce(fecha, created_at)';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'pedidos' and column_name = 'items'
  ) then
    execute 'update public.pedidos set productos = coalesce(productos, items, ''[]''::jsonb)';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'pedidos' and column_name = 'carrito'
  ) then
    execute 'update public.pedidos set productos = coalesce(productos, carrito, ''[]''::jsonb)';
  end if;
end $$;

create index if not exists pedidos_user_id_idx on public.pedidos(user_id);
create index if not exists pedidos_fecha_idx on public.pedidos(fecha desc);

alter table public.pedidos enable row level security;

drop function if exists public.es_admin_email();
create or replace function public.es_admin_email()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'giannattasio.nicolas@hotmail.com';
$$;

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

-- ---------- RESET CLIENTES PRUEBA (RPC) ----------
drop function if exists public.reset_test_data(text);

create or replace function public.reset_test_data(
  preserve_admin_email text default 'giannattasio.nicolas@hotmail.com'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_admin_email text := lower(trim(coalesce(preserve_admin_email, 'giannattasio.nicolas@hotmail.com')));
  v_calling_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_admin_id uuid;
  v_deleted_pedidos integer := 0;
  v_deleted_perfiles integer := 0;
  v_deleted_users integer := 0;
  columnas_pedido text[] := array[]::text[];
  expresion_usuario_pedido text;
begin
  if v_calling_email = '' then
    raise exception 'No hay sesion autenticada para ejecutar reset_test_data.';
  end if;

  if v_calling_email <> v_admin_email then
    raise exception 'Solo un administrador puede resetear los datos de prueba.';
  end if;

  select id
  into v_admin_id
  from auth.users
  where lower(email) = v_admin_email
  limit 1;

  if v_admin_id is null then
    raise exception 'No se encontro el usuario admin % en auth.users.', v_admin_email;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'pedidos'
  ) then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pedidos' and column_name = 'user_id') then
      columnas_pedido := array_append(columnas_pedido, 'user_id');
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pedidos' and column_name = 'perfil_id') then
      columnas_pedido := array_append(columnas_pedido, 'perfil_id');
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pedidos' and column_name = 'usuario_id') then
      columnas_pedido := array_append(columnas_pedido, 'usuario_id');
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pedidos' and column_name = 'cliente_id') then
      columnas_pedido := array_append(columnas_pedido, 'cliente_id');
    end if;

    if array_length(columnas_pedido, 1) is not null then
      select 'coalesce(' || string_agg(columna, ', ') || ')'
      into expresion_usuario_pedido
      from unnest(columnas_pedido) as columna;

      execute format(
        'delete from public.pedidos where %s is distinct from %L::uuid',
        expresion_usuario_pedido,
        v_admin_id::text
      );
      get diagnostics v_deleted_pedidos = row_count;
    else
      delete from public.pedidos;
      get diagnostics v_deleted_pedidos = row_count;
    end if;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'perfiles'
  ) then
    delete from public.perfiles
    where id is distinct from v_admin_id;
    get diagnostics v_deleted_perfiles = row_count;
  end if;

  delete from auth.identities
  where user_id is distinct from v_admin_id;

  delete from auth.users
  where id is distinct from v_admin_id;
  get diagnostics v_deleted_users = row_count;

  return jsonb_build_object(
    'ok', true,
    'preserved_admin_email', v_admin_email,
    'preserved_admin_id', v_admin_id,
    'pedidos_eliminados', v_deleted_pedidos,
    'perfiles_eliminados', v_deleted_perfiles,
    'usuarios_eliminados', v_deleted_users
  );
end;
$$;

revoke all on function public.reset_test_data(text) from public;
grant execute on function public.reset_test_data(text) to authenticated;

notify pgrst, 'reload schema';
