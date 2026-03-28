import { supabase } from './supabaseClient';

const ADMIN_EMAIL_RESET_FALLBACK = 'giannattasio.nicolas@hotmail.com';

const obtenerEmailAdminObjetivo = async () => {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;

    const email = String(data?.user?.email || '').trim().toLowerCase();
    if (email) return email;
  } catch {
    // Si no se puede resolver el usuario actual, usamos el admin por defecto.
  }

  return ADMIN_EMAIL_RESET_FALLBACK;
};

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

  if (
    lower.includes('could not find the function public.reset_test_data')
    || lower.includes('function public.reset_test_data') && lower.includes('does not exist')
    || lower.includes('schema cache') && lower.includes('reset_test_data')
    || lower.includes('pgrst202')
  ) {
    return 'Falta crear la funcion RPC reset_test_data en Supabase. Ejecuta supabase/reset-test-data-rpc.sql en SQL Editor y vuelve a probar.';
  }

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

  if (lower.includes('debes estar autenticado') || lower.includes('sesion invalida') || lower.includes('no hay sesion autenticada')) {
    return 'Tu sesion admin no es valida para resetear. Cerra sesion, volve a entrar con el admin y reintenta.';
  }

  return mensaje || 'No se pudo resetear la base de clientes de prueba.';
};

export const resetearDatosPrueba = async () => {
  const adminEmail = await obtenerEmailAdminObjetivo();

  try {
    const { data, error } = await supabase.functions.invoke('reset-test-data', {
      body: { preserveAdminEmail: adminEmail },
    });

    if (error) throw error;
    return { ok: true, data };
  } catch (error) {
    const detalleEdge = await extraerMensajeErrorInvoke(error);
    try {
      const { data: dataRpc, error: errorRpc } = await supabase.rpc('reset_test_data', {
        preserve_admin_email: adminEmail,
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
};