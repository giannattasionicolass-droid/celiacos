import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { enviarEmailPedido } from './orderNotifications';
import { ShoppingCart, User, ShieldCheck, Trash2, ShoppingBag, ArrowLeft, Plus, Minus, ChevronLeft, ChevronRight, Search, CheckCircle, X, Package, Truck, House } from 'lucide-react';

const URL_LOGO = "https://fsgssvindtmryytpgmxg.supabase.co/storage/v1/object/public/assets/Gemini_Generated_Image_cjh3kicjh3kicjh3.png";
const ESTADOS_PEDIDO = ['Pendiente', 'Confirmado', 'Enviado', 'Entregado', 'Cancelado'];

const CATEGORIAS_PREDEFINIDAS = [
  'Harinas',
  'Pastas',
  'Panificados',
  'Almidones y Fécula',
  'Condimentos y Especias',
  'Aderezos y Salsas',
  'Bebidas',
  'Snacks',
  'Postres y Dulces',
  'Productos Lácteos',
  'Desayuno'
];

const DATOS_CELIASHOP = {
  razonSocial: 'CELIASHOP SRL',
  cuit: '30-71234567-8',
  direccion: 'Buenos Aires, Argentina',
  telefono: '+54 11 4000-0000',
  email: 'celiashopazul@gmail.com',
  condicionIva: 'Responsable Inscripto'
};

const normalizarProductoPedido = (item = {}) => {
  const productoBase = item?.producto && typeof item.producto === 'object' ? item.producto : {};
  const cantidad = Number(
    item?.cantidad ?? item?.quantity ?? item?.qty ?? item?.cant ?? productoBase?.cantidad ?? productoBase?.quantity ?? 1
  ) || 1;
  const cantidadOriginalDetectada = Number(
    item?.cantidad_original ?? item?.cantidad_solicitada ?? item?.cantidad_pedida ?? productoBase?.cantidad_original ?? cantidad
  ) || cantidad;
  const cantidadNormalizada = Math.max(1, cantidad);
  const cantidadOriginal = Math.max(cantidadNormalizada, cantidadOriginalDetectada);
  const precio = Number(
    item?.precio ?? item?.price ?? item?.unit_price ?? item?.precio_unitario ?? productoBase?.precio ?? productoBase?.price ?? 0
  ) || 0;

  return {
    id: item?.id || item?.producto_id || productoBase?.id || null,
    nombre: item?.nombre || item?.descripcion || item?.name || productoBase?.nombre || productoBase?.descripcion || productoBase?.name || 'Producto sin nombre',
    cantidad: cantidadNormalizada,
    cantidad_original: cantidadOriginal,
    precio,
    imagen_url: item?.imagen_url || item?.imagen || item?.image || item?.image_url || productoBase?.imagen_url || productoBase?.imagen || productoBase?.image || productoBase?.image_url || '',
    faltante: Boolean(item?.faltante ?? item?.anulado ?? item?.descontado ?? item?.omitido ?? productoBase?.faltante ?? productoBase?.anulado ?? false),
    anulado: Boolean(item?.anulado ?? item?.faltante ?? item?.descontado ?? item?.omitido ?? productoBase?.anulado ?? productoBase?.faltante ?? false),
    ajustado_por_admin: Boolean(item?.ajustado_por_admin ?? productoBase?.ajustado_por_admin ?? item?.faltante ?? item?.anulado ?? false),
    motivo_ajuste: item?.motivo_ajuste || item?.motivo || productoBase?.motivo_ajuste || productoBase?.motivo || '',
  };
};

const extraerArrayProductos = (valor) => {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor;

  if (typeof valor === 'string') {
    try {
      const parsed = JSON.parse(valor);
      return extraerArrayProductos(parsed);
    } catch {
      return [];
    }
  }

  if (typeof valor === 'object') {
    const claves = ['productos', 'items', 'detalle', 'carrito', 'lineas', 'line_items', 'order_items'];
    for (const clave of claves) {
      if (Array.isArray(valor?.[clave])) return valor[clave];
      if (typeof valor?.[clave] === 'string') {
        const parsed = extraerArrayProductos(valor[clave]);
        if (parsed.length) return parsed;
      }
    }
  }

  return [];
};

const obtenerProductosPedido = (pedido) => {
  const candidatos = [
    pedido?.productos,
    pedido?.items,
    pedido?.detalle,
    pedido?.carrito,
    pedido?.line_items,
    pedido?.lineas,
    pedido?.order_items,
  ];

  for (const valor of candidatos) {
    const productos = extraerArrayProductos(valor);
    if (productos.length > 0) {
      return productos.map((item) => normalizarProductoPedido(item));
    }
  }

  return [];
};

const normalizarEstadoPedido = (valorA, valorB) => {
  const estadosValidos = new Set(ESTADOS_PEDIDO.map((e) => e.toLowerCase()));
  const candidatos = [valorA, valorB]
    .map((v) => String(v || '').trim())
    .filter(Boolean);

  for (const candidato of candidatos) {
    const lower = candidato.toLowerCase();
    if (estadosValidos.has(lower)) {
      return ESTADOS_PEDIDO.find((e) => e.toLowerCase() === lower) || 'Pendiente';
    }
  }
  return 'Pendiente';
};

const obtenerEstadoPedido = (pedido) => normalizarEstadoPedido(pedido?.estado, pedido?.status);
const obtenerTotalPedido = (pedido) => Number(pedido?.total ?? pedido?.monto ?? pedido?.importe ?? pedido?.precio_total ?? 0);
const obtenerDireccionPedido = (pedido) => pedido?.direccion_entrega || pedido?.direccion || pedido?.direccion_envio || pedido?.domicilio || 'Sin dirección cargada';
const obtenerFechaPedido = (pedido) => pedido?.created_at || pedido?.fecha || null;
const obtenerNumeroPedido = (pedido) => String(pedido?.id || 'sin-id').replace(/-/g, '').slice(0, 8).toUpperCase();
const obtenerCantidadItemsPedido = (pedido) => obtenerProductosPedido(pedido).reduce((acc, prod) => (
  acc + (Number(prod?.cantidad ?? prod?.quantity ?? prod?.qty) || 0)
), 0);
const formatearMoneda = (valor) => `$${Number(valor || 0).toFixed(2)}`;
const PEDIDOS_SNAPSHOT_KEY = 'celiashop_pedidos_snapshot';
const CLASE_BASE_ESTADO = 'inline-flex items-center justify-center text-center align-middle leading-none whitespace-nowrap';
const obtenerClaseEstadoPedido = (estado) => {
  const valor = String(estado || '').toLowerCase();
  if (valor === 'pendiente') return `${CLASE_BASE_ESTADO} bg-red-100 text-red-700 ring-1 ring-red-200`;
  if (valor === 'confirmado') return `${CLASE_BASE_ESTADO} bg-blue-100 text-blue-700 ring-1 ring-blue-200`;
  if (valor === 'enviado') return `${CLASE_BASE_ESTADO} bg-amber-100 text-amber-700 ring-1 ring-amber-200`;
  if (valor === 'entregado') return `${CLASE_BASE_ESTADO} bg-green-100 text-green-700 ring-1 ring-green-200`;
  if (valor === 'cancelado') return `${CLASE_BASE_ESTADO} bg-gray-300 text-gray-700 ring-1 ring-gray-400`;
  return `${CLASE_BASE_ESTADO} bg-gray-100 text-gray-700 ring-1 ring-gray-200`;
};

const obtenerVisualEstadoPedido = (estado) => {
  const valor = String(estado || '').toLowerCase();
  if (valor === 'pendiente') {
    return {
      icono: Package,
      claseContenedor: 'bg-amber-100 text-amber-800 ring-2 ring-amber-300',
      claseIcono: 'bg-amber-500 text-white',
      texto: 'Pendiente'
    };
  }
  if (valor === 'confirmado') {
    return {
      icono: CheckCircle,
      claseContenedor: 'bg-blue-100 text-blue-800 ring-2 ring-blue-300',
      claseIcono: 'bg-blue-600 text-white',
      texto: 'Confirmado'
    };
  }
  if (valor === 'enviado') {
    return {
      icono: Truck,
      claseContenedor: 'bg-violet-100 text-violet-800 ring-2 ring-violet-300',
      claseIcono: 'bg-violet-600 text-white',
      texto: 'Enviado'
    };
  }
  if (valor === 'entregado') {
    return {
      icono: House,
      claseContenedor: 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-300',
      claseIcono: 'bg-emerald-600 text-white',
      texto: 'Entregado'
    };
  }
  if (valor === 'cancelado') {
    return {
      icono: X,
      claseContenedor: 'bg-gray-200 text-gray-800 ring-2 ring-gray-400',
      claseIcono: 'bg-gray-600 text-white',
      texto: 'Cancelado'
    };
  }
  return {
    icono: Package,
    claseContenedor: 'bg-gray-100 text-gray-700 ring-2 ring-gray-300',
    claseIcono: 'bg-gray-600 text-white',
    texto: estado || 'Pendiente'
  };
};
const formatearFechaPedido = (pedido) => {
  const fecha = obtenerFechaPedido(pedido);
  if (!fecha) return 'Sin fecha registrada';
  return new Date(fecha).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const escaparHtml = (valor) => String(valor ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const productoFueAjustado = (producto = {}) => Boolean(
  producto?.faltante ||
  producto?.anulado ||
  producto?.descontado ||
  producto?.omitido ||
  producto?.ajustado_por_admin ||
  ((Number(producto?.cantidad_original) || Number(producto?.cantidad) || 0) > (Number(producto?.cantidad) || 0))
);

const construirLineasFactura = (productos = []) => productos.map((prod, index) => {
  const cantidad = Math.max(1, Number(prod?.cantidad) || 1);
  const cantidadOriginal = Math.max(cantidad, Number(prod?.cantidad_original) || cantidad);
  const precioUnitario = Math.max(0, Number(prod?.precio) || 0);
  // subtotalOriginal siempre muestra lo que se pidió (para referencia)
  const subtotalPedido = cantidadOriginal * precioUnitario;
  // subtotalFacturable es lo que REALMENTE se cobra (cantidad entregada)
  const subtotalFacturable = cantidad * precioUnitario;
  const ajustado = productoFueAjustado(prod);
  const faltanteTotal = Boolean(prod?.faltante || prod?.anulado || prod?.descontado || prod?.omitido);
  const ajusteParcial = !faltanteTotal && cantidadOriginal > cantidad;
  const faltanteCantidad = faltanteTotal ? cantidadOriginal : Math.max(0, cantidadOriginal - cantidad);
  const descuentoFaltante = faltanteCantidad * precioUnitario;
  const motivoAjuste = String(
    prod?.motivo_ajuste ||
    (faltanteTotal ? 'Producto faltante' : (ajusteParcial ? `Se entregan ${cantidad} de ${cantidadOriginal}` : ''))
  ).trim();
  return {
    key: prod?.id || `${prod?.nombre || 'producto'}-${index}`,
    id: prod?.id || null,
    descripcion: prod?.nombre || 'Producto sin nombre',
    imagen: prod?.imagen_url || '',
    cantidad,
    cantidadOriginal,
    precioUnitario,
    subtotalPedido,
    subtotalFacturable,
    descuentoFaltante,
    faltanteCantidad,
    facturableCantidad: faltanteTotal ? 0 : cantidad,
    ajustado,
    faltanteTotal,
    ajusteParcial,
    motivoAjuste,
  };
});

const obtenerTotalFacturaDesdeLineas = (lineas = []) => lineas.reduce((acc, item) => acc + (Number(item?.subtotalFacturable) || 0), 0);
const obtenerSubtotalOriginalDesdeLineas = (lineas = []) => lineas.reduce((acc, item) => acc + (Number(item?.subtotalPedido) || 0), 0);
const obtenerItemsFacturablesDesdeLineas = (lineas = []) => lineas.reduce((acc, item) => acc + (Number(item?.facturableCantidad) || 0), 0);
const obtenerDescuentosFaltantesDesdeLineas = (lineas = []) => lineas.reduce((acc, item) => acc + (Number(item?.descuentoFaltante) || 0), 0);

const serializarProductosFactura = (productos = []) => productos.map((producto) => {
  const cantidad = Math.max(1, Number(producto?.cantidad) || 1);
  const cantidadOriginal = Math.max(cantidad, Number(producto?.cantidad_original) || cantidad);
  const precio = Math.max(0, Number(producto?.precio) || 0);
  const faltante = Boolean(producto?.faltante || producto?.anulado || producto?.ajustado_por_admin);
  const faltanteCantidad = Math.max(0, cantidadOriginal - cantidad);
  const motivoPorCantidad = faltanteCantidad > 0 ? `Se entregan ${cantidad} de ${cantidadOriginal}` : '';
  return {
    id: producto?.id || null,
    nombre: String(producto?.nombre || 'Producto sin nombre').trim() || 'Producto sin nombre',
    cantidad,
    cantidad_original: cantidadOriginal,
    precio,
    imagen_url: String(producto?.imagen_url || '').trim(),
    faltante,
    anulado: faltante,
    faltante_cantidad: faltanteCantidad,
    ajustado_por_admin: faltante || faltanteCantidad > 0,
    motivo_ajuste: faltante
      ? (String(producto?.motivo_ajuste || 'Producto faltante').trim() || 'Producto faltante')
      : (String(producto?.motivo_ajuste || motivoPorCantidad).trim()),
  };
});

const imprimirFacturaPedido = (pedido, cliente = {}) => {
  const productos = obtenerProductosPedido(pedido);
  const lineas = construirLineasFactura(productos);
  const clienteId = String(cliente?.id || pedido?.user_id || pedido?.perfil_id || pedido?.usuario_id || pedido?.cliente_id || 'sin-id');
  const nombreCliente = [cliente?.nombre, cliente?.apellido].filter(Boolean).join(' ').trim() || 'Cliente CeliaShop';
  const emailCliente = pedido?.email || cliente?.email || 'No informado';
  const telefonoCliente = pedido?.telefono || cliente?.telefono || 'No informado';
  const cuitCliente = cliente?.cuit || pedido?.cuit || 'No informado';
  const direccionCliente = obtenerDireccionPedido(pedido) || cliente?.direccion_envio || 'No informada';

  const filas = lineas.length === 0
    ? '<tr><td colspan="5" style="padding:12px;border:1px solid #e5e7eb;font-size:12px;color:#6b7280;">Sin productos disponibles</td></tr>'
    : lineas.map((item) => {
        const imagenHtml = item.imagen
          ? `<img src="${escaparHtml(item.imagen)}" alt="${escaparHtml(item.descripcion)}" style="width:56px;height:56px;object-fit:cover;border-radius:10px;display:block;margin:0 auto;" />`
          : '<div style="width:56px;height:56px;border-radius:10px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:20px;margin:0 auto;">&#128230;</div>';
        return `<tr>
          <td style="padding:10px;border:1px solid #e5e7eb;text-align:center;vertical-align:middle;">${imagenHtml}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;font-size:12px;font-weight:700;vertical-align:middle;color:#111827;">${escaparHtml(item.descripcion)}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;font-size:12px;text-align:center;vertical-align:middle;color:#111827;">${item.cantidad}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;font-size:12px;text-align:right;vertical-align:middle;color:#111827;">${escaparHtml(formatearMoneda(item.precioUnitario))}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;font-size:12px;text-align:right;font-weight:800;vertical-align:middle;color:#111827;">${escaparHtml(formatearMoneda(item.subtotalFacturable))}</td>
        </tr>`;
      }).join('');

  const filasFaltantes = lineas
    .filter((item) => Number(item?.faltanteCantidad) > 0)
    .map((item) => {
      const etiquetaCantidad = item.faltanteTotal
        ? `${item.cantidadOriginal} de ${item.cantidadOriginal}`
        : `${item.faltanteCantidad} de ${item.cantidadOriginal}`;
      return `<tr>
        <td style="padding:10px;border:1px solid #fecaca;font-size:12px;font-weight:700;vertical-align:middle;color:#991b1b;">${escaparHtml(item.descripcion)}</td>
        <td style="padding:10px;border:1px solid #fecaca;font-size:12px;text-align:center;vertical-align:middle;color:#991b1b;">${etiquetaCantidad}</td>
        <td style="padding:10px;border:1px solid #fecaca;font-size:12px;text-align:right;vertical-align:middle;color:#991b1b;">-${escaparHtml(formatearMoneda(item.descuentoFaltante))}</td>
      </tr>`;
    })
    .join('');

  const subtotalFactura = lineas.length > 0 ? obtenerTotalFacturaDesdeLineas(lineas) : obtenerTotalPedido(pedido);
  const descuento = obtenerDescuentosFaltantesDesdeLineas(lineas);
  const total = Math.max(0, subtotalFactura);
  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Factura ${escaparHtml(obtenerNumeroPedido(pedido))}</title>
  <style>
    body { font-family: Arial, sans-serif; color:#111827; margin:28px; }
    .top { display:flex; justify-content:space-between; gap:20px; }
    .brand { background:#0f172a; color:white; padding:16px; border-radius:12px; }
    .box { border:1px solid #e5e7eb; border-radius:12px; padding:14px; margin-top:12px; }
    table { width:100%; border-collapse:collapse; margin-top:12px; }
    th { background:#f9fafb; font-size:11px; text-transform:uppercase; letter-spacing:.08em; padding:10px; border:1px solid #e5e7eb; text-align:left; }
    .right { text-align:right; }
    .center { text-align:center; }
  </style>
</head>
<body>
  <div class="top">
    <div class="brand">
      <h2 style="margin:0 0 8px 0;">${escaparHtml(DATOS_CELIASHOP.razonSocial)}</h2>
      <div style="font-size:12px;line-height:1.5;">CUIT: ${escaparHtml(DATOS_CELIASHOP.cuit)}<br/>IVA: ${escaparHtml(DATOS_CELIASHOP.condicionIva)}<br/>${escaparHtml(DATOS_CELIASHOP.direccion)}<br/>${escaparHtml(DATOS_CELIASHOP.telefono)} - ${escaparHtml(DATOS_CELIASHOP.email)}</div>
    </div>
    <div class="box" style="min-width:230px;">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;">Comprobante</div>
      <div style="font-size:16px;font-weight:900;margin-top:6px;">FAC-${escaparHtml(obtenerNumeroPedido(pedido))}</div>
      <div style="font-size:12px;margin-top:8px;">Fecha: ${escaparHtml(formatearFechaPedido(pedido))}</div>
      <div style="font-size:12px;">Estado: ${escaparHtml(obtenerEstadoPedido(pedido))}</div>
    </div>
  </div>

  <div class="box">
    <div style="font-size:11px;font-weight:800;text-transform:uppercase;margin-bottom:8px;">Datos del cliente</div>
    <div style="font-size:12px;line-height:1.55;">
      <strong>${escaparHtml(nombreCliente)}</strong><br/>
      ID cliente: ${escaparHtml(clienteId)}<br/>
      Email: ${escaparHtml(emailCliente)}<br/>
      Teléfono: ${escaparHtml(telefonoCliente)}<br/>
      CUIT: ${escaparHtml(cuitCliente)}<br/>
      Dirección: ${escaparHtml(direccionCliente)}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center">Imagen</th>
        <th>Producto</th>
        <th class="center">Cantidad</th>
        <th class="right">Unitario</th>
        <th class="right">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${filas}
    </tbody>
  </table>

  ${descuento > 0 ? `<div class="box" style="margin-top:14px;background:#fff1f2;border-color:#fecdd3;">
    <div style="font-size:12px;font-weight:800;text-transform:uppercase;color:#b91c1c;margin-bottom:10px;">Faltantes y descuentos</div>
    <table style="margin-top:0;">
      <thead>
        <tr>
          <th style="background:#ffe4e6;border:1px solid #fecaca;color:#9f1239;">Producto faltante</th>
          <th class="center" style="background:#ffe4e6;border:1px solid #fecaca;color:#9f1239;">Cantidad faltante</th>
          <th class="right" style="background:#ffe4e6;border:1px solid #fecaca;color:#9f1239;">Descuento</th>
        </tr>
      </thead>
      <tbody>
        ${filasFaltantes}
      </tbody>
    </table>
  </div>` : ''}

  <div class="box" style="margin-top:14px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <span style="font-size:12px;font-weight:800;text-transform:uppercase;color:#6b7280;">Subtotal facturado</span>
      <span style="font-size:16px;font-weight:900;color:#059669;">${escaparHtml(formatearMoneda(subtotalFactura))}</span>
    </div>
    ${descuento > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid #e5e7eb;">
      <span style="font-size:12px;font-weight:800;text-transform:uppercase;color:#991b1b;">Descuento (faltantes)</span>
      <span style="font-size:16px;font-weight:900;color:#991b1b;">-${escaparHtml(formatearMoneda(descuento))}</span>
    </div>` : ''}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:2px solid #e5e7eb;">
      <span style="font-size:14px;font-weight:900;text-transform:uppercase;">Total a abonar</span>
      <span style="font-size:22px;font-weight:900;color:#059669;">${escaparHtml(formatearMoneda(total))}</span>
    </div>
  </div>
</body>
</html>`;

  const ventana = window.open('', '_blank', 'width=960,height=760');
  if (!ventana) {
    alert('No se pudo abrir la ventana de impresión. Verificá el bloqueador de popups.');
    return;
  }
  ventana.document.write(html);
  ventana.document.close();
  ventana.focus();
  ventana.print();
};

const leerSnapshotsPedidos = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PEDIDOS_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const guardarSnapshotPedido = (pedido) => {
  if (typeof window === 'undefined' || !pedido?.id) return;
  try {
    const snapshots = leerSnapshotsPedidos();
    snapshots[pedido.id] = pedido;
    window.localStorage.setItem(PEDIDOS_SNAPSHOT_KEY, JSON.stringify(snapshots));
  } catch {
    // Ignorar errores de almacenamiento local.
  }
};

const enriquecerPedidoConSnapshot = (pedido) => {
  const snapshot = leerSnapshotsPedidos()[pedido?.id];
  if (!snapshot) return pedido;
  const estadoNormalizado = normalizarEstadoPedido(
    pedido?.estado ?? snapshot?.estado,
    pedido?.status ?? snapshot?.status
  );
  return {
    ...snapshot,
    ...pedido,
    productos: obtenerProductosPedido(pedido).length > 0 ? obtenerProductosPedido(pedido) : snapshot.productos,
    estado: estadoNormalizado,
    status: estadoNormalizado,
    telefono: pedido?.telefono || snapshot.telefono,
    email: pedido?.email || snapshot.email,
    direccion_envio: pedido?.direccion_envio || snapshot.direccion_envio,
    direccion_entrega: pedido?.direccion_entrega || snapshot.direccion_entrega,
    fecha: obtenerFechaPedido(pedido) || snapshot.fecha,
  };
};

const traerPedidosPorUsuario = async (usuarioId) => {
  if (!usuarioId) return [];

  const columnasUsuario = ['user_id', 'perfil_id', 'usuario_id', 'cliente_id'];

  for (const columna of columnasUsuario) {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq(columna, usuarioId);

    if (!error) {
      return (data || []).map(enriquecerPedidoConSnapshot).sort((a, b) => {
        const fechaA = new Date(obtenerFechaPedido(a) || 0).getTime();
        const fechaB = new Date(obtenerFechaPedido(b) || 0).getTime();
        return fechaB - fechaA;
      });
    }

    const mensaje = String(error?.message || '').toLowerCase();
    const esErrorColumna = mensaje.includes('schema cache') || mensaje.includes('column');
    if (!esErrorColumna) {
      console.error('Error consultando pedidos:', error);
      return [];
    }
  }

  return [];
};

const obtenerIdClientePedido = (pedido) => String(
  pedido?.user_id || pedido?.perfil_id || pedido?.usuario_id || pedido?.cliente_id || ''
);

const obtenerClienteDePedido = (pedido, clientes = []) => {
  const clienteId = obtenerIdClientePedido(pedido);
  if (!clienteId) return null;
  return clientes.find((cliente) => String(cliente?.id || '') === clienteId) || null;
};

const construirClienteFallbackDesdePedido = (pedido) => ({
  id: obtenerIdClientePedido(pedido) || null,
  nombre: '',
  apellido: '',
  email: pedido?.email || '',
  telefono: pedido?.telefono || '',
  cuit: pedido?.cuit || '',
  direccion_envio: obtenerDireccionPedido(pedido) || '',
});

function TarjetaPedidoDetalle({ pedido, usuarioLogueado }) {
  const [expandido, setExpandido] = useState(false);
  const productos = obtenerProductosPedido(pedido);
  const total = obtenerTotalPedido(pedido);
  const estado = obtenerEstadoPedido(pedido);

  return (
    <div className="bg-white rounded-[24px] border border-gray-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpandido((prev) => !prev)}
        className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">Pedido #{obtenerNumeroPedido(pedido)}</p>
            <p className="text-sm font-semibold text-gray-700 mt-1">{formatearFechaPedido(pedido)}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${obtenerClaseEstadoPedido(estado)}`}>{estado}</span>
            <span className="text-sm font-black text-emerald-700">{formatearMoneda(total)}</span>
            <span className="text-xs font-semibold text-gray-500">{obtenerCantidadItemsPedido(pedido) || productos.length} items</span>
            <span className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest">
              {expandido ? 'Ocultar detalle' : 'Ver detalle'}
            </span>
          </div>
        </div>
      </button>

      {expandido && (
        <div className="border-t border-gray-100 p-4 md:p-5 bg-gray-50/60">
          <FacturaPedido pedido={pedido} cliente={usuarioLogueado} mostrarImagenesEnLineas resaltarEstadoActual />
        </div>
      )}
    </div>
  );
}

function FacturaPedido({ pedido, cliente = {}, mostrarImagenesEnLineas = false, resaltarEstadoActual = false, editable = false, productosOverride = null, onCambiarLinea = null, onToggleLineaFaltante = null, onGuardarCambios = null, onCancelarEdicion = null, guardandoCambios = false }) {
  const productos = Array.isArray(productosOverride)
    ? productosOverride.map((item) => normalizarProductoPedido(item))
    : obtenerProductosPedido(pedido);
  const lineas = construirLineasFactura(productos);

  const subtotalFactura = lineas.length > 0 ? obtenerTotalFacturaDesdeLineas(lineas) : obtenerTotalPedido(pedido);
  const descuentoAplicado = obtenerDescuentosFaltantesDesdeLineas(lineas);
  const totalPedido = Math.max(0, subtotalFactura - descuentoAplicado);
  const lineasFaltantes = lineas.filter((item) => Number(item?.faltanteCantidad) > 0);
  const itemsTotales = lineas.reduce((acc, item) => acc + (Number(item?.cantidadOriginal) || Number(item?.cantidad) || 0), 0);
  const itemsFacturables = obtenerItemsFacturablesDesdeLineas(lineas);

  const clienteId = String(
    cliente?.id || pedido?.user_id || pedido?.perfil_id || pedido?.usuario_id || pedido?.cliente_id || 'sin-id'
  );
  const nombreCliente = [cliente?.nombre, cliente?.apellido].filter(Boolean).join(' ').trim() || 'Cliente CeliaShop';
  const emailCliente = pedido?.email || cliente?.email || 'No informado';
  const telefonoCliente = pedido?.telefono || cliente?.telefono || 'No informado';
  const cuitCliente = cliente?.cuit || pedido?.cuit || 'No informado';
  const direccionCliente = obtenerDireccionPedido(pedido) || cliente?.direccion_envio || 'No informada';
  const estadoActual = obtenerEstadoPedido(pedido);
  const estadoVisual = obtenerVisualEstadoPedido(estadoActual);
  const IconoEstado = estadoVisual.icono;

  return (
    <div className="bg-white rounded-[30px] border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-slate-900 via-gray-800 to-slate-900 text-white p-6 md:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-emerald-300 mb-2">Factura premium CeliaShop</p>
            <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight">{DATOS_CELIASHOP.razonSocial}</h3>
            <p className="text-xs text-gray-300 font-semibold mt-1">CUIT: {DATOS_CELIASHOP.cuit} · IVA: {DATOS_CELIASHOP.condicionIva}</p>
            <p className="text-xs text-gray-300 font-semibold">{DATOS_CELIASHOP.direccion}</p>
            <p className="text-xs text-gray-300 font-semibold">{DATOS_CELIASHOP.telefono} · {DATOS_CELIASHOP.email}</p>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-2xl p-4 min-w-[250px]">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-200">Comprobante</p>
            <p className="text-sm font-black uppercase mt-1">FAC-{obtenerNumeroPedido(pedido)}</p>
            <p className="text-xs font-semibold text-gray-200 mt-2">Pedido #{obtenerNumeroPedido(pedido)}</p>
            <p className="text-xs font-semibold text-gray-200">Fecha: {formatearFechaPedido(pedido)}</p>
            {resaltarEstadoActual ? (
              <div className="mt-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-200 mb-2">Estado actual</p>
                <div className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${estadoVisual.claseContenedor}`}>
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${estadoVisual.claseIcono}`}>
                    <IconoEstado size={20} />
                  </span>
                  <span className="text-lg font-black uppercase tracking-wide">{estadoVisual.texto}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs font-semibold text-gray-200">Estado: {estadoActual}</p>
            )}
            <button
              onClick={() => imprimirFacturaPedido(pedido, cliente)}
              className="mt-3 w-full rounded-xl bg-white text-gray-900 px-3 py-2 text-[11px] font-black uppercase tracking-widest hover:bg-gray-100"
            >
              Imprimir factura
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8 space-y-6 bg-gradient-to-b from-white to-gray-50/60">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Cliente</p>
            <p className="text-base font-black text-gray-900 uppercase">{nombreCliente}</p>
            <p className="text-sm font-semibold text-gray-700 mt-1 break-all">{emailCliente}</p>
            <p className="text-sm font-semibold text-gray-700 break-words">{telefonoCliente}</p>
            <p className="text-sm font-semibold text-gray-700 break-words">CUIT: {cuitCliente}</p>
            <p className="text-sm font-semibold text-gray-700 break-words">Dirección: {direccionCliente}</p>
            <p className="text-xs font-semibold text-gray-500 mt-2 break-all">ID cliente: {clienteId}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Resumen de cobro</p>
            <div className="space-y-2 text-sm font-semibold text-gray-700">
              <div className="flex items-center justify-between">
                <span>Items pedidos</span>
                <span className="font-black text-gray-900">{itemsTotales}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Items facturados</span>
                <span className="font-black text-gray-900">{itemsFacturables}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Subtotal a cobrar</span>
                <span className="font-black text-gray-900">{formatearMoneda(subtotalFactura)}</span>
              </div>
              {descuentoAplicado > 0 && (
                <div className="flex items-center justify-between text-rose-600 py-1">
                  <span>Descuento (faltantes)</span>
                  <span className="font-black">-{formatearMoneda(descuentoAplicado)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-gray-200 pt-2">
                <span className="font-black uppercase">Total a abonar</span>
                <span className="text-xl font-black text-emerald-600">{formatearMoneda(totalPedido)}</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-black uppercase tracking-widest text-gray-900">
              {mostrarImagenesEnLineas ? 'Detalle completo del pedido (con imágenes)' : 'Detalle completo del pedido (sin imágenes)'}
            </h4>
            <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">{editable ? 'Modo edición de factura' : 'Copia idéntica admin/cliente'}</span>
          </div>

          {lineas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-5 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500">Este pedido no tiene el detalle de productos guardado en la base actual.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
              <div className={`hidden md:grid bg-gray-50 border-b border-gray-200 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-gray-500 ${editable ? 'grid-cols-14' : 'grid-cols-12'}`}>
                <p className={editable ? 'col-span-5' : 'col-span-6'}>Producto</p>
                <p className="col-span-2 text-center">Cantidad pedida</p>
                <p className="col-span-2 text-right">Unitario</p>
                <p className="col-span-2 text-right">Subtotal</p>
                {editable ? (
                  <p className="col-span-3 text-center">Faltantes</p>
                ) : null}
              </div>
              <div className="divide-y divide-gray-100">
                {lineas.map((item, i) => (
                  <div key={`${pedido.id}-${i}`} className={`grid grid-cols-1 gap-2 px-4 py-3 ${editable ? 'md:grid-cols-14' : 'md:grid-cols-12'}`}>
                    <div className={`${editable ? 'md:col-span-5' : 'md:col-span-6'} flex items-center gap-3 min-w-0`}>
                      {mostrarImagenesEnLineas && (
                        <img src={item.imagen} alt={item.descripcion} className="w-10 h-10 rounded-lg object-cover bg-gray-100 shrink-0" />
                      )}
                      {editable ? (
                        <div className="min-w-0 flex-1 space-y-2">
                          <input
                            type="text"
                            value={productos[i]?.nombre || ''}
                            onChange={(e) => onCambiarLinea?.(i, 'nombre', e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-black uppercase text-gray-900"
                          />
                          <input
                            type="text"
                            value={productos[i]?.imagen_url || ''}
                            onChange={(e) => onCambiarLinea?.(i, 'imagen_url', e.target.value)}
                            placeholder="URL de imagen"
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600"
                          />
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <p className="text-sm font-black uppercase break-words text-gray-900">{item.descripcion}</p>
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-2 md:text-center text-sm font-semibold text-gray-700">
                      {editable ? (
                        <div className="space-y-2">
                          <p className="text-sm font-black text-gray-900">{item.cantidadOriginal}</p>
                          <input
                            type="number"
                            min="1"
                            value={productos[i]?.cantidad ?? item.cantidad}
                            onChange={(e) => onCambiarLinea?.(i, 'cantidad', e.target.value)}
                            className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-black text-center text-gray-900"
                            title="Cantidad entregada"
                          />
                          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Entregada</p>
                        </div>
                      ) : (
                        <p>Cantidad: {item.cantidadOriginal}</p>
                      )}
                    </div>
                    <div className="md:col-span-2 md:text-right text-sm font-semibold text-gray-700">
                      {editable ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={productos[i]?.precio ?? item.precioUnitario}
                          onChange={(e) => onCambiarLinea?.(i, 'precio', e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-black text-right text-gray-900"
                        />
                      ) : (
                        <p>{formatearMoneda(item.precioUnitario)}</p>
                      )}
                    </div>
                    <div className="md:col-span-2 md:text-right text-sm font-black">
                      <p className="text-emerald-600">{formatearMoneda(item.subtotalFacturable)}</p>
                    </div>
                    {editable ? (
                      <div className="md:col-span-3 flex flex-col items-stretch md:items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleLineaFaltante?.(i)}
                          className={`rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wide ${item.faltanteTotal ? 'bg-red-600 text-white' : 'bg-emerald-100 text-emerald-700'}`}
                        >
                          {item.faltanteTotal ? 'Marcar disponible' : 'Marcar faltante total'}
                        </button>
                        <input
                          type="text"
                          value={productos[i]?.motivo_ajuste || ''}
                          onChange={(e) => onCambiarLinea?.(i, 'motivo_ajuste', e.target.value)}
                          placeholder="Motivo del ajuste"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[11px] font-semibold text-gray-600"
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="px-4 py-4 bg-rose-50/70 border-t border-rose-200">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-black uppercase tracking-widest text-rose-700">Faltantes y descuentos</p>
                  <p className="text-sm font-black text-rose-700">-{formatearMoneda(descuentoAplicado)}</p>
                </div>
                {lineasFaltantes.length === 0 ? (
                  <p className="text-sm font-semibold text-rose-700">Sin faltantes registrados.</p>
                ) : (
                  <div className="space-y-2">
                    {lineasFaltantes.map((item) => (
                      <div key={`${pedido.id}-faltante-${item.key}`} className="rounded-xl border border-rose-200 bg-white px-3 py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black uppercase text-rose-900 break-words">{item.descripcion}</p>
                          <p className="text-xs font-semibold text-rose-700">
                            Faltan {item.faltanteCantidad} de {item.cantidadOriginal}
                            {item.motivoAjuste ? ` · ${item.motivoAjuste}` : ''}
                          </p>
                        </div>
                        <p className="text-sm font-black text-rose-700">-{formatearMoneda(item.descuentoFaltante)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {editable && (
                <div className="px-4 py-4 bg-white border-t border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-widest text-gray-500">Guardá para persistir faltantes y descuento final sin alterar la factura original.</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={onCancelarEdicion}
                      className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-black uppercase"
                    >
                      Cancelar edición
                    </button>
                    <button
                      type="button"
                      onClick={onGuardarCambios}
                      disabled={guardandoCambios}
                      className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black uppercase disabled:opacity-60"
                    >
                      {guardandoCambios ? 'Guardando...' : 'Guardar factura'}
                    </button>
                  </div>
                </div>
              )}
              <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-widest text-gray-500">Total a abonar</p>
                <p className="text-lg font-black text-emerald-600">{formatearMoneda(totalPedido)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Carrusel({ productos, agregarAlCarrito }) {
  const [actual, setActual] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!productos?.length || isHovered) return;
    const maxIndex = Math.max(productos.length - 5, 0);
    const intervalo = setInterval(() => {
      setActual((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, 3000);
    return () => clearInterval(intervalo);
  }, [productos, isHovered]);

  const maxIndex = Math.max((productos?.length || 0) - 5, 0);

  const mover = (dir) => {
    if (!productos || productos.length <= 5) return;
    if (dir === 'sig') setActual((prev) => (prev >= maxIndex ? 0 : prev + 1));
    else setActual((prev) => (prev <= 0 ? maxIndex : prev - 1));
  };

  const irAIndice = (index) => {
    setActual(index);
  };

  if (!productos || productos.length === 0) {
    return (
      <div className="h-[300px] md:h-[350px] rounded-[20px] bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-lg">
        <p className="text-gray-500 uppercase tracking-widest font-bold">No hay productos para mostrar</p>
      </div>
    );
  }

  return (
    <div
      className="relative h-[300px] md:h-[340px] w-full rounded-[20px] overflow-hidden shadow-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="absolute inset-0 pointer-events-none flex items-center justify-between z-10 px-3">
        <button
          onClick={() => mover('ant')}
          className="pointer-events-auto bg-white/90 hover:bg-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-sm border border-gray-200"
        >
          <ChevronLeft size={20} className="text-gray-700" />
        </button>
        <button
          onClick={() => mover('sig')}
          className="pointer-events-auto bg-white/90 hover:bg-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-sm border border-gray-200"
        >
          <ChevronRight size={20} className="text-gray-700" />
        </button>
      </div>

      <div className="h-full overflow-hidden">
        <div
          className="h-full flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${actual * 20}%)` }}
        >
          {productos.map((p) => (
            <div key={p.id} className="flex-none w-1/5 p-2">
              <div className="h-full rounded-2xl border border-gray-200 bg-white shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group">
                <div className="relative">
                  <img
                    src={p.imagen_url}
                    alt={p.nombre}
                    className="w-full h-28 object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
                <div className="p-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-800 mb-1 line-clamp-2">{p.nombre}</h3>
                  <p className="text-xs text-green-600 font-black mb-1">${p.precio}</p>
                  <p className="text-[10px] uppercase text-gray-500 mb-2">{p.categoria || 'Sin categoría'}</p>
                  <p className={`text-[10px] font-bold mb-2 ${p.stock > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {p.stock > 0 ? `Stock: ${p.stock}` : 'Sin stock'}
                  </p>
                  <button
                    onClick={() => agregarAlCarrito(p)}
                    disabled={!p.activo || p.stock <= 0}
                    className={`w-full py-3 rounded-lg text-[9px] font-black uppercase transition-all duration-300 ${
                      !p.activo || p.stock <= 0
                        ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                        : 'bg-gradient-to-r from-gray-900 to-gray-800 text-white hover:from-gray-800 hover:to-gray-700 shadow-md hover:shadow-lg'
                    }`}
                  >
                    {p.activo && p.stock > 0 ? 'Agregar' : 'No disponible'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
        {Array.from({ length: maxIndex + 1 }, (_, i) => (
          <button
            key={i}
            onClick={() => irAIndice(i)}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              i === actual ? 'bg-white shadow-lg scale-125' : 'bg-white/50 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function SeccionCarrito({ carrito, setCarrito, setPagina, usuarioLogueado, session, setRedirectAfterLogin, setEsLogin, confirmandoCarrito, setConfirmandoCarrito, setMensajeToast, setMostrarToast }) {
  const [paso, setPaso] = useState(() => confirmandoCarrito ? 2 : 1);
  const [direccion, setDireccion] = useState(usuarioLogueado?.direccion_envio || '');
  const [telefono, setTelefono] = useState(usuarioLogueado?.telefono || '');
  const [cargando, setCargando] = useState(false);
  const [pedidoConfirmado, setPedidoConfirmado] = useState(null);

  useEffect(() => {
    if (usuarioLogueado?.direccion_envio) setDireccion(usuarioLogueado.direccion_envio);
    if (usuarioLogueado?.telefono) setTelefono(usuarioLogueado.telefono);
  }, [usuarioLogueado]);

  const total = carrito.reduce((acc, p) => acc + (Number(p.precio) || 0) * (Number(p.cantidad) || 1), 0);
  const totalItems = carrito.reduce((acc, p) => acc + (Number(p.cantidad) || 1), 0);

  const actualizarCantidad = (id, delta) => {
    setCarrito(prev =>
      prev.map(item => item.id === id ? { ...item, cantidad: Math.max(0, (item.cantidad || 1) + delta) } : item)
          .filter(item => item.cantidad > 0)
    );
  };

  const eliminarItem = (id) => setCarrito(prev => prev.filter(i => i.id !== id));

  const irAlPago = () => {
    if (!session?.user) {
      setMensajeToast('Debes iniciar sesión para continuar');
      setMostrarToast(true);
      setTimeout(() => setMostrarToast(false), 2500);
      setRedirectAfterLogin('checkout');
      setEsLogin(true);
      setPagina('cuenta');
      return;
    }
    setPaso(2);
    setConfirmandoCarrito(true);
  };

  const confirmarCompra = async () => {
    if (!direccion.trim()) {
      setMensajeToast('Ingresá la dirección de entrega');
      setMostrarToast(true);
      setTimeout(() => setMostrarToast(false), 2500);
      return;
    }
    const perfilId = usuarioLogueado?.id || session?.user?.id;
    if (!perfilId) {
      setMensajeToast('Error: sesión no válida. Volvé a iniciar sesión.');
      setMostrarToast(true);
      setTimeout(() => setMostrarToast(false), 3000);
      return;
    }

    setCargando(true);
    try {
      const telefonoCliente = telefono.trim() || usuarioLogueado?.telefono || '';
      const emailCliente = usuarioLogueado?.email || session?.user?.email || '';
      const productosPedido = carrito.map(item => ({
        id: item.id,
        nombre: item.nombre,
        precio: Number(item.precio) || 0,
        cantidad: Number(item.cantidad) || 1,
        imagen_url: item.imagen_url || ''
      }));

      let pedidoId = null;
      let lastError = null;

      // Intento 1: RPC crear_pedido (firma nueva con email/telefono)
      const { data: rpcIdV2, error: rpcErrV2 } = await supabase.rpc('crear_pedido', {
        p_perfil_id: perfilId,
        p_productos: productosPedido,
        p_total: total,
        p_direccion: direccion.trim(),
        p_email: emailCliente || null,
        p_telefono: telefonoCliente || null,
      });
      if (!rpcErrV2) pedidoId = rpcIdV2;
      if (rpcErrV2) lastError = rpcErrV2;

      // Intento 1b: compatibilidad con firma vieja (sin email/telefono)
      if (!pedidoId) {
        const { data: rpcIdV1, error: rpcErrV1 } = await supabase.rpc('crear_pedido', {
          p_perfil_id: perfilId,
          p_productos: productosPedido,
          p_total: total,
          p_direccion: direccion.trim(),
        });
        if (!rpcErrV1) pedidoId = rpcIdV1;
        if (rpcErrV1) lastError = rpcErrV1;
      }

      // Sin insert directo a pedidos: evitamos errores de schema cache en columnas legacy.
      // El alta de pedidos se centraliza en la RPC crear_pedido.

      if (!pedidoId) {
        const msg = (lastError?.message || '').toLowerCase();
        console.error('Checkout error final:', lastError);
        if (msg.includes('function') && msg.includes('crear_pedido')) {
          setMensajeToast('Falta la función crear_pedido. Ejecutá el SQL en Supabase → SQL Editor.');
        } else if (msg.includes('security policy') || msg.includes('row-level') || msg.includes('rls')) {
          setMensajeToast('Error de permisos (RLS). Ejecutá el SQL en Supabase → SQL Editor.');
        } else if ((msg.includes('relation') || msg.includes('table')) && msg.includes('pedidos')) {
          setMensajeToast('La tabla "pedidos" no existe. Ejecutá el SQL en Supabase → SQL Editor.');
        } else {
          setMensajeToast('Error al guardar el pedido. Ejecutá el SQL en Supabase → SQL Editor.');
        }
        setMostrarToast(true);
        setTimeout(() => setMostrarToast(false), 8000);
        setCargando(false);
        return;
      }

      const numPedido = (pedidoId || '').toString().replace(/-/g, '').slice(0, 8).toUpperCase()
                      || Math.random().toString(36).slice(2, 10).toUpperCase();
      const pedidoGenerado = {
        id: pedidoId,
        user_id: perfilId,
        productos: productosPedido,
        total,
        direccion_envio: direccion.trim(),
        estado: 'Pendiente',
        fecha: new Date().toISOString(),
        telefono: telefonoCliente,
        email: emailCliente
      };
      guardarSnapshotPedido(pedidoGenerado);
      setPedidoConfirmado({ numero: numPedido, total, productos: [...carrito], direccion: direccion.trim() });
      setCarrito([]);
      setConfirmandoCarrito(false);
      setPaso(3);

      void enviarEmailPedido({
        tipo: 'pedido_creado',
        pedido: pedidoGenerado,
        cliente: {
          ...(usuarioLogueado || {}),
          id: perfilId,
          email: emailCliente,
          telefono: telefonoCliente,
          direccion_envio: direccion.trim()
        }
      }).then((resultado) => {
        // Email sent, no notification needed
      });
    } catch (err) {
      console.error('Error inesperado checkout:', err);
      setMensajeToast('Error inesperado. Intentá de nuevo.');
      setMostrarToast(true);
      setTimeout(() => setMostrarToast(false), 3000);
    } finally {
      setCargando(false);
    }
  };

  /* ── PASO 3: ÉXITO ─────────────────────────────────────────────────────── */
  if (paso === 3 && pedidoConfirmado) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 pb-20 animate-fadeIn">
        <div className="w-full max-w-xl bg-white rounded-[40px] shadow-2xl border border-green-100 p-10 md:p-12 text-center space-y-7">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto animate-fadeIn">
            <CheckCircle size={42} className="text-green-500" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-gray-900">¡Pedido Confirmado!</h2>
            <p className="text-sm md:text-base font-black text-gray-500 uppercase tracking-widest mt-2">Nº #{pedidoConfirmado.numero}</p>
          </div>

          {/* Detalle productos */}
          <div className="bg-gray-50 rounded-2xl p-6 text-left space-y-3">
            {pedidoConfirmado.productos.map((p, i) => (
              <div key={i} className="flex justify-between items-center text-sm md:text-base">
                <span className="font-semibold text-gray-700 truncate pr-3">{Number(p.cantidad)}x {p.nombre}</span>
                <span className="font-black text-green-600 shrink-0">${(Number(p.precio) * Number(p.cantidad)).toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t border-gray-200 pt-3 mt-1 flex justify-between items-center">
              <span className="font-black text-base text-gray-900">Total</span>
              <span className="font-black text-xl text-green-600">${pedidoConfirmado.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Dirección */}
          <div className="bg-green-50 border border-green-100 rounded-2xl p-5 text-left">
            <p className="text-xs font-black uppercase tracking-widest text-green-600 mb-1">Dirección de entrega</p>
            <p className="text-base font-semibold text-gray-700">{pedidoConfirmado.direccion}</p>
          </div>

          <p className="text-sm text-gray-500 font-semibold uppercase leading-relaxed">
            Nos comunicaremos con vos para coordinar el pago y la entrega.
          </p>

          <div className="flex flex-col gap-3 pt-1">
            <button
              onClick={() => setPagina('perfil')}
              className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-gray-800 transition-colors"
            >
              Ver mis pedidos
            </button>
            <button
              onClick={() => { setPagina('productos'); setPaso(1); }}
              className="w-full text-sm font-black text-gray-500 uppercase py-2 hover:text-gray-700 transition-colors"
            >
              Seguir comprando
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── PASO 2: DATOS DE ENTREGA ───────────────────────────────────────────── */
  if (paso === 2) {
    return (
      <div className="max-w-5xl mx-auto animate-fadeIn pb-20">
        {/* Header con stepper */}
        <div className="flex items-center gap-4 mb-8 justify-center">
          <button
            onClick={() => { setPaso(1); setConfirmandoCarrito(false); }}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1 max-w-2xl text-center">
            <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-gray-900">Datos de Entrega</h2>
            <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
              <div className="flex items-center gap-1">
                <div className="w-7 h-7 rounded-full bg-green-100 border-2 border-green-500 flex items-center justify-center">
                  <CheckCircle size={12} className="text-green-600" />
                </div>
                <span className="text-xs font-black uppercase text-green-600">Carrito</span>
              </div>
              <div className="w-8 h-px bg-gray-300" />
              <div className="flex items-center gap-1">
                <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center">
                  <span className="text-xs font-black text-white">2</span>
                </div>
                <span className="text-xs font-black uppercase text-gray-900">Entrega</span>
              </div>
              <div className="w-8 h-px bg-gray-200" />
              <div className="flex items-center gap-1">
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-xs font-black text-gray-400">3</span>
                </div>
                <span className="text-xs font-black uppercase text-gray-400">Confirmación</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-5 gap-6">
          {/* Formulario */}
          <div className="md:col-span-3 space-y-4">
            <div className="bg-white rounded-[28px] p-8 shadow-sm border border-gray-100 space-y-5">
              <h3 className="text-sm md:text-base font-black uppercase text-gray-500 tracking-widest text-center">Información de entrega</h3>

              <label className="block">
                <span className="text-xs md:text-sm font-black uppercase text-gray-600 ml-1">Dirección completa *</span>
                <input
                  type="text"
                  placeholder="Calle, número, piso, ciudad..."
                  value={direccion}
                  onChange={e => setDireccion(e.target.value)}
                  className="w-full mt-2 p-4 bg-gray-50 rounded-2xl text-sm font-semibold border-2 border-transparent focus:border-green-500 focus:bg-white outline-none transition-all placeholder-gray-300"
                />
              </label>

              <label className="block">
                <span className="text-xs md:text-sm font-black uppercase text-gray-600 ml-1">Teléfono (opcional)</span>
                <input
                  type="tel"
                  placeholder="11 1234-5678"
                  value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                  className="w-full mt-2 p-4 bg-gray-50 rounded-2xl text-sm font-semibold border-2 border-transparent focus:border-green-500 focus:bg-white outline-none transition-all placeholder-gray-300"
                />
              </label>
            </div>

            <div className="bg-green-50 border border-green-100 rounded-[20px] p-5">
              <p className="text-xs md:text-sm font-black uppercase text-green-700 leading-relaxed text-center">
                Al confirmar, tu pedido queda registrado. Nos comunicaremos con vos para coordinar el pago y la entrega.
              </p>
            </div>

            <button
              onClick={confirmarCompra}
              disabled={cargando || !direccion.trim()}
              className={`w-full py-5 rounded-2xl font-black uppercase text-sm tracking-widest transition-all shadow-lg ${
                cargando || !direccion.trim()
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                  : 'bg-green-600 text-white hover:bg-green-700 active:scale-[0.98]'
              }`}
            >
              {cargando ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Procesando pedido...
                </span>
              ) : 'Confirmar Pedido'}
            </button>
          </div>

          {/* Resumen lateral */}
          <div className="md:col-span-2">
            <div className="bg-gray-900 text-white rounded-[28px] p-7 sticky top-8 space-y-5">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-300 text-center">Resumen del pedido</h3>

              <div className="space-y-3 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                {carrito.map(p => (
                  <div key={p.id} className="flex items-center gap-3">
                    <img
                      src={p.imagen_url}
                      alt={p.nombre}
                      className="w-10 h-10 rounded-xl object-cover shrink-0 bg-gray-700"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black uppercase truncate leading-tight">{p.nombre}</p>
                      <p className="text-xs text-gray-300 font-semibold">x{p.cantidad} · ${Number(p.precio).toFixed(2)} c/u</p>
                    </div>
                    <p className="text-sm font-black text-green-400 shrink-0">${(Number(p.precio) * Number(p.cantidad)).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-700 pt-4 space-y-1">
                <div className="flex justify-between text-sm text-gray-300">
                  <span className="font-semibold">{totalItems} {totalItems === 1 ? 'producto' : 'productos'}</span>
                  <span className="font-semibold">Subtotal: ${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="font-black text-lg">Total</span>
                  <span className="font-black text-2xl text-green-400">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── PASO 1: CARRITO ───────────────────────────────────────────────────── */
  return (
    <div className="max-w-2xl mx-auto animate-fadeIn pb-36">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setPagina('productos')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={22} />
        </button>
        <div>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-gray-900">Mi Carrito</h2>
          {carrito.length > 0 && (
            <p className="text-xs text-gray-400 font-semibold">{totalItems} {totalItems === 1 ? 'producto' : 'productos'}</p>
          )}
        </div>
      </div>

      {carrito.length === 0 ? (
        <div className="text-center py-24 space-y-5">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
            <ShoppingCart size={36} className="text-gray-300" />
          </div>
          <div>
            <p className="font-black uppercase text-gray-400 text-sm">Tu carrito está vacío</p>
            <p className="text-xs text-gray-300 mt-1">Agregá productos para comenzar</p>
          </div>
          <button
            onClick={() => setPagina('productos')}
            className="bg-gray-900 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-gray-800 transition-colors"
          >
            Ver productos
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {carrito.map(p => (
              <div
                key={p.id}
                className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
              >
                <img
                  src={p.imagen_url}
                  alt={p.nombre}
                  className="w-16 h-16 object-cover rounded-2xl shrink-0 bg-gray-100"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-black text-xs uppercase text-gray-900 truncate">{p.nombre}</p>
                  <p className="text-green-600 font-black text-sm mt-0.5">
                    ${(Number(p.precio) * Number(p.cantidad)).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-gray-400 font-semibold">${Number(p.precio).toFixed(2)} por unidad</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button
                    onClick={() => eliminarItem(p.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors p-1 rounded-full hover:bg-red-50"
                    aria-label="Eliminar"
                  >
                    <X size={14} />
                  </button>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-1">
                    <button
                      onClick={() => actualizarCantidad(p.id, -1)}
                      className="w-7 h-7 bg-white rounded-lg shadow-sm font-black text-base flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      −
                    </button>
                    <span className="font-black text-xs w-5 text-center text-gray-900">{p.cantidad}</span>
                    <button
                      onClick={() => actualizarCantidad(p.id, 1)}
                      className="w-7 h-7 bg-white rounded-lg shadow-sm font-black text-base flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Barra sticky inferior */}
          <div className="fixed bottom-20 left-0 right-0 px-4 z-40">
            <div className="max-w-2xl mx-auto bg-gray-900 text-white px-6 py-4 rounded-[24px] shadow-2xl flex items-center justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Total a pagar</p>
                <p className="text-xl font-black italic text-white">${total.toFixed(2)}</p>
              </div>
              <button
                onClick={irAlPago}
                className="bg-green-600 hover:bg-green-700 text-white px-7 py-3 rounded-2xl font-black uppercase text-xs tracking-widest transition-colors shrink-0 active:scale-95"
              >
                Continuar →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SeccionPedidos({ usuarioLogueado, pedidosVersion }) {
  const [misPedidos, setMisPedidos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const pedidosPorPagina = 10;

  useEffect(() => {
    const traerMisPedidos = async () => {
      if (!usuarioLogueado) return;
      const pedidos = await traerPedidosPorUsuario(usuarioLogueado.id);
      setMisPedidos(pedidos);
    };
    traerMisPedidos();
  }, [usuarioLogueado, pedidosVersion]);

  useEffect(() => {
    setPaginaActual(1);
  }, [filtroEstado, filtroFechaDesde, filtroFechaHasta, filtroBusqueda]);

  const pedidosFiltrados = misPedidos.filter((pedido) => {
    const estado = obtenerEstadoPedido(pedido);
    const fechaPedido = obtenerFechaPedido(pedido);
    const numero = obtenerNumeroPedido(pedido);

    if (filtroEstado && String(estado).toLowerCase() !== String(filtroEstado).toLowerCase()) {
      return false;
    }

    if (filtroFechaDesde) {
      const desde = new Date(`${filtroFechaDesde}T00:00:00`);
      const fecha = new Date(fechaPedido || 0);
      if (fecha < desde) return false;
    }

    if (filtroFechaHasta) {
      const hasta = new Date(`${filtroFechaHasta}T23:59:59`);
      const fecha = new Date(fechaPedido || 0);
      if (fecha > hasta) return false;
    }

    if (filtroBusqueda.trim()) {
      const q = filtroBusqueda.trim().toLowerCase();
      const total = formatearMoneda(obtenerTotalPedido(pedido));
      const texto = [numero, estado, total]
        .map((v) => String(v || '').toLowerCase())
        .join(' ');
      if (!texto.includes(q)) return false;
    }

    return true;
  });

  const totalPaginas = Math.max(1, Math.ceil(pedidosFiltrados.length / pedidosPorPagina));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const inicio = (paginaSegura - 1) * pedidosPorPagina;
  const pedidosPaginados = pedidosFiltrados.slice(inicio, inicio + pedidosPorPagina);

  const paginaInicio = Math.max(1, paginaSegura - 2);
  const paginaFin = Math.min(totalPaginas, paginaInicio + 4);
  const paginasVisibles = [];
  for (let p = paginaInicio; p <= paginaFin; p += 1) {
    paginasVisibles.push(p);
  }

  if (!usuarioLogueado) {
    return (
      <div className="max-w-4xl mx-auto pb-20 px-4">
        <h2 className="text-3xl font-black italic uppercase mb-8 text-center">Mis Pedidos</h2>
        <p className="text-sm text-gray-500 text-center">Inicia sesión para ver tus pedidos.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20 px-4 flex flex-col items-center">
      <h2 className="text-2xl md:text-3xl font-black italic uppercase mb-6 text-center">Mis Pedidos</h2>

      <div className="w-full max-w-3xl mx-auto bg-white border border-gray-200 rounded-2xl p-4 md:p-5 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Buscar por pedido, estado o total..."
            value={filtroBusqueda}
            onChange={(e) => setFiltroBusqueda(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 font-semibold text-sm"
          />
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 font-semibold text-sm"
          >
            <option value="">Todos los estados</option>
            {ESTADOS_PEDIDO.map((estado) => (
              <option key={estado} value={estado}>{estado}</option>
            ))}
          </select>
          <input
            type="date"
            value={filtroFechaDesde}
            onChange={(e) => setFiltroFechaDesde(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 font-semibold text-sm"
          />
          <input
            type="date"
            value={filtroFechaHasta}
            onChange={(e) => setFiltroFechaHasta(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 font-semibold text-sm"
          />
        </div>
        <div className="mt-3 flex justify-center">
          <button
            onClick={() => {
              setFiltroBusqueda('');
              setFiltroEstado('');
              setFiltroFechaDesde('');
              setFiltroFechaHasta('');
            }}
            className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-black uppercase"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      <div className="space-y-4 w-full max-w-3xl mx-auto">
        {pedidosFiltrados.length === 0 ? (
          <p className="text-center text-gray-500">No hay pedidos para esos filtros.</p>
        ) : (
          pedidosPaginados.map((p) => (
            <TarjetaPedidoDetalle key={p.id} pedido={p} usuarioLogueado={usuarioLogueado} />
          ))
        )}
      </div>

      {pedidosFiltrados.length > 0 && (
        <div className="mt-6 w-full max-w-3xl mx-auto flex flex-col items-center gap-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Página {paginaSegura} de {totalPaginas} · {pedidosFiltrados.length} pedidos
          </p>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              onClick={() => setPaginaActual((prev) => Math.max(1, prev - 1))}
              disabled={paginaSegura <= 1}
              className="px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-black uppercase disabled:opacity-50"
            >
              Anterior
            </button>

            {paginasVisibles.map((pagina) => (
              <button
                key={pagina}
                onClick={() => setPaginaActual(pagina)}
                className={`px-3 py-2 rounded-xl text-xs font-black uppercase ${pagina === paginaSegura ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {pagina}
              </button>
            ))}

            <button
              onClick={() => setPaginaActual((prev) => Math.min(totalPaginas, prev + 1))}
              disabled={paginaSegura >= totalPaginas}
              className="px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-black uppercase disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SeccionPerfil({ usuarioLogueado, user, onRefrescar }) {
  const [editando, setEditando] = useState(false);
  const [datosEditados, setDatosEditados] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  useEffect(() => {
    if (usuarioLogueado && !editando) {
      setDatosEditados({
        nombre: usuarioLogueado.nombre || '',
        apellido: usuarioLogueado.apellido || '',
        email: usuarioLogueado.email || '',
        cuit: usuarioLogueado.cuit || '',
        telefono: usuarioLogueado.telefono || '',
        direccion_envio: usuarioLogueado.direccion_envio || ''
      });
    }
  }, [usuarioLogueado, editando]);

  const guardarCambios = async () => {
    setGuardando(true);
    setError('');
    setExito('');
    try {
      const payloadPerfil = {
        id: usuarioLogueado.id,
        nombre: datosEditados.nombre || '',
        apellido: datosEditados.apellido || '',
        email: datosEditados.email || usuarioLogueado.email || '',
        cuit: datosEditados.cuit || '',
        telefono: datosEditados.telefono || '',
        direccion_envio: datosEditados.direccion_envio || ''
      };

      const { error } = await supabase
        .from('perfiles')
        .upsert(payloadPerfil, { onConflict: 'id' });
      if (error) throw error;
      await onRefrescar();
      setEditando(false);
      setExito('Perfil actualizado exitosamente');
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError('Error al guardar cambios: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const cancelarEdicion = () => {
    setDatosEditados({
      nombre: usuarioLogueado.nombre || '',
      apellido: usuarioLogueado.apellido || '',
      email: usuarioLogueado.email || '',
      cuit: usuarioLogueado.cuit || '',
      telefono: usuarioLogueado.telefono || '',
      direccion_envio: usuarioLogueado.direccion_envio || ''
    });
    setEditando(false);
    setError('');
    setExito('');
  };

  if (!usuarioLogueado) {
    return (
      <div className="max-w-2xl mx-auto pb-20">
        <h2 className="text-3xl font-black italic uppercase mb-8">Mi Cuenta</h2>
        <p className="text-sm text-gray-500">Inicia sesión para ver tu perfil.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-20">
      <h2 className="text-2xl md:text-3xl font-black italic uppercase mb-8">Mi Cuenta</h2>
      <div className="bg-white p-8 rounded-[40px] shadow-sm mb-10 border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black uppercase">Datos Personales</h3>
          {!editando ? (
            <button
              onClick={() => setEditando(true)}
              className="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-6 py-2 rounded-full font-black uppercase text-sm hover:from-gray-800 hover:to-gray-700 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Editar
            </button>
          ) : (
            <div className="flex space-x-3">
              <button
                onClick={guardarCambios}
                disabled={guardando}
                className="bg-gradient-to-r from-green-600 to-green-500 text-white px-6 py-2 rounded-full font-black uppercase text-sm hover:from-green-500 hover:to-green-400 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={cancelarEdicion}
                className="bg-gray-300 text-gray-700 px-6 py-2 rounded-full font-black uppercase text-sm hover:bg-gray-400 transition-all duration-300"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        {exito && <p className="text-green-500 text-sm mb-4">{exito}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Nombre</p>
            {editando ? (
              <input
                type="text"
                value={datosEditados.nombre}
                onChange={(e) => setDatosEditados({...datosEditados, nombre: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg font-bold text-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            ) : (
              <p className="font-bold text-lg">{usuarioLogueado.nombre || 'No registrado'}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Apellido</p>
            {editando ? (
              <input
                type="text"
                value={datosEditados.apellido}
                onChange={(e) => setDatosEditados({...datosEditados, apellido: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg font-bold text-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            ) : (
              <p className="font-bold text-lg">{usuarioLogueado.apellido || 'No registrado'}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Email</p>
            {editando ? (
              <input
                type="email"
                value={datosEditados.email}
                onChange={(e) => setDatosEditados({...datosEditados, email: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg font-bold text-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            ) : (
              <p className="font-bold text-lg">{usuarioLogueado.email || 'No registrado'}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">CUIT</p>
            {editando ? (
              <input
                type="text"
                value={datosEditados.cuit}
                onChange={(e) => setDatosEditados({...datosEditados, cuit: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg font-bold text-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            ) : (
              <p className="font-bold text-lg">{usuarioLogueado.cuit || 'No registrado'}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Teléfono</p>
            {editando ? (
              <input
                type="text"
                value={datosEditados.telefono}
                onChange={(e) => setDatosEditados({...datosEditados, telefono: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg font-bold text-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            ) : (
              <p className="font-bold text-lg">{usuarioLogueado.telefono || 'No registrado'}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Dirección</p>
            {editando ? (
              <input
                type="text"
                value={datosEditados.direccion_envio}
                onChange={(e) => setDatosEditados({...datosEditados, direccion_envio: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg font-bold text-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            ) : (
              <p className="font-bold text-lg">{usuarioLogueado.direccion_envio || 'No registrado'}</p>
            )}
          </div>
          <div className="md:col-span-2">
            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Fecha de Creación</p>
            <p className="font-bold text-lg">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'No disponible'}</p>
          </div>
        </div>
      </div>

    </div>
  );
}

function AdminPanel({ productos, traerProductos, pedidosVersion, onPedidosSync }) {
  const [tab, setTab] = useState('stock');
  const [pedidos, setPedidos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cargandoClientes, setCargandoClientes] = useState(false);
  const [totalVentas, setTotalVentas] = useState(0);
  const [totalFacturado, setTotalFacturado] = useState(0);
  const [actualizandoPedidoId, setActualizandoPedidoId] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [pedidosExpandido, setPedidosExpandido] = useState({});
  const [pedidosClienteExpandido, setPedidosClienteExpandido] = useState({});
  const [clientesExpandido, setClientesExpandido] = useState({});
  const [clienteEditandoId, setClienteEditandoId] = useState(null);
  const [clienteEditado, setClienteEditado] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    cuit: '',
    direccion_envio: '',
  });
  const [guardandoClienteId, setGuardandoClienteId] = useState(null);
  const [nuevoP, setNuevoP] = useState({ nombre: '', precio: '', imagen_url: '', stock: 0, categoria: 'Harinas' });
  const [productoEditando, setProductoEditando] = useState(null);
  const [pedidoEditandoId, setPedidoEditandoId] = useState(null);
  const [productosFacturaEditados, setProductosFacturaEditados] = useState([]);
  const [guardandoFacturaId, setGuardandoFacturaId] = useState(null);

  const traerPedidos = async () => {
    const limite = 500;
    let desde = 0;
    let errorFinal = null;
    const acumulado = [];

    while (true) {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .range(desde, desde + limite - 1);

      if (error) {
        errorFinal = error;
        break;
      }

      const filas = data || [];
      acumulado.push(...filas);
      if (filas.length < limite) break;
      desde += limite;
    }

    if (errorFinal) {
      alert('No se pudieron cargar todas las ventas: ' + errorFinal.message);
      return;
    }

    const pedidosData = acumulado.map(enriquecerPedidoConSnapshot).sort((a, b) => {
      const fechaA = new Date(obtenerFechaPedido(a) || 0).getTime();
      const fechaB = new Date(obtenerFechaPedido(b) || 0).getTime();
      return fechaB - fechaA;
    });
    setPedidos(pedidosData);

    const totalFact = pedidosData.reduce((acc, ped) => acc + obtenerTotalPedido(ped), 0);
    setTotalVentas(pedidosData.length);
    setTotalFacturado(totalFact);
  };

  const traerClientes = async () => {
    setCargandoClientes(true);
    const limite = 500;
    let desde = 0;
    const acumulado = [];
    let errorFinal = null;

    while (true) {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .range(desde, desde + limite - 1);

      if (error) {
        errorFinal = error;
        break;
      }

      const filas = data || [];
      acumulado.push(...filas);
      if (filas.length < limite) break;
      desde += limite;
    }

    if (errorFinal) {
      alert('No se pudieron cargar los clientes: ' + errorFinal.message);
      setCargandoClientes(false);
      return;
    }

    setClientes(acumulado);
    setCargandoClientes(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === 'ventas' || tab === 'clientes') traerPedidos();
    if (tab === 'clientes') traerClientes();
  }, [tab, pedidosVersion]);

  const agregarProducto = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('productos').insert([{ ...nuevoP, activo: true }]);
    if (error) alert("Error: " + error.message);
    else {
      setNuevoP({ nombre: '', precio: '', imagen_url: '', stock: 0, categoria: 'Harinas' });
      traerProductos();
      alert("¡Producto cargado!");
    }
  };

  const editarProducto = async (e) => {
    e.preventDefault();
    if (!productoEditando) return;

    const { error } = await supabase
      .from('productos')
      .update({
        nombre: productoEditando.nombre,
        precio: Number(productoEditando.precio),
        imagen_url: productoEditando.imagen_url,
        stock: Number(productoEditando.stock),
        categoria: productoEditando.categoria
      })
      .eq('id', productoEditando.id);

    if (error) alert("Error al actualizar: " + error.message);
    else {
      setProductoEditando(null);
      traerProductos();
      alert("¡Producto actualizado!");
    }
  };

  const iniciarEdicion = (producto) => setProductoEditando({ ...producto });
  const cancelarEdicion = () => setProductoEditando(null);

  const actualizarEstadoPedido = async (pedido, nuevoEstado) => {
    setActualizandoPedidoId(pedido.id);
    let errorFinal = null;
    const estadoAnterior = obtenerEstadoPedido(pedido);

    const variantes = [
      { estado: nuevoEstado },
    ];

    for (const payload of variantes) {
      const { data, error } = await supabase
        .from('pedidos')
        .update(payload)
        .eq('id', pedido.id)
        .select('*')
        .maybeSingle();

      if (!error) {
        // Si no vuelve fila, normalmente hubo bloqueo por RLS/permisos aunque no arroje error explícito.
        if (!data?.id) {
          errorFinal = { message: 'No se pudo confirmar la actualización del estado (permisos o RLS).' };
          continue;
        }

        const estadoPersistido = obtenerEstadoPedido(data);
        if (estadoPersistido !== nuevoEstado) {
          errorFinal = { message: `La base devolvió estado "${estadoPersistido}" en lugar de "${nuevoEstado}".` };
          continue;
        }

        const pedidoActualizado = { ...pedido, ...data, estado: estadoPersistido };
        const clienteBase = obtenerClienteDePedido(pedidoActualizado, clientes) || construirClienteFallbackDesdePedido(pedidoActualizado);
        let clientePedido = { ...clienteBase };

        // En la pestaña de ventas, la lista de clientes puede no estar cargada.
        // Si falta email, intentamos resolverlo desde perfiles para no perder el aviso.
        if (!clientePedido.email && clientePedido.id) {
          const { data: perfil, error: errorPerfil } = await supabase
            .from('perfiles')
            .select('id, nombre, apellido, email, telefono, cuit, direccion_envio')
            .eq('id', clientePedido.id)
            .maybeSingle();

          if (!errorPerfil && perfil) {
            clientePedido = {
              ...clientePedido,
              ...perfil,
              email: perfil.email || clientePedido.email || '',
              telefono: perfil.telefono || clientePedido.telefono || '',
              cuit: perfil.cuit || clientePedido.cuit || '',
              direccion_envio: perfil.direccion_envio || clientePedido.direccion_envio || '',
            };
          }
        }

        guardarSnapshotPedido(pedidoActualizado);
        setPedidos((prev) => prev.map((item) => item.id === pedido.id ? enriquecerPedidoConSnapshot(pedidoActualizado) : item));
        onPedidosSync?.();
        const resultadoEmail = await enviarEmailPedido({
          tipo: 'estado_actualizado',
          pedido: pedidoActualizado,
          cliente: clientePedido || {},
          estadoAnterior,
        });
        setActualizandoPedidoId(null);
        return;
      }

      const mensaje = String(error?.message || '').toLowerCase();
      const esErrorColumna = mensaje.includes('schema cache') || mensaje.includes('column');
      if (!esErrorColumna) {
        errorFinal = error;
        break;
      }
      errorFinal = error;
    }

    setActualizandoPedidoId(null);
    alert('Error al actualizar estado del pedido: ' + (errorFinal?.message || 'desconocido'));
  };

  const toggleActivo = async (producto) => {
    const { error } = await supabase.from('productos').update({ activo: !producto.activo }).eq('id', producto.id);
    if (error) {
      alert('Error al cambiar estado: ' + error.message);
      return;
    }
    traerProductos();
    alert(`Producto ${producto.activo ? 'deshabilitado' : 'habilitado'} con éxito.`);
  };

  const escaparCsv = (valor) => {
    const s = String(valor ?? '');
    if (s.includes('"') || s.includes(';') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const descargarCsv = (nombreArchivo, encabezados, filas) => {
    const lineas = [encabezados.join(';'), ...filas.map((fila) => fila.map(escaparCsv).join(';'))];
    const contenido = `\uFEFF${lineas.join('\n')}`;
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    a.click();
    URL.revokeObjectURL(url);
  };

  const imprimirFacturaPedidoAdmin = (pedido, cliente = {}) => {
    imprimirFacturaPedido(pedido, cliente);
  };

  const recalcularTotalesPedidos = (siguientePedidos) => {
    setPedidos(siguientePedidos);
    setTotalVentas(siguientePedidos.length);
    setTotalFacturado(siguientePedidos.reduce((acc, item) => acc + obtenerTotalPedido(item), 0));
  };

  const iniciarEdicionFactura = (pedido) => {
    setPedidoEditandoId(pedido.id);
    setPedidosExpandido((prev) => ({ ...prev, [pedido.id]: true }));
    setProductosFacturaEditados(serializarProductosFactura(obtenerProductosPedido(pedido)));
  };

  const cancelarEdicionFactura = () => {
    setPedidoEditandoId(null);
    setProductosFacturaEditados([]);
    setGuardandoFacturaId(null);
  };

  const cambiarLineaFactura = (indice, campo, valor) => {
    setProductosFacturaEditados((prev) => prev.map((producto, index) => {
      if (index !== indice) return producto;
      if (campo === 'cantidad') {
        const nuevaCantidad = Math.max(1, Number(valor) || 1);
        // Preserva cantidad_original si ya existe; si no, usala cantidad actual como original
        const cantidadOriginal = Number(producto?.cantidad_original) || Number(producto?.cantidad) || nuevaCantidad;
        const faltanteCantidad = Math.max(0, cantidadOriginal - nuevaCantidad);
        const motivoPorCantidad = faltanteCantidad > 0 ? `Se entregan ${nuevaCantidad} de ${cantidadOriginal}` : '';
        const estaMarcadoFaltanteTotal = Boolean(producto?.faltante || producto?.anulado);
        return {
          ...producto,
          cantidad: nuevaCantidad,
          cantidad_original: cantidadOriginal,
          faltante_cantidad: faltanteCantidad,
          ajustado_por_admin: estaMarcadoFaltanteTotal || faltanteCantidad > 0,
          motivo_ajuste: estaMarcadoFaltanteTotal
            ? (String(producto?.motivo_ajuste || 'Producto faltante').trim() || 'Producto faltante')
            : motivoPorCantidad,
        };
      }
      if (campo === 'precio') return { ...producto, precio: Math.max(0, Number(valor) || 0) };
      return { ...producto, [campo]: valor };
    }));
  };

  const toggleLineaFacturaFaltante = (indice) => {
    setProductosFacturaEditados((prev) => prev.map((producto, index) => {
      if (index !== indice) return producto;
      const cantidad = Math.max(1, Number(producto?.cantidad) || 1);
      const cantidadOriginal = Math.max(cantidad, Number(producto?.cantidad_original) || cantidad);
      const faltante = !Boolean(producto?.faltante || producto?.anulado);
      const faltanteCantidad = faltante ? cantidadOriginal : Math.max(0, cantidadOriginal - cantidad);
      const motivoPorCantidad = cantidadOriginal > cantidad ? `Se entregan ${cantidad} de ${cantidadOriginal}` : '';
      return {
        ...producto,
        cantidad,
        cantidad_original: cantidadOriginal,
        faltante,
        anulado: faltante,
        faltante_cantidad: faltanteCantidad,
        ajustado_por_admin: faltante || faltanteCantidad > 0,
        motivo_ajuste: faltante
          ? (String(producto?.motivo_ajuste || 'Producto faltante').trim() || 'Producto faltante')
          : motivoPorCantidad,
      };
    }));
  };

  const guardarFacturaEditada = async (pedido) => {
    setGuardandoFacturaId(pedido.id);
    try {
      const productosActualizados = serializarProductosFactura(productosFacturaEditados);
      const totalActualizado = obtenerTotalFacturaDesdeLineas(construirLineasFactura(productosActualizados));

      const { data, error } = await supabase
        .from('pedidos')
        .update({
          productos: productosActualizados,
          total: totalActualizado,
        })
        .eq('id', pedido.id)
        .select('*')
        .maybeSingle();

      if (error) throw error;

      const pedidoActualizado = enriquecerPedidoConSnapshot({
        ...pedido,
        ...(data || {}),
        productos: productosActualizados,
        total: totalActualizado,
      });

      guardarSnapshotPedido(pedidoActualizado);
      const siguientesPedidos = pedidos.map((item) => item.id === pedido.id ? pedidoActualizado : item);
      recalcularTotalesPedidos(siguientesPedidos);
      cancelarEdicionFactura();
      onPedidosSync?.();
      alert('Factura actualizada. Los faltantes quedaron tachados y descontados del total.');
    } catch (error) {
      alert('No se pudo guardar la factura: ' + (error?.message || 'Error desconocido'));
    } finally {
      setGuardandoFacturaId(null);
    }
  };

  const pedidosFiltrados = pedidos.filter((ped) => {
    const estado = obtenerEstadoPedido(ped);
    const fechaRaw = obtenerFechaPedido(ped);
    const fecha = fechaRaw ? new Date(fechaRaw) : null;
    const clienteId = String(ped.user_id || ped.perfil_id || ped.usuario_id || 'sin-id');
    const numero = obtenerNumeroPedido(ped);
    const email = String(ped?.email || '').toLowerCase();
    const telefono = String(ped?.telefono || '').toLowerCase();
    const direccion = String(obtenerDireccionPedido(ped) || '').toLowerCase();
    const q = filtroBusqueda.trim().toLowerCase();

    if (filtroEstado && estado !== filtroEstado) return false;

    if (filtroFechaDesde) {
      if (!fecha) return false;
      const desde = new Date(`${filtroFechaDesde}T00:00:00`);
      if (fecha < desde) return false;
    }

    if (filtroFechaHasta) {
      if (!fecha) return false;
      const hasta = new Date(`${filtroFechaHasta}T23:59:59`);
      if (fecha > hasta) return false;
    }

    if (q) {
      const hayMatch = numero.toLowerCase().includes(q)
        || clienteId.toLowerCase().includes(q)
        || email.includes(q)
        || telefono.includes(q)
        || direccion.includes(q);
      if (!hayMatch) return false;
    }

    return true;
  });

  const totalFacturadoFiltrado = pedidosFiltrados.reduce((acc, ped) => acc + obtenerTotalPedido(ped), 0);

  const exportarVentasExcel = () => {
    const filas = pedidosFiltrados.map((ped) => {
      const productos = obtenerProductosPedido(ped)
        .map((p) => `${Number(p?.cantidad) || 1}x ${p?.nombre || 'Producto'} (${formatearMoneda(p?.precio || 0)})`)
        .join(' | ');
      return [
        obtenerNumeroPedido(ped),
        String(ped.user_id || ped.perfil_id || ped.usuario_id || 'sin-id'),
        formatearFechaPedido(ped),
        obtenerEstadoPedido(ped),
        obtenerDireccionPedido(ped),
        ped?.email || '',
        ped?.telefono || '',
        obtenerCantidadItemsPedido(ped) || obtenerProductosPedido(ped).length,
        obtenerTotalPedido(ped),
        productos,
      ];
    });

    descargarCsv(
      `ventas_filtradas_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Pedido', 'Cliente ID', 'Fecha', 'Estado', 'Direccion', 'Email', 'Telefono', 'Items', 'Total', 'Productos'],
      filas
    );
  };

  const clientesConPedidos = clientes.map((cli) => {
    const pedidosCliente = pedidos.filter((p) => String(p.user_id || p.perfil_id || p.usuario_id || p.cliente_id || '') === String(cli.id));
    const totalGastado = pedidosCliente.reduce((acc, p) => acc + obtenerTotalPedido(p), 0);
    return { ...cli, pedidosCliente, totalGastado };
  });

  const clientesFiltrados = clientesConPedidos.filter((cli) => {
    const q = filtroCliente.trim().toLowerCase();
    if (!q) return true;
    return [cli.nombre, cli.apellido, cli.email, cli.telefono, cli.cuit, cli.id]
      .map((v) => String(v || '').toLowerCase())
      .some((v) => v.includes(q));
  });

  const clientesPorId = clientes.reduce((acc, cli) => {
    acc[String(cli.id)] = cli;
    return acc;
  }, {});

  const exportarClientesExcel = () => {
    const filas = clientesFiltrados.map((cli) => [
      cli.id,
      `${cli.nombre || ''} ${cli.apellido || ''}`.trim(),
      cli.email || '',
      cli.telefono || '',
      cli.cuit || '',
      cli.direccion_envio || '',
      cli.pedidosCliente.length,
      cli.totalGastado,
      cli.pedidosCliente.map((p) => `${obtenerNumeroPedido(p)}:${obtenerEstadoPedido(p)}`).join(' | '),
    ]);

    descargarCsv(
      `clientes_${new Date().toISOString().slice(0, 10)}.csv`,
      ['ID', 'Nombre', 'Email', 'Telefono', 'CUIT', 'Direccion', 'Cantidad pedidos', 'Total comprado', 'Pedidos (Nro:Estado)'],
      filas
    );
  };

  const togglePedidoExpandido = (pedidoId) => {
    setPedidosExpandido((prev) => ({
      ...prev,
      [pedidoId]: !prev[pedidoId],
    }));
  };

  const togglePedidoClienteExpandido = (clienteId, pedidoId) => {
    const key = `${clienteId}-${pedidoId}`;
    setPedidosClienteExpandido((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleClienteExpandido = (clienteId) => {
    setClientesExpandido((prev) => ({
      ...prev,
      [clienteId]: !prev[clienteId],
    }));
  };

  const iniciarEdicionCliente = (cli) => {
    setClienteEditandoId(cli.id);
    setClienteEditado({
      nombre: cli?.nombre || '',
      apellido: cli?.apellido || '',
      email: cli?.email || '',
      telefono: cli?.telefono || '',
      cuit: cli?.cuit || '',
      direccion_envio: cli?.direccion_envio || '',
    });
  };

  const cancelarEdicionCliente = () => {
    setClienteEditandoId(null);
    setClienteEditado({
      nombre: '',
      apellido: '',
      email: '',
      telefono: '',
      cuit: '',
      direccion_envio: '',
    });
  };

  const guardarEdicionCliente = async (clienteId) => {
    setGuardandoClienteId(clienteId);
    try {
      const payload = {
        nombre: String(clienteEditado.nombre || '').trim(),
        apellido: String(clienteEditado.apellido || '').trim(),
        email: String(clienteEditado.email || '').trim(),
        telefono: String(clienteEditado.telefono || '').trim(),
        cuit: String(clienteEditado.cuit || '').trim(),
        direccion_envio: String(clienteEditado.direccion_envio || '').trim(),
      };

      const { error } = await supabase
        .from('perfiles')
        .update(payload)
        .eq('id', clienteId);

      if (error) throw error;

      setClientes((prev) => prev.map((cli) => (
        String(cli.id) === String(clienteId)
          ? { ...cli, ...payload }
          : cli
      )));
      cancelarEdicionCliente();
      alert('Perfil de cliente actualizado.');
    } catch (error) {
      alert('No se pudo actualizar el perfil: ' + (error?.message || 'Error desconocido'));
    } finally {
      setGuardandoClienteId(null);
    }
  };

  const enviarRecuperacionCliente = async (cli) => {
    const email = String(cli?.email || '').trim();
    if (!email) {
      alert('Este cliente no tiene email cargado.');
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      alert(`Se envió el email de recuperación a ${email}.`);
    } catch (error) {
      alert('No se pudo enviar el email de recuperación: ' + (error?.message || 'Error desconocido'));
    }
  };

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn pb-20">
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <div className="bg-red-600 p-4 rounded-3xl shadow-lg text-white"><ShieldCheck size={30}/></div>
          <h2 className="text-2xl md:text-4xl font-black italic uppercase text-gray-800 tracking-tighter">CeliaAdmin</h2>
        </div>
        <div className="flex gap-2 bg-white p-2 rounded-3xl shadow-sm border border-gray-100">
          <button onClick={() => setTab('stock')} className={`px-6 py-2 rounded-2xl font-black text-sm uppercase transition-all ${tab === 'stock' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500'}`}>Stock</button>
          <button onClick={() => setTab('ventas')} className={`px-6 py-2 rounded-2xl font-black text-sm uppercase transition-all ${tab === 'ventas' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500'}`}>Ventas</button>
          <button onClick={() => setTab('clientes')} className={`px-6 py-2 rounded-2xl font-black text-sm uppercase transition-all ${tab === 'clientes' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500'}`}>Clientes</button>
        </div>
      </div>

      {tab === 'stock' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {productoEditando ? (
            <form onSubmit={editarProducto} className="bg-white p-8 rounded-[40px] shadow-xl border border-gray-100 h-fit">
              <h3 className="font-black uppercase text-gray-400 text-[10px] mb-6 tracking-widest text-center">Editar Producto</h3>
              <div className="space-y-4">
                <input type="text" placeholder="NOMBRE" className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xs uppercase" value={productoEditando.nombre} onChange={e => setProductoEditando({...productoEditando, nombre: e.target.value.toUpperCase()})} required />
                <input type="number" placeholder="PRECIO" className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xs" value={productoEditando.precio} onChange={e => setProductoEditando({...productoEditando, precio: e.target.value})} required />
                <input type="number" placeholder="STOCK" className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xs" value={productoEditando.stock} onChange={e => setProductoEditando({...productoEditando, stock: e.target.value})} required />
                <input type="text" placeholder="URL IMAGEN" className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xs" value={productoEditando.imagen_url} onChange={e => setProductoEditando({...productoEditando, imagen_url: e.target.value})} />
                <select className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xs uppercase border border-gray-300" value={productoEditando.categoria} onChange={e => setProductoEditando({...productoEditando, categoria: e.target.value})} required>
                  {CATEGORIAS_PREDEFINIDAS.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-xs font-bold uppercase"><input type="checkbox" checked={productoEditando.activo} onChange={e => setProductoEditando({...productoEditando, activo: e.target.checked})} /> Activo</label>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-green-600 text-white py-3 rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-green-700 transition-colors">Guardar</button>
                  <button type="button" onClick={cancelarEdicion} className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-gray-400 transition-colors">Cancelar</button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={agregarProducto} className="bg-white p-8 rounded-[40px] shadow-xl border border-gray-100 h-fit">
              <h3 className="font-black uppercase text-gray-400 text-[10px] mb-6 tracking-widest text-center">Nuevo Producto</h3>
              <div className="space-y-4">
                <input type="text" placeholder="NOMBRE" className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xs uppercase" value={nuevoP.nombre} onChange={e => setNuevoP({...nuevoP, nombre: e.target.value.toUpperCase()})} required />
                <input type="number" placeholder="PRECIO" className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xs" value={nuevoP.precio} onChange={e => setNuevoP({...nuevoP, precio: e.target.value})} required />
                <input type="number" placeholder="STOCK INICIAL" className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xs" value={nuevoP.stock} onChange={e => setNuevoP({...nuevoP, stock: e.target.value})} required />
                <input type="text" placeholder="URL IMAGEN" className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xs" value={nuevoP.imagen_url} onChange={e => setNuevoP({...nuevoP, imagen_url: e.target.value})} />
                <select className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xs uppercase border border-gray-300" value={nuevoP.categoria} onChange={e => setNuevoP({...nuevoP, categoria: e.target.value})} required>
                  {CATEGORIAS_PREDEFINIDAS.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <button className="w-full bg-red-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-red-700 transition-colors tracking-widest">Publicar en Tienda</button>
              </div>
            </form>
          )}

          <div className="lg:col-span-2 space-y-3">
            {productos.map(p => (
              <div key={p.id} className="bg-white p-5 rounded-[30px] border border-gray-100 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <img src={p.imagen_url} className="w-16 h-16 object-cover rounded-2xl bg-gray-50" alt={p.nombre} />
                  <div>
                    <p className="font-black text-xs uppercase text-gray-800">{p.nombre}</p>
                    <p className="text-green-600 font-black text-lg">${p.precio}</p>
                    <p className={`text-[9px] font-bold ${p.stock <= 0 ? 'text-red-500' : 'text-gray-400'}`}>STOCK: {p.stock} UNIDADES</p>
                    <p className={`text-[9px] font-black ${p.activo ? 'text-green-500' : 'text-red-500'}`}>{p.activo ? 'Activo' : 'Inactivo'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => iniciarEdicion(p)} className="px-3 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase">Editar</button>
                  <button onClick={() => toggleActivo(p)} className={`px-3 py-2 rounded-xl text-white text-[10px] font-black uppercase ${p.activo ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-600 hover:bg-green-700'}`}>{p.activo ? 'Deshabilitar' : 'Habilitar'}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'ventas' && (
        <div>
          <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <p className="text-base md:text-lg font-black uppercase text-gray-600">Pedidos: {pedidosFiltrados.length} / {totalVentas}</p>
            <p className="text-base md:text-lg font-black uppercase text-green-700">Facturación: ${totalFacturadoFiltrado.toFixed(2)} / ${totalFacturado.toFixed(2)}</p>
          </div>

          <div className="mb-6 bg-white rounded-[26px] border border-gray-100 shadow-sm p-4 md:p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Buscar por nro, cliente, email..."
                value={filtroBusqueda}
                onChange={(e) => setFiltroBusqueda(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 font-semibold text-sm"
              />
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 font-semibold text-sm"
              >
                <option value="">Todos los estados</option>
                {ESTADOS_PEDIDO.map((estado) => (
                  <option key={estado} value={estado}>{estado}</option>
                ))}
              </select>
              <input
                type="date"
                value={filtroFechaDesde}
                onChange={(e) => setFiltroFechaDesde(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 font-semibold text-sm"
              />
              <input
                type="date"
                value={filtroFechaHasta}
                onChange={(e) => setFiltroFechaHasta(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 font-semibold text-sm"
              />
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                onClick={exportarVentasExcel}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase"
              >
                Exportar ventas (Excel)
              </button>
              <button
                onClick={() => { setFiltroBusqueda(''); setFiltroEstado(''); setFiltroFechaDesde(''); setFiltroFechaHasta(''); }}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-black uppercase"
              >
                Limpiar filtros
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {pedidosFiltrados.length === 0 && (
              <div className="bg-white border border-gray-100 rounded-[28px] p-8 text-center shadow-sm">
                <p className="text-lg font-black text-gray-700">No hay pedidos que coincidan con los filtros.</p>
                <p className="text-sm font-semibold text-gray-500 mt-2">Ajustá búsqueda, estado o rango de fechas.</p>
              </div>
            )}
            {pedidosFiltrados.map((ped) => {
              const productos = obtenerProductosPedido(ped);
              const estadoActual = obtenerEstadoPedido(ped);
              const clienteId = String(ped.user_id || ped.perfil_id || ped.usuario_id || ped.cliente_id || 'sin-id');
              const expandido = Boolean(pedidosExpandido[ped.id]);
              const editandoFactura = pedidoEditandoId === ped.id;
              const clienteFactura = clientesPorId[clienteId] || {
                id: clienteId,
                email: ped?.email || '',
                telefono: ped?.telefono || '',
                direccion_envio: obtenerDireccionPedido(ped),
              };

              return (
                <div key={ped.id} className="bg-white rounded-[34px] border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-red-600 via-red-500 to-orange-500 p-6 text-white">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs md:text-sm font-black uppercase tracking-[0.2em] text-red-100 mb-2">Pedido #{obtenerNumeroPedido(ped)}</p>
                        <h4 className="font-black text-2xl uppercase tracking-tighter">{clienteFactura.nombre && clienteFactura.apellido ? `${clienteFactura.nombre} ${clienteFactura.apellido}` : 'Cliente'}</h4>
                        <p className="text-sm font-semibold text-red-50 mt-2">Compra: {formatearFechaPedido(ped)}</p>
                        <p className="text-sm font-semibold text-red-100 mt-1">Email: {clienteFactura.email || 'No informado'}</p>
                        <p className="text-sm font-semibold text-red-100 mt-1">Teléfono: {clienteFactura.telefono || 'No informado'}</p>
                        <p className="text-xs font-semibold text-red-100 mt-1 opacity-75 break-all">ID: {clienteId}</p>
                      </div>
                      <div className="flex flex-col gap-3 min-w-[240px]">
                        {productos.length === 0 && (
                          <span className="self-start px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 ring-1 ring-amber-300 text-[11px] font-black uppercase tracking-wide">
                            Pedido legacy sin detalle
                          </span>
                        )}
                        <span className={`self-start px-4 py-2 rounded-full text-sm font-black uppercase tracking-wider ${obtenerClaseEstadoPedido(estadoActual)}`}>
                          {estadoActual}
                        </span>
                        <label className="block">
                          <span className="text-xs font-black uppercase tracking-widest text-red-100">Cambiar estado</span>
                          <select
                            value={estadoActual}
                            disabled={actualizandoPedidoId === ped.id}
                            onChange={(e) => actualizarEstadoPedido(ped, e.target.value)}
                            className="w-full mt-2 rounded-2xl bg-white text-gray-800 px-4 py-3 text-sm font-black uppercase outline-none"
                          >
                            {ESTADOS_PEDIDO.map((estado) => (
                              <option key={estado} value={estado}>{estado}</option>
                            ))}
                          </select>
                        </label>
                        <button
                          onClick={() => togglePedidoExpandido(ped.id)}
                          className="self-start px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-black uppercase tracking-wider"
                        >
                          {expandido ? 'Ocultar detalle' : 'Ver detalle completo'}
                        </button>
                        <button
                          onClick={() => iniciarEdicionFactura(ped)}
                          className="self-start px-4 py-2 rounded-xl bg-amber-300 text-gray-900 hover:bg-amber-200 text-xs font-black uppercase tracking-wider"
                        >
                          {editandoFactura ? 'Editando factura' : 'Editar factura'}
                        </button>
                        <button
                          onClick={() => imprimirFacturaPedidoAdmin(ped, clienteFactura)}
                          className="self-start px-4 py-2 rounded-xl bg-white text-gray-900 hover:bg-gray-100 text-xs font-black uppercase tracking-wider"
                        >
                          Imprimir factura
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 md:p-8 space-y-4">
                    <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 mb-4">
                      <p className="text-xs font-black uppercase tracking-widest text-blue-600 mb-3">Datos del Cliente</p>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <p className="text-[10px] font-bold text-blue-500 uppercase mb-1">Nombre</p>
                          <p className="font-bold text-gray-800">{clienteFactura.nombre && clienteFactura.apellido ? `${clienteFactura.nombre} ${clienteFactura.apellido}` : 'No informado'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-blue-500 uppercase mb-1">Email</p>
                          <p className="font-bold text-gray-800 break-words">{clienteFactura.email || 'No informado'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-blue-500 uppercase mb-1">Teléfono</p>
                          <p className="font-bold text-gray-800">{clienteFactura.telefono || 'No informado'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-blue-500 uppercase mb-1">CUIT</p>
                          <p className="font-bold text-gray-800">{clienteFactura.cuit || 'No informado'}</p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-[10px] font-bold text-blue-500 uppercase mb-1">Dirección de Entrega</p>
                          <p className="font-bold text-gray-800">{clienteFactura.direccion_envio || obtenerDireccionPedido(ped) || 'No informada'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                        <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Total</p>
                        <p className="text-2xl font-black text-green-600 tracking-tighter">{formatearMoneda(obtenerTotalPedido(ped))}</p>
                      </div>
                      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                        <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Items</p>
                        <p className="text-xl font-black text-gray-800">{obtenerCantidadItemsPedido(ped) || productos.length}</p>
                      </div>
                      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 md:col-span-2">
                        <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Dirección de entrega</p>
                        <p className="text-base font-bold text-gray-700 break-words">{obtenerDireccionPedido(ped)}</p>
                      </div>
                    </div>

                    {expandido && productos.length === 0 && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <p className="text-xs font-black uppercase tracking-widest text-amber-700">Pedido histórico sin líneas</p>
                        <p className="text-sm font-semibold text-amber-800 mt-1">Este pedido se guardó sin productos en la base anterior. Los pedidos nuevos ya guardan detalle completo con unidades, precios e imágenes.</p>
                      </div>
                    )}

                    {expandido && (
                      <FacturaPedido
                        pedido={ped}
                        cliente={clienteFactura}
                        mostrarImagenesEnLineas
                        editable={editandoFactura}
                        productosOverride={editandoFactura ? productosFacturaEditados : null}
                        onCambiarLinea={cambiarLineaFactura}
                        onToggleLineaFaltante={toggleLineaFacturaFaltante}
                        onGuardarCambios={() => guardarFacturaEditada(ped)}
                        onCancelarEdicion={cancelarEdicionFactura}
                        guardandoCambios={guardandoFacturaId === ped.id}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'clientes' && (
        <div>
          <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <p className="text-base md:text-lg font-black uppercase text-gray-600">Clientes registrados: {clientesFiltrados.length} / {clientes.length}</p>
            <button
              onClick={exportarClientesExcel}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase w-fit"
            >
              Exportar clientes (Excel)
            </button>
          </div>

          <div className="mb-6 bg-white rounded-[26px] border border-gray-100 shadow-sm p-4 md:p-5">
            <input
              type="text"
              placeholder="Buscar cliente por nombre, email, teléfono, CUIT o ID..."
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 font-semibold text-sm"
            />
          </div>

          {cargandoClientes ? (
            <div className="bg-white rounded-[28px] border border-gray-100 p-8 text-center shadow-sm">
              <p className="text-lg font-black text-gray-700">Cargando clientes...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {clientesFiltrados.length === 0 && (
                <div className="bg-white border border-gray-100 rounded-[28px] p-8 text-center shadow-sm">
                  <p className="text-lg font-black text-gray-700">No hay clientes que coincidan con la búsqueda.</p>
                </div>
              )}

              {clientesFiltrados.map((cli) => {
                const expandidoCliente = Boolean(clientesExpandido[cli.id]);
                const editandoCliente = String(clienteEditandoId || '') === String(cli.id);
                return (
                  <div key={cli.id} className="bg-white rounded-[28px] border border-gray-100 shadow-sm overflow-hidden">
                    {/* Fila compacta: nombre, teléfono, email + botón Ver detalle */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4">
                      <div className="min-w-0">
                        <p className="text-base font-black uppercase tracking-tight text-gray-900 truncate">{`${cli.nombre || ''} ${cli.apellido || ''}`.trim() || 'Sin nombre'}</p>
                        <p className="text-sm font-semibold text-gray-500 truncate">{cli.email || 'Sin email'}</p>
                        <p className="text-sm font-semibold text-gray-500">{cli.telefono || 'Sin teléfono'}</p>
                      </div>
                      <button
                        onClick={() => toggleClienteExpandido(cli.id)}
                        className="shrink-0 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-gray-700 transition-colors"
                      >
                        {expandidoCliente ? 'Ocultar detalle' : 'Ver detalle'}
                      </button>
                    </div>

                    {/* Detalle completo expandido */}
                    {expandidoCliente && (
                      <div className="border-t border-gray-100">
                        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 px-6 py-5 text-white">
                          <div className="flex flex-col gap-3 lg:flex-row lg:justify-between lg:items-center">
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-300 mb-1">Cliente #{String(cli.id || '').slice(0, 8)}</p>
                              <h4 className="font-black text-2xl uppercase tracking-tighter">{`${cli.nombre || ''} ${cli.apellido || ''}`.trim() || 'Sin nombre'}</h4>
                              <p className="text-sm text-gray-300 mt-1 break-all">{cli.email || 'Sin email'}</p>
                            </div>
                            <div className="flex gap-3 flex-wrap">
                              <span className="px-4 py-2 rounded-full bg-white/10 text-sm font-black uppercase">Pedidos: {cli.pedidosCliente.length}</span>
                              <span className="px-4 py-2 rounded-full bg-emerald-500/20 text-sm font-black uppercase text-emerald-200">Total: {formatearMoneda(cli.totalGastado)}</span>
                              <button
                                onClick={() => iniciarEdicionCliente(cli)}
                                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-black uppercase"
                              >
                                Editar perfil
                              </button>
                              <button
                                onClick={() => enviarRecuperacionCliente(cli)}
                                className="px-3 py-2 rounded-xl bg-amber-500/20 text-amber-100 hover:bg-amber-500/35 text-[11px] font-black uppercase"
                              >
                                Enviar recovery
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="p-6 md:p-8 space-y-6 bg-gradient-to-b from-white to-gray-50/60">
                          {editandoCliente && (
                            <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5">
                              <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4">Editar perfil del cliente</p>
                              <div className="grid gap-3 md:grid-cols-2">
                                <input
                                  type="text"
                                  placeholder="Nombre"
                                  value={clienteEditado.nombre}
                                  onChange={(e) => setClienteEditado((prev) => ({ ...prev, nombre: e.target.value }))}
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"
                                />
                                <input
                                  type="text"
                                  placeholder="Apellido"
                                  value={clienteEditado.apellido}
                                  onChange={(e) => setClienteEditado((prev) => ({ ...prev, apellido: e.target.value }))}
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"
                                />
                                <input
                                  type="email"
                                  placeholder="Email"
                                  value={clienteEditado.email}
                                  onChange={(e) => setClienteEditado((prev) => ({ ...prev, email: e.target.value }))}
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold md:col-span-2"
                                />
                                <input
                                  type="text"
                                  placeholder="Telefono"
                                  value={clienteEditado.telefono}
                                  onChange={(e) => setClienteEditado((prev) => ({ ...prev, telefono: e.target.value }))}
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"
                                />
                                <input
                                  type="text"
                                  placeholder="CUIT"
                                  value={clienteEditado.cuit}
                                  onChange={(e) => setClienteEditado((prev) => ({ ...prev, cuit: e.target.value }))}
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"
                                />
                                <input
                                  type="text"
                                  placeholder="Direccion"
                                  value={clienteEditado.direccion_envio}
                                  onChange={(e) => setClienteEditado((prev) => ({ ...prev, direccion_envio: e.target.value }))}
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold md:col-span-2"
                                />
                              </div>
                              <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                  onClick={() => guardarEdicionCliente(cli.id)}
                                  disabled={guardandoClienteId === cli.id}
                                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase disabled:opacity-60"
                                >
                                  {guardandoClienteId === cli.id ? 'Guardando...' : 'Guardar cambios'}
                                </button>
                                <button
                                  onClick={cancelarEdicionCliente}
                                  className="px-4 py-2 rounded-xl bg-gray-200 text-gray-800 text-xs font-black uppercase"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                              <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Teléfono</p>
                              <p className="text-base font-bold text-gray-700 break-words">{cli.telefono || 'No informado'}</p>
                            </div>
                            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                              <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">CUIT</p>
                              <p className="text-base font-bold text-gray-700 break-words">{cli.cuit || 'No informado'}</p>
                            </div>
                            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                              <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Dirección</p>
                              <p className="text-base font-bold text-gray-700 break-words">{cli.direccion_envio || 'No informada'}</p>
                            </div>
                          </div>

                          <div>
                            <h5 className="text-base md:text-lg font-black uppercase tracking-widest text-gray-900 mb-4">Pedidos del cliente</h5>
                            {cli.pedidosCliente.length === 0 ? (
                              <div className="rounded-2xl border border-dashed border-gray-200 p-5 bg-gray-50">
                                <p className="text-sm font-semibold text-gray-600">Este cliente todavía no tiene pedidos.</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {cli.pedidosCliente.map((p) => {
                                  const productosPedido = obtenerProductosPedido(p);
                                  const key = `${cli.id}-${p.id}`;
                                  const expandidoPedidoCliente = Boolean(pedidosClienteExpandido[key]);
                                  return (
                                    <div key={p.id} className="rounded-2xl border border-gray-100 p-4 bg-white">
                                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                        <div>
                                          <p className="text-sm font-black uppercase text-gray-800">Pedido #{obtenerNumeroPedido(p)}</p>
                                          <p className="text-sm font-semibold text-gray-600">{formatearFechaPedido(p)} · {obtenerCantidadItemsPedido(p) || productosPedido.length} items</p>
                                        </div>
                                        <div className="flex items-center gap-3 flex-wrap">
                                          <span className={`px-3 py-1.5 rounded-full text-xs font-black uppercase ${obtenerClaseEstadoPedido(obtenerEstadoPedido(p))}`}>{obtenerEstadoPedido(p)}</span>
                                          <span className="text-base font-black text-green-700">{formatearMoneda(obtenerTotalPedido(p))}</span>
                                          <button
                                            onClick={() => togglePedidoClienteExpandido(cli.id, p.id)}
                                            className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[11px] font-black uppercase"
                                          >
                                            {expandidoPedidoCliente ? 'Ocultar' : 'Ver pedido'}
                                          </button>
                                          <button
                                            onClick={() => imprimirFacturaPedidoAdmin(p, cli)}
                                            className="px-3 py-2 rounded-xl bg-gray-900 text-white hover:bg-gray-700 text-[11px] font-black uppercase"
                                          >
                                            Imprimir
                                          </button>
                                        </div>
                                      </div>

                                      {expandidoPedidoCliente && (
                                        <div className="mt-4 border-t border-gray-100 pt-4">
                                          <FacturaPedido pedido={p} cliente={cli} mostrarImagenesEnLineas />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


export default function App() {
  const [pagina, setPagina] = useState('inicio');
  const [session, setSession] = useState(null);
  const [esLogin, setEsLogin] = useState(true);
  const [mensaje, setMensaje] = useState('');
  const [productosBD, setProductosBD] = useState([]);
  const [redirectAfterLogin, setRedirectAfterLogin] = useState(null);
  const [confirmandoCarrito, setConfirmandoCarrito] = useState(false);
  const [usuarioLogueado, setUsuarioLogueado] = useState(null);
  const [carrito, setCarrito] = useState([]);
  const [mostrarToast, setMostrarToast] = useState(false);
  const [mensajeToast, setMensajeToast] = useState('');
  const [queryBusqueda, setQueryBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [pedidosVersion, setPedidosVersion] = useState(0);
  const [perfilVersion, setPerfilVersion] = useState(0);
  const [datos, setDatos] = useState({ 
    email: '', password: '', nombre: '', apellido: '', cuit: '', telefono: '', direccion: '' 
  });
  const totalItemsCarrito = carrito.reduce((acc, item) => acc + (Number(item?.cantidad) || 1), 0);

  const notificarSincronizacionPedidos = () => setPedidosVersion((prev) => prev + 1);
  const notificarSincronizacionPerfil = () => setPerfilVersion((prev) => prev + 1);

  // --- FUNCIÓN AGREGAR AL CARRITO (CORREGIDA) ---
  const agregarAlCarrito = (producto) => {
    if (!producto.activo) {
      alert("Este producto está deshabilitado y no puede agregarse al carrito.");
      return;
    }

    if (producto.stock <= 0) {
      alert("Lo sentimos, este producto no tiene stock disponible.");
      return;
    }

    setCarrito((prev) => {
      const existe = prev.find(item => item.id === producto.id);
      if (existe) {
        return prev.map(item => 
          item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      }
      // Forzamos Number(producto.precio) para evitar el error de $NaN
      return [...prev, { ...producto, precio: Number(producto.precio), cantidad: 1 }];
    });

    setMensajeToast('Producto agregado al carrito');
    setMostrarToast(true);
    setTimeout(() => setMostrarToast(false), 2000);
  };

  const refrescarPerfil = async () => {
    if (!session?.user) return;
    const { data } = await supabase.from('perfiles').select('*').eq('id', session.user.id).maybeSingle();
    if (data) setUsuarioLogueado(data);
    else setUsuarioLogueado({ id: session.user.id, email: session.user.email });
  };

  useEffect(() => {
    const traerPerfil = async (sessionActual) => {
      if (!sessionActual?.user) return;
      const { data } = await supabase.from('perfiles').select('*').eq('id', sessionActual.user.id).maybeSingle();
      if (data) setUsuarioLogueado(data);
      else setUsuarioLogueado({ id: sessionActual.user.id, email: sessionActual.user.email });
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) traerPerfil(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) traerPerfil(session);
      else { setUsuarioLogueado(null); setPagina('inicio'); }
    });

    fetchProductos();
    return () => subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('pedidos-sync-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        notificarSincronizacionPedidos();
      })
      .subscribe();

    const intervalo = window.setInterval(() => {
      notificarSincronizacionPedidos();
    }, 15000);

    const onStorage = (event) => {
      if (event.key === PEDIDOS_SNAPSHOT_KEY) notificarSincronizacionPedidos();
    };

    window.addEventListener('storage', onStorage);

    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener('storage', onStorage);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const profileChannel = supabase
      .channel('perfil-sync-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'perfiles' }, (payload) => {
        const idAfectado = payload?.new?.id || payload?.old?.id;
        if (session?.user?.id && idAfectado === session.user.id) {
          notificarSincronizacionPerfil();
        }
      })
      .subscribe();

    const intervaloPerfil = window.setInterval(() => {
      if (session?.user?.id) notificarSincronizacionPerfil();
    }, 15000);

    return () => {
      window.clearInterval(intervaloPerfil);
      supabase.removeChannel(profileChannel);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user) return;
    refrescarPerfil();
  }, [perfilVersion, session?.user?.id]);

  const fetchProductos = async () => {
    const { data } = await supabase.from('productos').select('*').order('nombre');
    setProductosBD(data || []);
  };

  const manejarAccion = async (e) => {
    e.preventDefault();
    try {
          if (esLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: datos.email, password: datos.password });
        if (error) throw error;

        if (redirectAfterLogin === 'checkout') {
          setPagina('carrito');
          setConfirmandoCarrito(true);
          setRedirectAfterLogin(null);
        } else if (redirectAfterLogin === 'carrito') {
          setPagina('carrito');
          setRedirectAfterLogin(null);
        } else {
          setPagina('inicio');
        }
      } else {
        const { data, error } = await supabase.auth.signUp({ email: datos.email, password: datos.password });
        if (error) throw error;
        if (data.user) {
          await supabase.from('perfiles').insert([{
            id: data.user.id, nombre: datos.nombre, apellido: datos.apellido,
            cuit: datos.cuit, email: datos.email, telefono: datos.telefono, direccion_envio: datos.direccion
          }]);
        }
        setEsLogin(true);
      }
    } catch (err) { setMensaje(err.message); }
  };

  return (
    <div className="premium-shell min-h-screen flex flex-col">
      <nav className="sticky top-3 z-50 mx-auto w-[min(98%,1700px)] premium-nav rounded-[30px] px-5 py-5 md:px-10 md:py-6">
        <div className="flex flex-col items-center gap-5">
          <div onClick={() => setPagina('inicio')} className="cursor-pointer flex items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 md:w-18 md:h-18 rounded-2xl bg-white/80 border border-white shadow-lg flex items-center justify-center">
              <img src={URL_LOGO} alt="Logo" className="h-11 md:h-12 w-auto" />
            </div>
            <div>
              <p className="text-xs md:text-sm font-black uppercase tracking-[0.3em] text-green-600">CeliaShop</p>
              <p className="text-sm md:text-base font-bold text-gray-600">Mercado premium sin TACC</p>
            </div>
          </div>

          <div className="w-full flex flex-wrap justify-center items-center gap-3 text-sm md:text-base font-black uppercase tracking-wide text-gray-700">
            <button onClick={() => setPagina('inicio')} className={`px-7 py-3 rounded-full transition-colors ${pagina === 'inicio' ? 'bg-green-600 text-white shadow-md' : 'bg-white/75 hover:bg-white'}`}>Inicio</button>
            <button onClick={() => setPagina('productos')} className={`px-7 py-3 rounded-full transition-colors ${pagina === 'productos' ? 'bg-green-600 text-white shadow-md' : 'bg-white/75 hover:bg-white'}`}>Tienda</button>
            <button onClick={() => setPagina('carrito')} className={`px-7 py-3 rounded-full transition-colors ${pagina === 'carrito' ? 'bg-green-600 text-white shadow-md' : 'bg-white/75 hover:bg-white'}`}>Carrito ({totalItemsCarrito})</button>

            {session ? (
              <>
                {session.user.email === 'giannattasio.nicolas@hotmail.com' && (
                  <button
                    onClick={() => setPagina('admin')}
                    className={`px-6 py-3 rounded-full transition-colors flex items-center gap-2 ${pagina === 'admin' ? 'bg-red-600 text-white shadow-md' : 'bg-white/75 hover:bg-white'}`}
                  >
                    <ShieldCheck size={20} />
                    Admin
                  </button>
                )}
                <button onClick={() => setPagina('perfil')} className={`px-7 py-3 rounded-full transition-colors ${pagina === 'perfil' ? 'bg-green-600 text-white shadow-md' : 'bg-white/75 hover:bg-white'}`}>Mi Cuenta</button>
                <button onClick={() => setPagina('pedidos')} className={`px-7 py-3 rounded-full transition-colors ${pagina === 'pedidos' ? 'bg-green-600 text-white shadow-md' : 'bg-white/75 hover:bg-white'}`}>Mis Pedidos</button>
                <button onClick={() => supabase.auth.signOut()} className="px-7 py-3 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors">Salir</button>
              </>
            ) : (
              <>
                <button onClick={() => { setPagina('cuenta'); setEsLogin(true); }} className="bg-gray-900 text-white px-7 py-3 rounded-2xl text-sm md:text-base font-black uppercase tracking-widest shadow-lg">Entrar</button>
                <button onClick={() => { setPagina('cuenta'); setEsLogin(false); }} className="bg-green-600 text-white px-7 py-3 rounded-2xl text-sm md:text-base font-black uppercase tracking-widest shadow-lg">Crear cuenta</button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="premium-main max-w-7xl mx-auto px-4 py-8 md:py-10 flex-grow w-full">
        {pagina === 'inicio' && (
          <div className="space-y-12">
            <div className="premium-hero text-center py-12 px-6 md:px-12 md:py-24 rounded-[42px] text-white">
              <div className="relative z-10 max-w-4xl mx-auto">
                <div className="flex flex-wrap justify-center gap-3 mb-6">
                  <span className="premium-chip px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.25em] text-green-200">Sin TACC real</span>
                  <span className="premium-chip px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.25em] text-orange-100">Entrega en Azul</span>
                  <span className="premium-chip px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.25em] text-white">Selección premium</span>
                </div>
                <h1 className="text-4xl md:text-7xl italic uppercase tracking-tighter leading-none">Comer rico, comprar fácil, vivir sin gluten.</h1>
                <p className="text-white/70 font-bold mt-6 uppercase text-xs tracking-[0.25em] max-w-2xl mx-auto">Una tienda con estética cuidada, productos seleccionados y una experiencia que invita a volver.</p>
                <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
                  <button onClick={() => setPagina('productos')} className="bg-white text-gray-900 px-8 md:px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Explorar catálogo</button>
                  <button onClick={() => { setPagina('cuenta'); setEsLogin(false); }} className="bg-green-600 text-white px-8 md:px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Crear cuenta</button>
                </div>
              </div>
            </div>
            <Carrusel productos={productosBD} agregarAlCarrito={agregarAlCarrito} />
            <div className="premium-panel rounded-[40px] p-10 md:p-12">
              <h2 className="text-2xl md:text-4xl italic text-gray-900 uppercase tracking-tighter text-center mb-3">Por qué elegir CeliaShop</h2>
              <p className="text-center text-sm text-gray-500 font-semibold mb-10">Diseñamos una compra simple, confiable y antojadiza desde el primer scroll.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="bg-green-100/80 p-6 rounded-[26px] mb-4 border border-green-200">
                    <h3 className="text-xl uppercase text-green-700">Sin TACC</h3>
                  </div>
                  <p className="text-gray-600 font-medium">Todos nuestros productos están libres de gluten y son aptos para celíacos.</p>
                </div>
                <div className="text-center">
                  <div className="bg-orange-100/80 p-6 rounded-[26px] mb-4 border border-orange-200">
                    <h3 className="text-xl uppercase text-orange-700">Calidad Premium</h3>
                  </div>
                  <p className="text-gray-600 font-medium">Seleccionamos los mejores ingredientes para garantizar la máxima calidad.</p>
                </div>
                <div className="text-center">
                  <div className="bg-gray-900 p-6 rounded-[26px] mb-4 border border-gray-800">
                    <h3 className="text-xl uppercase text-white">Entrega Rápida</h3>
                  </div>
                  <p className="text-gray-600 font-medium">Entregamos en Azul y alrededores con el mejor servicio de envío.</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {pagina === 'productos' && (
          <div className="space-y-6">
            <div className="premium-panel rounded-[32px] p-5 md:p-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar productos..."
                  value={queryBusqueda}
                  onChange={(e) => setQueryBusqueda(e.target.value)}
                  className="premium-input w-full pl-10 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
                />
              </div>
              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="premium-input px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500 font-medium w-full sm:w-auto"
              >
                <option value="">Todas las categorías</option>
                {[...new Set([...CATEGORIAS_PREDEFINIDAS, ...productosBD.map(p => p.categoria).filter(Boolean)])].sort().map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {productosBD.filter(p => 
                p.nombre.toLowerCase().includes(queryBusqueda.toLowerCase()) && 
                (categoriaFiltro === '' || p.categoria === categoriaFiltro)
              ).map(p => (
              <div key={p.id} className="premium-product-card p-4 rounded-[28px] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                <img src={p.imagen_url} className="h-32 w-full object-cover rounded-xl mb-3" alt={p.nombre} />
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{p.categoria || 'Sin categoría'}</p>
                <h3 className="font-bold uppercase text-xs text-gray-800">{p.nombre}</h3>
                <p className="text-green-600 font-black text-lg mb-2">${p.precio}</p>
                {!p.activo ? (
                  <p className="text-red-500 font-black text-xs uppercase mb-2">Deshabilitado - sin stock</p>
                ) : p.stock <= 0 ? (
                  <p className="text-red-500 font-black text-xs uppercase mb-2">Sin stock</p>
                ) : (
                  <p className="text-gray-400 font-black text-xs uppercase mb-2">Stock: {p.stock}</p>
                )}
                <button
                  onClick={() => agregarAlCarrito(p)}
                  disabled={!p.activo || p.stock <= 0}
                  className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase transition-colors ${!p.activo || p.stock <= 0 ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-green-600'}`}>
                  {p.activo && p.stock > 0 ? 'Agregar' : 'No disponible'}
                </button>
              </div>
            ))}
          </div>
        </div>
        )}

        {pagina === 'carrito' && (
          <SeccionCarrito
            carrito={carrito}
            setCarrito={setCarrito}
            setPagina={setPagina}
            usuarioLogueado={usuarioLogueado}
            session={session}
            setRedirectAfterLogin={setRedirectAfterLogin}
            setEsLogin={setEsLogin}
            confirmandoCarrito={confirmandoCarrito}
            setConfirmandoCarrito={setConfirmandoCarrito}
            setMensajeToast={setMensajeToast}
            setMostrarToast={setMostrarToast}
          />
        )}
        {pagina === 'perfil' && (
          <SeccionPerfil usuarioLogueado={usuarioLogueado} user={session?.user} onRefrescar={refrescarPerfil} />
        )}
        {pagina === 'pedidos' && (
          <SeccionPedidos usuarioLogueado={usuarioLogueado} pedidosVersion={pedidosVersion} />
        )}

        {/* Aquí es donde aparece tu AdminPanel.jsx */}
        {pagina === 'admin' && (
          <AdminPanel productos={productosBD} traerProductos={fetchProductos} pedidosVersion={pedidosVersion} onPedidosSync={notificarSincronizacionPedidos} />
        )}
        {pagina === 'cuenta' && (
          <div className="max-w-md mx-auto premium-panel p-10 rounded-[40px] mt-4">
            <h2 className="text-3xl italic text-gray-900 mb-3 text-center uppercase">{esLogin ? 'Ingresar' : 'Registrarse'}</h2>
            <p className="text-center text-xs uppercase tracking-[0.22em] text-gray-400 font-black mb-8">Tu acceso a compras, seguimiento y productos premium</p>
            {mensaje && <p className="text-sm text-red-500 mb-4">{mensaje}</p>}
            <form onSubmit={manejarAccion} className="space-y-3">
              <input type="email" placeholder="EMAIL" className="premium-input w-full p-4 rounded-2xl text-xs font-bold" value={datos.email} onChange={e => setDatos({...datos, email: e.target.value})} required />
              <input type="password" placeholder="CONTRASEÑA" className="premium-input w-full p-4 rounded-2xl text-xs font-bold" value={datos.password} onChange={e => setDatos({...datos, password: e.target.value})} required />

              {!esLogin && (
                <>
                  <input type="text" placeholder="NOMBRE" className="premium-input w-full p-4 rounded-2xl text-xs font-bold" value={datos.nombre} onChange={e => setDatos({...datos, nombre: e.target.value})} required />
                  <input type="text" placeholder="APELLIDO" className="premium-input w-full p-4 rounded-2xl text-xs font-bold" value={datos.apellido} onChange={e => setDatos({...datos, apellido: e.target.value})} required />
                  <input type="text" placeholder="CUIT" className="premium-input w-full p-4 rounded-2xl text-xs font-bold" value={datos.cuit} onChange={e => setDatos({...datos, cuit: e.target.value})} required />
                  <input type="text" placeholder="TELÉFONO" className="premium-input w-full p-4 rounded-2xl text-xs font-bold" value={datos.telefono} onChange={e => setDatos({...datos, telefono: e.target.value})} required />
                  <input type="text" placeholder="DIRECCIÓN" className="premium-input w-full p-4 rounded-2xl text-xs font-bold" value={datos.direccion} onChange={e => setDatos({...datos, direccion: e.target.value})} required />
                </>
              )}

              <button type="submit" className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black uppercase mt-4 shadow-lg hover:bg-green-600 transition-colors">Continuar</button>
            </form>
            <button onClick={() => { setEsLogin(!esLogin); setMensaje(''); }} className="w-full mt-6 text-[10px] font-bold text-gray-400 uppercase text-center">{esLogin ? '¿No tenés cuenta? Registrate' : 'Ya tengo cuenta'}</button>
          </div>
        )}
      </main>

      {mostrarToast && (
        <div className="premium-toast fixed bottom-8 right-4 md:right-10 text-white px-8 py-4 rounded-[20px] font-black uppercase text-[10px] z-50">
          {mensajeToast}
        </div>
      )}
    </div>
  );
}