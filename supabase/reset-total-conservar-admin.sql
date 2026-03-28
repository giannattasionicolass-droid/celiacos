-- ============================================================
-- RESET TOTAL CELIASHOP (CONSERVAR SOLO ADMIN)
-- Ejecutar en Supabase > SQL Editor
-- Resultado esperado:
-- - productos: vacio
-- - ventas/pedidos: vacio
-- - inventario_movimientos: vacio
-- - cuentas: solo admin
-- - perfiles: solo admin
-- ============================================================

begin;

do $$
declare
  admin_email constant text := 'celiashopazul@gmail.com';
  admin_user_id uuid;
  v_deleted_inventario integer := 0;
  v_deleted_pedidos integer := 0;
  v_deleted_productos integer := 0;
  v_deleted_perfiles integer := 0;
  v_deleted_identities integer := 0;
  v_deleted_users integer := 0;
begin
  select id
  into admin_user_id
  from auth.users
  where lower(email) = lower(admin_email)
  limit 1;

  if admin_user_id is null then
    raise exception 'No se encontro el admin con email % en auth.users', admin_email;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'inventario_movimientos'
  ) then
    delete from public.inventario_movimientos;
    get diagnostics v_deleted_inventario = row_count;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'pedidos'
  ) then
    delete from public.pedidos;
    get diagnostics v_deleted_pedidos = row_count;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'productos'
  ) then
    delete from public.productos;
    get diagnostics v_deleted_productos = row_count;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'perfiles'
  ) then
    delete from public.perfiles
    where id is distinct from admin_user_id;
    get diagnostics v_deleted_perfiles = row_count;
  end if;

  delete from auth.identities
  where user_id is distinct from admin_user_id;
  get diagnostics v_deleted_identities = row_count;

  delete from auth.users
  where id is distinct from admin_user_id;
  get diagnostics v_deleted_users = row_count;

  raise notice 'Reset total OK. inventario=% pedidos=% productos=% perfiles=% identities=% users=%',
    v_deleted_inventario,
    v_deleted_pedidos,
    v_deleted_productos,
    v_deleted_perfiles,
    v_deleted_identities,
    v_deleted_users;
end $$;

commit;
