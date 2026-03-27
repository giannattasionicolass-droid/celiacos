const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_SHOP_EMAIL = 'celiashopazul@gmail.com';
const DEFAULT_ADMIN_EMAILS = ['giannattasio.nicolas@hotmail.com'];

type Product = {
  id?: string | null;
  nombre?: string;
  cantidad?: number;
  precio?: number;
  imagen_url?: string;
};

type Customer = {
  id?: string | null;
  nombre?: string;
  apellido?: string;
  email?: string;
  telefono?: string;
  cuit?: string;
  direccion?: string;
};

type Order = {
  id?: string | null;
  numero?: string;
  estado?: string;
  estadoAnterior?: string | null;
  fecha?: string;
  total?: number;
  direccion?: string;
  productos?: Product[];
  user_id?: string | null;
};

type Payload = {
  eventType?: 'pedido_creado' | 'estado_actualizado';
  shop?: { email?: string };
  customer?: Customer;
  order?: Order;
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...CORS_HEADERS,
    'Content-Type': 'application/json',
  },
});

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatCurrency = (value: unknown) => `$${Number(value || 0).toFixed(2)}`;

const formatDate = (value: string | undefined) => {
  if (!value) return 'Sin fecha registrada';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const getCustomerName = (customer: Customer = {}) => {
  const fullName = [customer.nombre, customer.apellido].filter(Boolean).join(' ').trim();
  return fullName || 'Cliente CeliaShop';
};

const getProducts = (order: Order = {}) => Array.isArray(order.productos) ? order.productos : [];

const renderInvoice = (order: Order = {}, customer: Customer = {}, shopEmail = DEFAULT_SHOP_EMAIL) => {
  const rows = getProducts(order).length === 0
    ? '<tr><td colspan="4" style="padding:12px;border:1px solid #e5e7eb;font-size:12px;color:#6b7280;">Sin productos disponibles</td></tr>'
    : getProducts(order).map((item) => {
        const quantity = Number(item?.cantidad) || 1;
        const price = Number(item?.precio) || 0;
        const subtotal = quantity * price;
        return `<tr>
          <td style="padding:12px;border:1px solid #e5e7eb;font-size:12px;font-weight:700;">${escapeHtml(item?.nombre || 'Producto sin nombre')}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;font-size:12px;text-align:center;">${quantity}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;font-size:12px;text-align:right;">${escapeHtml(formatCurrency(price))}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;font-size:12px;text-align:right;font-weight:800;">${escapeHtml(formatCurrency(subtotal))}</td>
        </tr>`;
      }).join('');

  return `<div style="border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#0f172a,#1f2937);color:#ffffff;padding:24px;">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.18em;color:#86efac;">Factura CeliaShop</div>
      <div style="font-size:26px;font-weight:900;margin-top:8px;">Pedido #${escapeHtml(order.numero || 'SIN-ID')}</div>
      <div style="font-size:13px;line-height:1.6;margin-top:10px;opacity:.9;">CeliaShop<br/>Email: ${escapeHtml(shopEmail)}<br/>Fecha: ${escapeHtml(formatDate(order.fecha))}<br/>Estado: ${escapeHtml(order.estado || 'Pendiente')}</div>
    </div>
    <div style="padding:24px;">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;color:#6b7280;margin-bottom:12px;">Datos del cliente</div>
      <div style="font-size:14px;line-height:1.7;color:#111827;margin-bottom:18px;">
        <strong>${escapeHtml(getCustomerName(customer))}</strong><br/>
        Email: ${escapeHtml(customer.email || 'No informado')}<br/>
        Teléfono: ${escapeHtml(customer.telefono || 'No informado')}<br/>
        CUIT: ${escapeHtml(customer.cuit || 'No informado')}<br/>
        Dirección: ${escapeHtml(customer.direccion || order.direccion || 'No informada')}
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="background:#f9fafb;padding:10px;border:1px solid #e5e7eb;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Producto</th>
            <th style="background:#f9fafb;padding:10px;border:1px solid #e5e7eb;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Cantidad</th>
            <th style="background:#f9fafb;padding:10px;border:1px solid #e5e7eb;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Unitario</th>
            <th style="background:#f9fafb;padding:10px;border:1px solid #e5e7eb;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:18px;padding:16px;border-radius:14px;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <span style="font-size:12px;font-weight:800;text-transform:uppercase;color:#475569;">Total factura</span>
        <span style="font-size:24px;font-weight:900;color:#059669;">${escapeHtml(formatCurrency(order.total || 0))}</span>
      </div>
    </div>
  </div>`;
};

const renderEmailLayout = ({ title, intro, invoiceHtml, extraBlock = '' }: { title: string; intro: string; invoiceHtml: string; extraBlock?: string }) => `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:760px;margin:0 auto;padding:28px 16px;">
      <div style="background:#ffffff;border-radius:24px;padding:28px;box-shadow:0 20px 45px rgba(15,23,42,.08);">
        <div style="font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.2em;color:#16a34a;">Notificación automática</div>
        <h1 style="margin:10px 0 0 0;font-size:30px;line-height:1.1;">${escapeHtml(title)}</h1>
        <p style="margin:14px 0 24px 0;font-size:15px;line-height:1.7;color:#4b5563;">${escapeHtml(intro)}</p>
        ${extraBlock}
        ${invoiceHtml}
      </div>
    </div>
  </body>
</html>`;

const sendEmail = async ({ apiKey, from, to, subject, html }: { apiKey: string; from: string; to: string; subject: string; html: string }) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend respondió ${response.status}: ${errorText}`);
  }

  return await response.json();
};

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
    throw new Error('Sesión inválida para enviar emails.');
  }

  return await response.json();
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const authorization = req.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Debes estar autenticado para enviar emails.' }, 401);
    }

    const payload = await req.json() as Payload;
    const eventType = payload?.eventType;
    const customer = payload?.customer || {};
    const order = payload?.order || {};
    const shopEmail = String(payload?.shop?.email || Deno.env.get('ORDER_NOTIFICATION_EMAIL') || DEFAULT_SHOP_EMAIL).trim();

    if (!eventType || !order?.numero) {
      return jsonResponse({ error: 'Payload incompleto para enviar email.' }, 400);
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return jsonResponse({ error: 'Falta configurar RESEND_API_KEY en Supabase Edge Functions.' }, 500);
    }

    const from = Deno.env.get('ORDER_EMAIL_FROM') || 'CeliaShop <onboarding@resend.dev>';
    const adminEmails = String(Deno.env.get('ORDER_ADMIN_EMAILS') || DEFAULT_ADMIN_EMAILS.join(','))
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    const user = await getAuthenticatedUser(authorization);
    const userEmail = String(user?.email || '').toLowerCase();
    const isAdmin = adminEmails.includes(userEmail);
    const ownerId = String(customer?.id || order?.user_id || '');

    if (eventType === 'estado_actualizado' && !isAdmin) {
      return jsonResponse({ error: 'Solo un administrador puede notificar cambios de estado.' }, 403);
    }

    if (eventType === 'pedido_creado' && !isAdmin && ownerId && String(user?.id || '') !== ownerId) {
      return jsonResponse({ error: 'No puedes enviar emails para pedidos de otro usuario.' }, 403);
    }

    const invoiceHtml = renderInvoice(order, customer, shopEmail);
    const sent: Array<{ to: string; subject: string }> = [];

    if (eventType === 'pedido_creado') {
      const introCliente = `Tu pedido fue registrado correctamente. Te enviamos el detalle completo y la factura para confirmar que la compra ingresó con éxito.`;
      const introTienda = `Se registró un nuevo pedido en CeliaShop y esta copia incluye el detalle completo de la factura para seguimiento interno.`;

      if (customer?.email) {
        await sendEmail({
          apiKey: resendApiKey,
          from,
          to: customer.email,
          subject: `CeliaShop: pedido #${order.numero} confirmado`,
          html: renderEmailLayout({
            title: `Pedido #${order.numero} confirmado`,
            intro: introCliente,
            invoiceHtml,
          }),
        });
        sent.push({ to: customer.email, subject: `CeliaShop: pedido #${order.numero} confirmado` });
      }

      await sendEmail({
        apiKey: resendApiKey,
        from,
        to: shopEmail,
        subject: `Nuevo pedido recibido #${order.numero}`,
        html: renderEmailLayout({
          title: `Nuevo pedido #${order.numero}`,
          intro: introTienda,
          extraBlock: `<div style="margin-bottom:20px;padding:16px;border-radius:16px;background:#eff6ff;color:#1e3a8a;font-size:14px;line-height:1.7;"><strong>Cliente:</strong> ${escapeHtml(getCustomerName(customer))}<br/><strong>Email:</strong> ${escapeHtml(customer.email || 'No informado')}<br/><strong>Teléfono:</strong> ${escapeHtml(customer.telefono || 'No informado')}</div>`,
          invoiceHtml,
        }),
      });
      sent.push({ to: shopEmail, subject: `Nuevo pedido recibido #${order.numero}` });
    }

    if (eventType === 'estado_actualizado') {
      if (!customer?.email) {
        return jsonResponse({ error: 'El pedido no tiene email del cliente para notificar el cambio de estado.' }, 400);
      }

      const previous = order.estadoAnterior ? ` antes estaba en ${order.estadoAnterior}` : '';
      await sendEmail({
        apiKey: resendApiKey,
        from,
        to: customer.email,
        subject: `CeliaShop: tu pedido #${order.numero} ahora está ${String(order.estado || '').toLowerCase()}`,
        html: renderEmailLayout({
          title: `Actualización de tu pedido #${order.numero}`,
          intro: `El estado de tu pedido cambió a ${order.estado || 'Pendiente'}${previous}. Te dejamos nuevamente el detalle para que puedas seguirlo en todo momento.`,
          extraBlock: `<div style="margin-bottom:20px;padding:16px;border-radius:16px;background:#ecfdf5;color:#065f46;font-size:14px;line-height:1.7;"><strong>Estado actual:</strong> ${escapeHtml(order.estado || 'Pendiente')}</div>`,
          invoiceHtml,
        }),
      });
      sent.push({ to: customer.email, subject: `CeliaShop: tu pedido #${order.numero} ahora está ${String(order.estado || '').toLowerCase()}` });
    }

    return jsonResponse({ ok: true, sent });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'No se pudo enviar el email.' }, 500);
  }
});
