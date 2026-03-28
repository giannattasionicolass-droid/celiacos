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
  metodoPago?: string;
  emailConfirmacion?: string;
  comprobanteUrl?: string;
  comprobanteNombre?: string;
  productos?: Product[];
  user_id?: string | null;
};

type Payload = {
  eventType?: 'pedido_creado' | 'estado_actualizado' | 'contacto_mensaje';
  shop?: { email?: string };
  customer?: Customer;
  order?: Order;
  contact?: {
    nombre?: string;
    email?: string;
    telefono?: string;
    mensaje?: string;
    origen?: string;
  };
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
const getPaymentLabel = (order: Order = {}) => {
  const raw = String(order.metodoPago || '').toLowerCase();
  if (raw === 'transferencia') return 'Transferencia bancaria';
  if (raw === 'contra_entrega') return 'Contra entrega';
  return raw ? raw.replace(/_/g, ' ') : 'No informado';
};

const renderInvoice = (order: Order = {}, customer: Customer = {}, shopEmail = DEFAULT_SHOP_EMAIL) => {
  const rows = getProducts(order).length === 0
    ? '<tr><td colspan="5" style="padding:12px;border:1px solid #e5e7eb;font-size:12px;color:#6b7280;">Sin productos disponibles</td></tr>'
    : getProducts(order).map((item) => {
        const quantity = Number(item?.cantidad) || 1;
        const price = Number(item?.precio) || 0;
        const subtotal = quantity * price;
        const imageHtml = item?.imagen_url
          ? `<img src="${escapeHtml(item.imagen_url)}" alt="${escapeHtml(item?.nombre || '')}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;display:block;margin:0 auto;" />`
          : `<div style="width:60px;height:60px;border-radius:8px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:24px;margin:0 auto;">&#128230;</div>`;
        return `<tr>
          <td style="padding:10px;border:1px solid #e5e7eb;text-align:center;vertical-align:middle;">${imageHtml}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;font-size:12px;font-weight:700;vertical-align:middle;">${escapeHtml(item?.nombre || 'Producto sin nombre')}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;font-size:12px;text-align:center;vertical-align:middle;">${quantity}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;font-size:12px;text-align:right;vertical-align:middle;">${escapeHtml(formatCurrency(price))}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;font-size:12px;text-align:right;font-weight:800;vertical-align:middle;">${escapeHtml(formatCurrency(subtotal))}</td>
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
      <div style="margin-bottom:18px;padding:12px;border-radius:12px;background:#eff6ff;color:#1e3a8a;font-size:13px;line-height:1.7;">
        <strong>Método de pago:</strong> ${escapeHtml(getPaymentLabel(order))}<br/>
        <strong>Email confirmación:</strong> ${escapeHtml(order.emailConfirmacion || customer.email || 'No informado')}<br/>
        ${String(order.metodoPago || '').toLowerCase() === 'contra_entrega' ? '<strong>Recordatorio:</strong> tener el dinero listo al recibir el pedido.<br/>' : ''}
        ${String(order.metodoPago || '').toLowerCase() === 'transferencia' ? `<strong>Comprobante de transferencia:</strong><br/>${order.comprobanteUrl ? `<img src="${order.comprobanteUrl}" alt="Comprobante de pago" style="max-width:100%;height:auto;border-radius:8px;margin-top:8px;border:1px solid #0ea5e9;" />` : '<em>No adjuntado</em>'}` : ''}
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="background:#f9fafb;padding:10px;border:1px solid #e5e7eb;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Imagen</th>
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
    throw new Error('Faltan variables SUPABASE_URL o NON_KEY en la función.');
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
    const payload = await req.json() as Payload;
    const eventType = payload?.eventType;
    const customer = payload?.customer || {};
    const order = payload?.order || {};
    const contact = payload?.contact || {};
    const shopEmail = String(Deno.env.get('ORDER_NOTIFICATION_EMAIL') || DEFAULT_SHOP_EMAIL).trim();

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return jsonResponse({ error: 'Falta configurar RESEND_API_KEY en Supabase Edge Functions.' }, 500);
    }

    const from = Deno.env.get('ORDER_EMAIL_FROM') || 'CeliaShop <onboarding@resend.dev>';
    const adminEmails = String(Deno.env.get('ORDER_ADMIN_EMAILS') || DEFAULT_ADMIN_EMAILS.join(','))
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    const sent: Array<{ to: string; subject: string }> = [];

    if (!eventType) {
      return jsonResponse({ error: 'Falta eventType en el payload.' }, 400);
    }

    if (eventType === 'contacto_mensaje') {
      const nombre = String(contact?.nombre || customer?.nombre || '').trim();
      const email = String(contact?.email || customer?.email || '').trim();
      const telefono = String(contact?.telefono || customer?.telefono || '').trim();
      const mensaje = String(contact?.mensaje || '').trim();
      const origen = String(contact?.origen || 'contacto_web').trim();

      if (!nombre || !email || !mensaje) {
        return jsonResponse({ error: 'Nombre, email y mensaje son obligatorios.' }, 400);
      }

      const subject = `Nuevo mensaje de contacto - ${nombre}`;
      const html = renderEmailLayout({
        title: 'Nuevo mensaje desde Contactanos',
        intro: 'Se recibio una nueva consulta desde el formulario de contacto del sitio.',
        extraBlock: `<div style="margin-bottom:20px;padding:16px;border-radius:16px;background:#ecfdf5;color:#065f46;font-size:14px;line-height:1.7;"><strong>Nombre:</strong> ${escapeHtml(nombre)}<br/><strong>Email:</strong> ${escapeHtml(email)}<br/><strong>Telefono:</strong> ${escapeHtml(telefono || 'No informado')}<br/><strong>Origen:</strong> ${escapeHtml(origen)}<br/><strong>Usuario:</strong> ${escapeHtml(String(customer?.id || 'anonimo'))}</div><div style="border:1px solid #e5e7eb;border-radius:14px;background:#ffffff;padding:16px;font-size:14px;line-height:1.7;color:#111827;white-space:pre-wrap;">${escapeHtml(mensaje)}</div>`,
        invoiceHtml: '',
      });

      await sendEmail({
        apiKey: resendApiKey,
        from,
        to: shopEmail,
        subject,
        html,
      });
      sent.push({ to: shopEmail, subject });

      return jsonResponse({ ok: true, sent });
    }

    if (!order?.numero) {
      return jsonResponse({ error: 'Payload incompleto para enviar email de pedido.' }, 400);
    }

    const authorization = req.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Debes estar autenticado para enviar emails.' }, 401);
    }

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

    if (eventType === 'pedido_creado') {
      const introTienda = `Se registró un nuevo pedido en CeliaShop y esta copia incluye el detalle completo de la factura para seguimiento interno.`;
      const customerEmail = String(order.emailConfirmacion || customer.email || '').trim();

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

      if (customerEmail) {
        await sendEmail({
          apiKey: resendApiKey,
          from,
          to: customerEmail,
          subject: `Confirmación de tu pedido #${order.numero}`,
          html: renderEmailLayout({
            title: `Tu pedido #${order.numero} está confirmado`,
            intro: `Gracias por comprar en CeliaShop. Este es el detalle completo de tu pedido para control y seguimiento.`,
            extraBlock: `<div style="margin-bottom:20px;padding:16px;border-radius:16px;background:#ecfdf5;color:#065f46;font-size:14px;line-height:1.7;"><strong>Estado:</strong> ${escapeHtml(order.estado || 'Pendiente')}<br/><strong>Método de pago:</strong> ${escapeHtml(getPaymentLabel(order))}<br/><strong>Email confirmación:</strong> ${escapeHtml(customerEmail)}</div>`,
            invoiceHtml,
          }),
        });
        sent.push({ to: customerEmail, subject: `Confirmación de tu pedido #${order.numero}` });
      }
    }

    if (eventType === 'estado_actualizado') {
      const previous = order.estadoAnterior ? ` antes estaba en ${order.estadoAnterior}` : '';
      await sendEmail({
        apiKey: resendApiKey,
        from,
        to: shopEmail,
        subject: `Actualización de estado #${order.numero}: ${String(order.estado || '').toLowerCase()}`,
        html: renderEmailLayout({
          title: `Actualización de pedido #${order.numero}`,
          intro: `El pedido de ${getCustomerName(customer)} cambió a ${order.estado || 'Pendiente'}${previous}. Se envía copia para seguimiento interno.`,
          extraBlock: `<div style="margin-bottom:20px;padding:16px;border-radius:16px;background:#ecfdf5;color:#065f46;font-size:14px;line-height:1.7;"><strong>Estado actual:</strong> ${escapeHtml(order.estado || 'Pendiente')}<br/><strong>Cliente:</strong> ${escapeHtml(getCustomerName(customer))}<br/><strong>Email cliente:</strong> ${escapeHtml(customer.email || 'No informado')}</div>`,
          invoiceHtml,
        }),
      });
      sent.push({ to: shopEmail, subject: `Actualización de estado #${order.numero}: ${String(order.estado || '').toLowerCase()}` });
    }

    return jsonResponse({ ok: true, sent });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'No se pudo enviar el email.' }, 500);
  }
});
