-- Ejecutar en Supabase SQL Editor
-- Deja solo al admin y borra clientes/pedidos de prueba.

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
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'pedidos' and column_name = 'user_id'
    ) then
      columnas_pedido := array_append(columnas_pedido, 'user_id');
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'pedidos' and column_name = 'perfil_id'
    ) then
      columnas_pedido := array_append(columnas_pedido, 'perfil_id');
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'pedidos' and column_name = 'usuario_id'
    ) then
      columnas_pedido := array_append(columnas_pedido, 'usuario_id');
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'pedidos' and column_name = 'cliente_id'
    ) then
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
