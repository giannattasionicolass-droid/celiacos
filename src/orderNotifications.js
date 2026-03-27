import { supabase } from './supabaseClient';

const EMAIL_CELIASHOP = 'celiashopazul@gmail.com';
const ESTADOS_PEDIDO = ['Pendiente', 'Confirmado', 'Enviado', 'Entregado'];

const obtenerProductosPedido = (pedido) => {
  const candidatos = [pedido?.productos, pedido?.items, pedido?.detalle, pedido?.carrito];
  for (const valor of candidatos) {
    if (Array.isArray(valor)) return valor;
    if (typeof valor === 'string') {
      try {
        const parsed = JSON.parse(valor);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Ignorar strings que no sean JSON.
      }
    }
  }
  return [];
};

const normalizarEstadoPedido = (valorA, valorB) => {
  const estadosValidos = new Set(ESTADOS_PEDIDO.map((estado) => estado.toLowerCase()));
  const candidatos = [valorA, valorB]
    .map((valor) => String(valor || '').trim())
    .filter(Boolean);

  for (const candidato of candidatos) {
    const lower = candidato.toLowerCase();
    if (estadosValidos.has(lower)) {
      return ESTADOS_PEDIDO.find((estado) => estado.toLowerCase() === lower) || 'Pendiente';
    }
  }

  return 'Pendiente';
};

const obtenerEstadoPedido = (pedido) => normalizarEstadoPedido(pedido?.estado, pedido?.status);
const obtenerTotalPedido = (pedido) => Number(pedido?.total ?? pedido?.monto ?? pedido?.importe ?? pedido?.precio_total ?? 0);
const obtenerDireccionPedido = (pedido) => pedido?.direccion_entrega || pedido?.direccion || pedido?.direccion_envio || pedido?.domicilio || 'Sin dirección cargada';
const obtenerFechaPedido = (pedido) => pedido?.created_at || pedido?.fecha || new Date().toISOString();
const obtenerNumeroPedido = (pedido) => String(pedido?.id || 'sin-id').replace(/-/g, '').slice(0, 8).toUpperCase();

const construirPayloadPedido = ({ pedido, cliente = {}, estadoAnterior = null, tipo }) => ({
  eventType: tipo,
  shop: {
    email: EMAIL_CELIASHOP,
  },
  order: {
    id: pedido?.id || null,
    numero: obtenerNumeroPedido(pedido),
    estado: obtenerEstadoPedido(pedido),
    estadoAnterior: estadoAnterior || null,
    fecha: obtenerFechaPedido(pedido),
    total: obtenerTotalPedido(pedido),
    direccion: obtenerDireccionPedido(pedido),
    productos: obtenerProductosPedido(pedido).map((item) => ({
      id: item?.id || null,
      nombre: item?.nombre || 'Producto sin nombre',
      cantidad: Number(item?.cantidad) || 1,
      precio: Number(item?.precio) || 0,
      imagen_url: item?.imagen_url || '',
    })),
    user_id: pedido?.user_id || pedido?.perfil_id || pedido?.usuario_id || pedido?.cliente_id || cliente?.id || null,
  },
  customer: {
    id: cliente?.id || pedido?.user_id || pedido?.perfil_id || pedido?.usuario_id || pedido?.cliente_id || null,
    nombre: cliente?.nombre || '',
    apellido: cliente?.apellido || '',
    email: pedido?.email || cliente?.email || '',
    telefono: pedido?.telefono || cliente?.telefono || '',
    cuit: cliente?.cuit || pedido?.cuit || '',
    direccion: obtenerDireccionPedido(pedido) || cliente?.direccion_envio || '',
  },
});

export const enviarEmailPedido = async ({ tipo, pedido, cliente = {}, estadoAnterior = null }) => {
  try {
    const payload = construirPayloadPedido({ tipo, pedido, cliente, estadoAnterior });
    const { data, error } = await supabase.functions.invoke('order-email', {
      body: payload,
    });

    if (error) {
      throw error;
    }

    return { ok: true, data };
  } catch (error) {
    console.error('No se pudo enviar el email del pedido:', error);
    return { ok: false, error };
  }
};
