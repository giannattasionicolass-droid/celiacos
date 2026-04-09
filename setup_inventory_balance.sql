-- Inventario + Balance integral para Celiashop
-- Ejecutar en Supabase SQL Editor

alter table if exists public.productos
  add column if not exists costo_fabrica numeric(12,2) not null default 0,
  add column if not exists margen_ganancia numeric(6,2) not null default 60;

alter table if exists public.pedidos
  add column if not exists stock_descontado boolean not null default false;

create table if not exists public.inventario_movimientos (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'salida', 'ajuste')),
  cantidad numeric(12,2) not null check (cantidad > 0),
  costo_unitario numeric(12,2) not null default 0,
  precio_venta_unitario numeric(12,2) not null default 0,
  referencia_pedido_id uuid null references public.pedidos(id) on delete set null,
  detalle text,
  origen text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventario_movimientos_producto on public.inventario_movimientos(producto_id);
create index if not exists idx_inventario_movimientos_fecha on public.inventario_movimientos(created_at desc);
create index if not exists idx_inventario_movimientos_tipo on public.inventario_movimientos(tipo);

alter table public.inventario_movimientos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inventario_movimientos'
      and policyname = 'inventario_movimientos_select_authenticated'
  ) then
    create policy inventario_movimientos_select_authenticated
      on public.inventario_movimientos
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inventario_movimientos'
      and policyname = 'inventario_movimientos_insert_authenticated'
  ) then
    create policy inventario_movimientos_insert_authenticated
      on public.inventario_movimientos
      for insert
      to authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'inventario_movimientos'
      and policyname = 'inventario_movimientos_update_authenticated'
  ) then
    create policy inventario_movimientos_update_authenticated
      on public.inventario_movimientos
      for update
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

create or replace function public.fn_aplicar_movimiento_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo = 'entrada' then
    update public.productos
    set stock = greatest(0, coalesce(stock, 0) + new.cantidad)
    where id = new.producto_id;
  elsif new.tipo = 'salida' then
    update public.productos
    set stock = greatest(0, coalesce(stock, 0) - new.cantidad)
    where id = new.producto_id;
  else
    update public.productos
    set stock = greatest(0, coalesce(stock, 0) + new.cantidad)
    where id = new.producto_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_aplicar_movimiento_stock on public.inventario_movimientos;
create trigger trg_aplicar_movimiento_stock
after insert on public.inventario_movimientos
for each row
execute function public.fn_aplicar_movimiento_stock();

create or replace function public.fn_descontar_stock_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  estado_actual text;
  linea jsonb;
  producto_id uuid;
  cantidad_linea numeric;
  precio_linea numeric;
  costo_linea numeric;
  productos_json jsonb;
begin
  estado_actual := coalesce(new.estado, 'Pendiente');

  if coalesce(new.stock_descontado, false) then
    return new;
  end if;

  if upper(estado_actual) = 'CANCELADO' then
    return new;
  end if;

  productos_json := coalesce(new.productos, '[]'::jsonb);

  if jsonb_typeof(productos_json) <> 'array' then
    return new;
  end if;

  for linea in select * from jsonb_array_elements(productos_json)
  loop
    begin
      producto_id := nullif(linea->>'id', '')::uuid;
    exception when others then
      producto_id := null;
    end;

    if producto_id is null then
      continue;
    end if;

    cantidad_linea := greatest(0, coalesce((linea->>'cantidad')::numeric, 0));
    if cantidad_linea <= 0 then
      continue;
    end if;

    precio_linea := coalesce((linea->>'precio')::numeric, 0);
    select coalesce(costo_fabrica, 0) into costo_linea
    from public.productos
    where id = producto_id;

    insert into public.inventario_movimientos (
      producto_id,
      tipo,
      cantidad,
      costo_unitario,
      precio_venta_unitario,
      referencia_pedido_id,
      detalle,
      origen,
      created_by
    ) values (
      producto_id,
      'salida',
      cantidad_linea,
      coalesce(costo_linea, 0),
      coalesce(precio_linea, 0),
      new.id,
      'Descuento automático por venta',
      'pedido_automatico',
      new.user_id
    );
  end loop;

  update public.pedidos
  set stock_descontado = true
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists trg_descontar_stock_pedido on public.pedidos;
create trigger trg_descontar_stock_pedido
after insert or update of estado, productos, stock_descontado on public.pedidos
for each row
execute function public.fn_descontar_stock_pedido();

create or replace function public.resumen_balance_periodo(p_dias integer default 30)
returns table (
  producto_id uuid,
  producto_nombre text,
  categoria text,
  stock_actual numeric,
  entrante numeric,
  saliente numeric,
  vendidos numeric,
  costo_fabrica numeric,
  precio_venta numeric,
  margen_objetivo numeric,
  margen_real numeric,
  valor_stock_costo numeric,
  valor_stock_venta numeric,
  costo_ventas_periodo numeric,
  ingresos_ventas_periodo numeric,
  utilidad_bruta_periodo numeric
)
language sql
security definer
set search_path = public
as $$
  with mov as (
    select
      m.producto_id,
      sum(case when m.tipo = 'entrada' and m.created_at >= now() - make_interval(days => p_dias) then m.cantidad else 0 end) as entrante,
      sum(case when m.tipo = 'salida' and m.created_at >= now() - make_interval(days => p_dias) then m.cantidad else 0 end) as saliente,
      sum(case when m.tipo = 'salida' and m.created_at >= now() - make_interval(days => p_dias) then m.cantidad * m.costo_unitario else 0 end) as costo_ventas_periodo,
      sum(case when m.tipo = 'salida' and m.created_at >= now() - make_interval(days => p_dias) then m.cantidad * m.precio_venta_unitario else 0 end) as ingresos_ventas_periodo
    from public.inventario_movimientos m
    group by m.producto_id
  )
  select
    p.id as producto_id,
    p.nombre as producto_nombre,
    p.categoria,
    coalesce(p.stock, 0)::numeric as stock_actual,
    coalesce(m.entrante, 0)::numeric as entrante,
    coalesce(m.saliente, 0)::numeric as saliente,
    coalesce(m.saliente, 0)::numeric as vendidos,
    coalesce(p.costo_fabrica, 0)::numeric as costo_fabrica,
    coalesce(p.precio, 0)::numeric as precio_venta,
    coalesce(p.margen_ganancia, 60)::numeric as margen_objetivo,
    case
      when coalesce(p.costo_fabrica, 0) > 0
        then ((coalesce(p.precio, 0) - coalesce(p.costo_fabrica, 0)) / p.costo_fabrica) * 100
      else 0
    end as margen_real,
    (coalesce(p.stock, 0) * coalesce(p.costo_fabrica, 0))::numeric as valor_stock_costo,
    (coalesce(p.stock, 0) * coalesce(p.precio, 0))::numeric as valor_stock_venta,
    coalesce(m.costo_ventas_periodo, 0)::numeric as costo_ventas_periodo,
    coalesce(m.ingresos_ventas_periodo, 0)::numeric as ingresos_ventas_periodo,
    (coalesce(m.ingresos_ventas_periodo, 0) - coalesce(m.costo_ventas_periodo, 0))::numeric as utilidad_bruta_periodo
  from public.productos p
  left join mov m on m.producto_id = p.id
  order by p.nombre asc;
$$;
