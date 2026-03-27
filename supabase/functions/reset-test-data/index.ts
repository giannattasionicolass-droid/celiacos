import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_ADMIN_EMAIL = 'giannattasio.nicolas@hotmail.com';

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...CORS_HEADERS,
    'Content-Type': 'application/json',
  },
});

const getAuthenticatedUser = async (authorization: string) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan variables SUPABASE_URL o SUPABASE_ANON_KEY en la función.');
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: authorization,
    },
  });

  if (!response.ok) {
    throw new Error('Sesion invalida para resetear datos de prueba.');
  }

  return await response.json();
};

const borrarPedidosNoAdmin = async (adminClient: ReturnType<typeof createClient>, adminId: string) => {
  const { data, error } = await adminClient
    .from('pedidos')
    .select('*');

  if (error) throw error;

  const pedidos = Array.isArray(data) ? data : [];
  const idsABorrar = pedidos
    .filter((pedido) => {
      const ownerId = String(
        pedido?.user_id || pedido?.perfil_id || pedido?.usuario_id || pedido?.cliente_id || ''
      );
      return ownerId && ownerId !== adminId;
    })
    .map((pedido) => pedido.id)
    .filter(Boolean);

  for (let index = 0; index < idsABorrar.length; index += 200) {
    const chunk = idsABorrar.slice(index, index + 200);
    const { error: deleteError } = await adminClient
      .from('pedidos')
      .delete()
      .in('id', chunk);

    if (deleteError) throw deleteError;
  }

  return idsABorrar.length;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const authorization = req.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Debes estar autenticado para resetear datos.' }, 401);
    }

    const user = await getAuthenticatedUser(authorization);
    const preserveAdminEmail = String((await req.json().catch(() => ({})))?.preserveAdminEmail || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
    const userEmail = String(user?.email || '').trim().toLowerCase();

    if (userEmail !== preserveAdminEmail) {
      return jsonResponse({ error: 'Solo un administrador puede resetear los datos de prueba.' }, 403);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en la función.' }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers();
    if (usersError) throw usersError;

    const adminUser = usersData?.users?.find((item) => String(item?.email || '').trim().toLowerCase() === preserveAdminEmail);
    if (!adminUser?.id) {
      return jsonResponse({ error: `No se encontro el admin ${preserveAdminEmail} en auth.users.` }, 404);
    }

    const pedidosEliminados = await borrarPedidosNoAdmin(adminClient, adminUser.id);

    const { error: perfilesError } = await adminClient
      .from('perfiles')
      .delete()
      .neq('id', adminUser.id);

    if (perfilesError) throw perfilesError;

    let usuariosEliminados = 0;
    const users = Array.isArray(usersData?.users) ? usersData.users : [];
    for (const authUser of users) {
      if (!authUser?.id || authUser.id === adminUser.id) continue;
      const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(authUser.id);
      if (deleteUserError) throw deleteUserError;
      usuariosEliminados += 1;
    }

    return jsonResponse({
      ok: true,
      preservedAdmin: preserveAdminEmail,
      pedidosEliminados,
      usuariosEliminados,
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'No se pudo resetear la base de prueba.' }, 500);
  }
});