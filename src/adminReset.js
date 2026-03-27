import { supabase } from './supabaseClient';

const extraerMensajeErrorInvoke = async (error) => {
  if (!error) return 'Error desconocido al resetear datos.';
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
      try {
        const response = typeof context.clone === 'function' ? context.clone() : context;
        if (typeof response?.text === 'function') {
          const text = await response.text();
          if (text) return String(text);
        }
      } catch {
        // Sin más detalle.
      }
    }
  }

  return baseMessage || 'Error desconocido al resetear datos.';
};

const normalizarMensajeReset = (detalle) => {
  const mensaje = String(detalle || '').trim();
  const lower = mensaje.toLowerCase();

  if (lower.includes('no route matched') || lower.includes('function not found')) {
    return 'La funcion reset-test-data aun no esta desplegada en Supabase.';
  }

  if (lower.includes('solo un administrador')) {
    return 'Solo el admin puede ejecutar el reseteo de prueba.';
  }

  return mensaje || 'No se pudo resetear la base de clientes de prueba.';
};

export const resetearDatosPrueba = async () => {
  try {
    const { data, error } = await supabase.functions.invoke('reset-test-data', {
      body: { preserveAdminEmail: 'giannattasio.nicolas@hotmail.com' },
    });

    if (error) throw error;
    return { ok: true, data };
  } catch (error) {
    const detalle = await extraerMensajeErrorInvoke(error);
    return {
      ok: false,
      error,
      detalle,
      mensaje: normalizarMensajeReset(detalle),
    };
  }
};