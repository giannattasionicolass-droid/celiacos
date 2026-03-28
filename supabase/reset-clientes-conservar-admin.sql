begin;

do $$
declare
  admin_email constant text := 'celiashopazul@gmail.com';
  admin_user_id uuid;
  columnas_pedido text[] := array[]::text[];
  expresion_usuario_pedido text;
begin
  select id
  into admin_user_id
  from auth.users
  where lower(email) = lower(admin_email)
  limit 1;

  if admin_user_id is null then
    raise exception 'No se encontro el usuario admin con email % en auth.users', admin_email;
  end if;

  if exists (
    select 1
    from information_schema.tables
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
        admin_user_id::text
      );
    else
      delete from public.pedidos;
    end if;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'perfiles'
  ) then
    delete from public.perfiles
    where id is distinct from admin_user_id;
  end if;

  delete from auth.identities
  where user_id is distinct from admin_user_id;

  delete from auth.users
  where id is distinct from admin_user_id;
end $$;

commit;
