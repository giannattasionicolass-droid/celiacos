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
    metodoPago: pedido?.metodo_pago || pedido?.forma_pago || pedido?.tipo_pago || '',
    emailConfirmacion: pedido?.email_confirmacion || pedido?.email || cliente?.email || '',
    comprobanteUrl: pedido?.comprobante_pago_url || pedido?.comprobante_url || '',
    comprobanteNombre: pedido?.comprobante_pago_nombre || pedido?.comprobante_nombre || '',
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

const extraerMensajeErrorInvoke = async (error) => {
  if (!error) return 'Error desconocido al enviar email.';

  if (typeof error === 'string') return error;

  const baseMessage = String(error?.message || '').trim();
  const context = error?.context;

  if (context) {
    try {
      const response = typeof context.clone === 'function' ? context.clone() : context;
      if (typeof response?.json === 'function') {
        const body = await response.json();
        if (body?.error) return String(body.error);
        if (body?.message) return String(body.message);
      }
    } catch {
      // Intentamos extraer texto plano si json falla.
      try {
        const response = typeof context.clone === 'function' ? context.clone() : context;
        if (typeof response?.text === 'function') {
          const text = await response.text();
          if (text) return String(text);
        }
      } catch {
        // Sin más detalle disponible.
      }
    }
  }

  return baseMessage || 'Error desconocido al enviar email.';
};

const normalizarMensajeEmailUsuario = (mensajeTecnico) => {
  const mensaje = String(mensajeTecnico || '').trim();
  const lower = mensaje.toLowerCase();

  if (lower.includes('you can only send testing emails')) {
    return 'Resend esta en modo prueba: solo puede enviar a celiashopazul@gmail.com. Verifica un dominio en Resend y actualiza ORDER_EMAIL_FROM.';
  }

  if (lower.includes('solo un administrador puede notificar')) {
    return 'Solo un usuario administrador puede enviar esta notificacion.';
  }

  if (lower.includes('el pedido no tiene email del cliente')) {
    return 'El pedido no tiene email del cliente cargado.';
  }

  return 'No pudimos confirmar el envio del email. Revisa la configuracion de Resend.';
};

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
    const detalle = await extraerMensajeErrorInvoke(error);
    const mensaje = normalizarMensajeEmailUsuario(detalle);
    console.error('No se pudo enviar el email del pedido:', detalle, error);
    return { ok: false, error, mensaje, detalle };
  }
};

export const enviarMensajeContacto = async ({ nombre, email, telefono = '', mensaje, userId = null }) => {
  const nombreLimpio = String(nombre || '').trim();
  const emailLimpio = String(email || '').trim();
  const telefonoLimpio = String(telefono || '').trim();
  const mensajeLimpio = String(mensaje || '').trim();

  const abrirFallbackMailto = () => {
    if (typeof window === 'undefined') return false;
    const subject = `Contacto web - ${nombreLimpio || 'Cliente'}`;
    const body = [
      `Nombre: ${nombreLimpio}`,
      `Email: ${emailLimpio}`,
      `Telefono: ${telefonoLimpio || 'No informado'}`,
      `Usuario: ${userId || 'anonimo'}`,
      '',
      'Mensaje:',
      mensajeLimpio,
    ].join('\n');

    const href = `mailto:${EMAIL_CELIASHOP}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    return true;
  };

  try {
    const payload = {
      eventType: 'contacto_mensaje',
      shop: {
        email: EMAIL_CELIASHOP,
      },
      customer: {
        id: userId,
        nombre: nombreLimpio,
        email: emailLimpio,
        telefono: telefonoLimpio,
      },
      contact: {
        nombre: nombreLimpio,
        email: emailLimpio,
        telefono: telefonoLimpio,
        mensaje: mensajeLimpio,
        origen: 'contacto_web',
      },
    };

    const { data, error } = await supabase.functions.invoke('order-email', {
      body: payload,
    });

    if (error) {
      throw error;
    }

    return { ok: true, data };
  } catch (error) {
    const detalle = await extraerMensajeErrorInvoke(error);
    console.error('No se pudo enviar el mensaje de contacto:', detalle, error);

    const fallbackAbierto = abrirFallbackMailto();
    if (fallbackAbierto) {
      return {
        ok: true,
        fallback: 'mailto',
        mensaje: 'Abrimos tu app de correo para completar el envio del mensaje.',
      };
    }

    return {
      ok: false,
      error,
      detalle,
      mensaje: 'No pudimos enviar tu mensaje por ahora. Intenta nuevamente en unos minutos.',
    };
  }
};
