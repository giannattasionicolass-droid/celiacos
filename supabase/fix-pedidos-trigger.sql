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

notify pgrst, 'reload schema';
