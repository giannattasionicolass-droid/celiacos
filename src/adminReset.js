import { supabase } from './supabaseClient';

const ADMIN_EMAIL_RESET = 'giannattasio.nicolas@hotmail.com';

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

  if (lower.includes('failed to send a request to the edge function')) {
    return 'No se pudo conectar con la funcion reset-test-data. Normalmente significa que aun no esta desplegada o que falta configurarla en Supabase.';
  }

  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Error de red al llamar la funcion reset-test-data. Verifica conexion y que la funcion exista en Supabase.';
  }

  if (lower.includes('solo un administrador')) {
    return 'Solo el admin puede ejecutar el reseteo de prueba.';
  }

  return mensaje || 'No se pudo resetear la base de clientes de prueba.';
};

export const resetearDatosPrueba = async () => {
  try {
    const { data, error } = await supabase.functions.invoke('reset-test-data', {
      body: { preserveAdminEmail: ADMIN_EMAIL_RESET },
    });

    if (error) throw error;
    return { ok: true, data };
  } catch (error) {
    const detalleEdge = await extraerMensajeErrorInvoke(error);
    const lowerEdge = String(detalleEdge || '').toLowerCase();

    const deberiaIntentarRpc =
      lowerEdge.includes('failed to send a request to the edge function')
      || lowerEdge.includes('no route matched')
      || lowerEdge.includes('function not found')
      || lowerEdge.includes('network')
      || lowerEdge.includes('fetch');

    if (deberiaIntentarRpc) {
      try {
        const { data: dataRpc, error: errorRpc } = await supabase.rpc('reset_test_data', {
          preserve_admin_email: ADMIN_EMAIL_RESET,
        });

        if (errorRpc) throw errorRpc;
        return { ok: true, data: dataRpc };
      } catch (rpcError) {
        const detalleRpc = await extraerMensajeErrorInvoke(rpcError);
        const detalle = `${detalleEdge} | RPC: ${detalleRpc}`;
        return {
          ok: false,
          error: rpcError,
          detalle,
          mensaje: normalizarMensajeReset(detalle),
        };
      }
    }

    return {
      ok: false,
      error,
      detalle: detalleEdge,
      mensaje: normalizarMensajeReset(detalleEdge),
    };
  }
};