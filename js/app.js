// ============================================================
// CONFIGURACION EMAILJS
// ============================================================
const EMAILJS_PUBLIC_KEY  = "KNclEhX7V3w253uog";
const EMAILJS_SERVICE_ID  = "service_byq6h0h";
const EMAILJS_TEMPLATE_ID = "template_czkhg08";
const OWNER_EMAIL         = "giannattasio.nicolass@gmail.com";

// ============================================================
// DATOS BANCARIOS DE LA EMPRESA
// Completar con los datos reales cuando los tengas
// ============================================================
const BANK_DATA = {
  owner: "APELLIDO NOMBRE AQUI",
  cbu:   "0000000000000000000000",
  alias: "ALIAS.AQUI",
  bank:  "NOMBRE DEL BANCO",
  cuit:  "00-00000000-0",
};

// ============================================================
// ESTADO GLOBAL
// ============================================================
let currentUser = JSON.parse(localStorage.getItem("celiac_user") || "null");
let cart        = JSON.parse(localStorage.getItem("celiac_cart") || "[]");

emailjs.init(EMAILJS_PUBLIC_KEY);

// ============================================================
// NAVEGACION
// ============================================================
// (definida junto al panel admin al final del archivo)

function updateHomeButton() {
  const btn = document.getElementById("home-register-btn");
  if (!btn) return;
  if (currentUser) {
    btn.textContent = "Ver Productos";
    btn.onclick = () => showPage("products");
  } else {
    btn.textContent = "Crear cuenta";
    btn.onclick = () => showPage("register");
  }
}

// ============================================================
// AUTH
// ============================================================
function updateNavAuth() {
  const navAuth        = document.getElementById("nav-auth");
  const navUser        = document.getElementById("nav-user");
  const navUsernameText = document.getElementById("nav-username-text");
  if (currentUser) {
    navAuth.classList.add("hidden");
    navUser.classList.remove("hidden");
    navUser.classList.add("flex");
    navUsernameText.textContent = currentUser.firstname || currentUser.name || "Mi Cuenta";
  } else {
    navAuth.classList.remove("hidden");
    navUser.classList.add("hidden");
  }
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 5000);
}

function register() {
  const firstname = document.getElementById("reg-firstname").value.trim();
  const lastname  = document.getElementById("reg-lastname").value.trim();
  const email     = document.getElementById("reg-email").value.trim().toLowerCase();
  const phone     = document.getElementById("reg-phone").value.trim();
  const pass      = document.getElementById("reg-password").value;
  const pass2     = document.getElementById("reg-password2").value;

  if (!firstname || !lastname || !email || !pass) return showError("register-error", "Completá los campos obligatorios.");
  if (pass.length < 6) return showError("register-error", "La contraseña debe tener al menos 6 caracteres.");
  if (pass !== pass2)  return showError("register-error", "Las contraseñas no coinciden.");

  const users = JSON.parse(localStorage.getItem("celiac_users") || "[]");
  if (users.find(u => u.email === email)) return showError("register-error", "Ya existe una cuenta con ese email.");

  const user = { firstname, lastname, name: firstname + " " + lastname, email, phone, pass };
  users.push(user);
  localStorage.setItem("celiac_users", JSON.stringify(users));

  currentUser = { firstname, lastname, name: firstname + " " + lastname, email, phone };
  localStorage.setItem("celiac_user", JSON.stringify(currentUser));
  updateNavAuth();
  showPage("products");
}

function login() {
  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const pass  = document.getElementById("login-password").value;

  const users = JSON.parse(localStorage.getItem("celiac_users") || "[]");
  const user  = users.find(u => u.email === email && u.pass === pass);
  if (!user) return showError("login-error", "Email o contraseña incorrectos.");

  currentUser = {
    firstname: user.firstname || user.name,
    lastname:  user.lastname  || "",
    name:      user.name || (user.firstname + " " + (user.lastname || "")),
    email:     user.email,
    phone:     user.phone,
    business:  user.business,
    cuit:      user.cuit,
    iva:       user.iva,
    razon:     user.razon,
    delivery:  user.delivery,
    billing:   user.billing,
    sameAddress: user.sameAddress,
  };
  localStorage.setItem("celiac_user", JSON.stringify(currentUser));
  updateNavAuth();
  showPage("products");
}

function logout() {
  currentUser = null;
  localStorage.removeItem("celiac_user");
  updateNavAuth();
  showPage("home");
}

function updateUserData(fields) {
  const users = JSON.parse(localStorage.getItem("celiac_users") || "[]");
  const idx   = users.findIndex(u => u.email === currentUser.email);
  if (idx === -1) return;
  Object.assign(users[idx], fields);
  localStorage.setItem("celiac_users", JSON.stringify(users));
  Object.assign(currentUser, fields);
  localStorage.setItem("celiac_user", JSON.stringify(currentUser));
  updateNavAuth();
}

// ============================================================
// PEDIDOS (historial)
// ============================================================
function generateOrderId() {
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  const dateStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `ORD-${dateStr}-${rand}`;
}

function saveOrder(order) {
  const orders = JSON.parse(localStorage.getItem("celiac_orders") || "[]");
  orders.unshift(order);
  localStorage.setItem("celiac_orders", JSON.stringify(orders));
}

function getOrdersByUser(email) {
  const orders = JSON.parse(localStorage.getItem("celiac_orders") || "[]");
  return orders.filter(o => o.email === email);
}

function renderOrders() {
  const container = document.getElementById("orders-list");
  if (!currentUser) return;
  const orders = getOrdersByUser(currentUser.email);

  if (orders.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12">
        <div class="text-5xl mb-3">📦</div>
        <p class="text-gray-500">Todavía no realizaste ningún pedido.</p>
        <button onclick="showPage('products')" class="mt-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-2.5 rounded-lg transition text-sm">Ver Productos</button>
      </div>`;
    return;
  }

  container.innerHTML = orders.map(order => {
    const statusCfg = {
      pendiente_transferencia: { label: "Pendiente de pago",  cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
      pendiente_efectivo:      { label: "Pago en efectivo",   cls: "bg-blue-100 text-blue-800 border-blue-200"      },
      pagado:                  { label: "Pagado",             cls: "bg-green-100 text-green-800 border-green-200"   },
      procesando:              { label: "Procesando",         cls: "bg-blue-100 text-blue-800 border-blue-200"    },
      enviado:                 { label: "Enviado",            cls: "bg-purple-100 text-purple-800 border-purple-200" },
      entregado:               { label: "Entregado",          cls: "bg-gray-100 text-gray-700 border-gray-200"    },
    };
    const st  = statusCfg[order.paymentStatus] || statusCfg["pendiente_transferencia"];
    const dt  = new Date(order.date);
    const fecha = dt.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const hora  = dt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

    const itemsHtml = order.items.map(i =>
      `<div class="flex justify-between text-xs text-gray-600">
        <span>${i.emoji} ${i.name} x${i.qty}</span>
        <span class="font-medium">${formatPrice(i.price * i.qty)}</span>
      </div>`
    ).join("");

    return `
      <div class="border border-gray-200 rounded-xl p-4 mb-4 hover:shadow-sm transition">
        <div class="flex items-start justify-between mb-3">
          <div>
            <p class="font-bold text-brand-800 text-sm">${order.id}</p>
            <p class="text-xs text-gray-400">${fecha} a las ${hora}</p>
          </div>
          <span class="text-xs font-semibold border px-2 py-1 rounded-full ${st.cls}">${st.label}</span>
        </div>
        <div class="space-y-1 mb-3">${itemsHtml}</div>
        <div class="border-t pt-2 flex justify-between items-center">
          <span class="text-xs text-gray-500">Pago: ${order.paymentMethod === "transfer" ? "Transferencia bancaria" : "Efectivo"}</span>
          <span class="font-bold text-brand-700 text-sm">${formatPrice(order.total)}</span>
        </div>
      </div>`;
  }).join("");
}

// ============================================================
// PERFIL - TABS
// ============================================================
function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.remove("active-tab");
  });
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
  document.getElementById("tab-" + tab).classList.add("active-tab");
  document.getElementById("tab-content-" + tab).classList.remove("hidden");
  if (tab === "orders") renderOrders();
}

function renderProfile() {
  const u = currentUser;
  const initials = ((u.firstname || u.name || "?")[0] + (u.lastname || "")[0]).toUpperCase();
  document.getElementById("profile-avatar").textContent   = initials || "?";
  document.getElementById("profile-title").textContent    = u.name || u.firstname;
  document.getElementById("profile-subtitle").textContent = u.business || u.email;

  document.getElementById("pf-firstname").value = u.firstname || "";
  document.getElementById("pf-lastname").value  = u.lastname  || "";
  document.getElementById("pf-business").value  = u.business  || "";
  document.getElementById("pf-email").value     = u.email     || "";
  document.getElementById("pf-phone").value     = u.phone     || "";

  document.getElementById("pf-cuit").value  = u.cuit  || "";
  document.getElementById("pf-iva").value   = u.iva   || "";
  document.getElementById("pf-razon").value = u.razon || "";

  const d = u.delivery || {};
  document.getElementById("pf-del-street").value   = d.street   || "";
  document.getElementById("pf-del-number").value   = d.number   || "";
  document.getElementById("pf-del-floor").value    = d.floor    || "";
  document.getElementById("pf-del-apt").value      = d.apt      || "";
  document.getElementById("pf-del-city").value     = d.city     || "";
  document.getElementById("pf-del-zip").value      = d.zip      || "";
  document.getElementById("pf-del-province").value = d.province || "";
  document.getElementById("pf-del-notes").value    = d.notes    || "";

  const b = u.billing || {};
  document.getElementById("pf-same-as-delivery").checked = !!u.sameAddress;
  toggleBillingForm();
  document.getElementById("pf-bil-street").value   = b.street   || "";
  document.getElementById("pf-bil-number").value   = b.number   || "";
  document.getElementById("pf-bil-floor").value    = b.floor    || "";
  document.getElementById("pf-bil-apt").value      = b.apt      || "";
  document.getElementById("pf-bil-city").value     = b.city     || "";
  document.getElementById("pf-bil-zip").value      = b.zip      || "";
  document.getElementById("pf-bil-province").value = b.province || "";

  document.getElementById("pf-pass-current").value = "";
  document.getElementById("pf-pass-new").value     = "";
  document.getElementById("pf-pass-new2").value    = "";

  switchTab("personal");
}

function showProfileMsg(id, msg, isError) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = "rounded-lg p-3 mb-4 text-sm " + (isError
    ? "bg-red-50 border border-red-200 text-red-700"
    : "bg-green-50 border border-green-200 text-green-700");
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 4000);
}

function savePersonal() {
  const firstname = document.getElementById("pf-firstname").value.trim();
  const lastname  = document.getElementById("pf-lastname").value.trim();
  const business  = document.getElementById("pf-business").value.trim();
  const phone     = document.getElementById("pf-phone").value.trim();
  if (!firstname || !lastname) return showProfileMsg("profile-personal-msg", "Nombre y apellido son obligatorios.", true);
  updateUserData({ firstname, lastname, name: firstname + " " + lastname, business, phone });
  document.getElementById("profile-title").textContent    = firstname + " " + lastname;
  document.getElementById("profile-subtitle").textContent = business || currentUser.email;
  document.getElementById("profile-avatar").textContent   = (firstname[0] + lastname[0]).toUpperCase();
  showProfileMsg("profile-personal-msg", "Datos guardados correctamente.", false);
}

function saveFiscal() {
  const cuit  = document.getElementById("pf-cuit").value.trim();
  const iva   = document.getElementById("pf-iva").value;
  const razon = document.getElementById("pf-razon").value.trim();
  updateUserData({ cuit, iva, razon });
  showProfileMsg("profile-fiscal-msg", "Datos fiscales guardados.", false);
}

function saveDelivery() {
  const delivery = {
    street:   document.getElementById("pf-del-street").value.trim(),
    number:   document.getElementById("pf-del-number").value.trim(),
    floor:    document.getElementById("pf-del-floor").value.trim(),
    apt:      document.getElementById("pf-del-apt").value.trim(),
    city:     document.getElementById("pf-del-city").value.trim(),
    zip:      document.getElementById("pf-del-zip").value.trim(),
    province: document.getElementById("pf-del-province").value,
    notes:    document.getElementById("pf-del-notes").value.trim(),
  };
  if (!delivery.street || !delivery.city) return showProfileMsg("profile-delivery-msg", "Calle y ciudad son obligatorias.", true);
  updateUserData({ delivery });
  showProfileMsg("profile-delivery-msg", "Dirección de entrega guardada.", false);
}

function toggleBillingForm() {
  const same = document.getElementById("pf-same-as-delivery").checked;
  const form = document.getElementById("billing-form");
  form.style.opacity       = same ? "0.4" : "1";
  form.style.pointerEvents = same ? "none" : "auto";
}

function saveBilling() {
  const sameAddress = document.getElementById("pf-same-as-delivery").checked;
  const billing = sameAddress ? (currentUser.delivery || {}) : {
    street:   document.getElementById("pf-bil-street").value.trim(),
    number:   document.getElementById("pf-bil-number").value.trim(),
    floor:    document.getElementById("pf-bil-floor").value.trim(),
    apt:      document.getElementById("pf-bil-apt").value.trim(),
    city:     document.getElementById("pf-bil-city").value.trim(),
    zip:      document.getElementById("pf-bil-zip").value.trim(),
    province: document.getElementById("pf-bil-province").value,
  };
  if (!sameAddress && !billing.street) return showProfileMsg("profile-billing-msg", "Ingresá la dirección o usá la misma que la de entrega.", true);
  updateUserData({ billing, sameAddress });
  showProfileMsg("profile-billing-msg", "Dirección de facturación guardada.", false);
}

function savePassword() {
  const current  = document.getElementById("pf-pass-current").value;
  const newPass  = document.getElementById("pf-pass-new").value;
  const newPass2 = document.getElementById("pf-pass-new2").value;

  const users = JSON.parse(localStorage.getItem("celiac_users") || "[]");
  const user  = users.find(u => u.email === currentUser.email);
  if (!user || user.pass !== current) return showProfileMsg("profile-password-msg", "La contraseña actual es incorrecta.", true);
  if (newPass.length < 6)  return showProfileMsg("profile-password-msg", "La nueva contraseña debe tener al menos 6 caracteres.", true);
  if (newPass !== newPass2) return showProfileMsg("profile-password-msg", "Las contraseñas no coinciden.", true);
  user.pass = newPass;
  localStorage.setItem("celiac_users", JSON.stringify(users));
  document.getElementById("pf-pass-current").value = "";
  document.getElementById("pf-pass-new").value     = "";
  document.getElementById("pf-pass-new2").value    = "";
  showProfileMsg("profile-password-msg", "Contraseña cambiada correctamente.", false);
}

// ============================================================
// PRODUCTOS
// ============================================================
let filteredProducts = [...PRODUCTS];

function filterProducts() {
  const cat = document.getElementById("category-filter").value;
  filteredProducts = cat === "all" ? [...PRODUCTS] : PRODUCTS.filter(p => p.category === cat);
  renderProducts();
}

function formatPrice(n) {
  return "$" + n.toLocaleString("es-AR");
}

function renderProducts() {
  const grid = document.getElementById("products-grid");
  grid.innerHTML = "";
  filteredProducts.forEach(product => {
    const inCart = cart.find(i => i.id === product.id);
    const qty    = inCart ? inCart.qty : 0;
    const card   = document.createElement("div");
    card.className = "bg-white rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden flex flex-col";
    card.innerHTML = `
      <div class="bg-amber-50 flex items-center justify-center py-8 text-6xl">${product.emoji}</div>
      <div class="p-4 flex flex-col flex-1">
        <span class="text-xs text-brand-600 font-semibold uppercase tracking-wide mb-1">${categoryLabel(product.category)}</span>
        <h3 class="font-bold text-gray-800 mb-1 leading-tight">${product.name}</h3>
        <p class="text-gray-500 text-xs mb-2 flex-1">${product.description}</p>
        <p class="text-xs text-gray-400 mb-3">${product.unit}</p>
        <div class="flex items-center justify-between mt-auto">
          <span class="text-lg font-bold text-brand-700">${formatPrice(product.price)}</span>
          ${qty === 0
            ? `<button onclick="addToCart(${product.id})" class="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-full transition">Agregar</button>`
            : `<div class="flex items-center gap-2">
                <button onclick="changeQty(${product.id}, -1)" class="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-gray-700 flex items-center justify-center transition">−</button>
                <span class="font-bold text-brand-700 w-5 text-center">${qty}</span>
                <button onclick="changeQty(${product.id}, 1)" class="w-7 h-7 rounded-full bg-brand-600 hover:bg-brand-700 text-white font-bold flex items-center justify-center transition">+</button>
               </div>`
          }
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

function categoryLabel(cat) {
  const labels = { panaderia: "Panadería", pastas: "Pastas", galletitas: "Galletitas y Snacks", reposteria: "Repostería", harinas: "Harinas y Premezclas" };
  return labels[cat] || cat;
}

// ============================================================
// CARRITO
// ============================================================
function saveCart() {
  localStorage.setItem("celiac_cart", JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById("cart-badge");
  const total = cart.reduce((s, i) => s + i.qty, 0);
  if (total > 0) {
    badge.textContent = total;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

function addToCart(productId) {
  const product  = PRODUCTS.find(p => p.id === productId);
  if (!product) return;
  const existing = cart.find(i => i.id === productId);
  if (existing) { existing.qty++; }
  else { cart.push({ id: product.id, name: product.name, price: product.price, emoji: product.emoji, qty: 1 }); }
  saveCart();
  renderProducts();
}

function changeQty(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== productId);
  saveCart();
  renderProducts();
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.id !== productId);
  saveCart();
  renderCart();
  renderProducts();
}

function renderCart() {
  const empty   = document.getElementById("cart-empty");
  const content = document.getElementById("cart-content");
  const pmSection = document.getElementById("payment-method-section");

  if (cart.length === 0) {
    empty.classList.remove("hidden");
    content.classList.add("hidden");
    return;
  }
  empty.classList.add("hidden");
  content.classList.remove("hidden");

  const itemsDiv   = document.getElementById("cart-items");
  const summaryDiv = document.getElementById("cart-summary-items");
  const totalEl    = document.getElementById("cart-total");
  const warnEl     = document.getElementById("checkout-login-warn");
  const btnCO      = document.getElementById("btn-checkout");

  if (!currentUser) {
    warnEl.classList.remove("hidden");
    pmSection.classList.add("hidden");
    btnCO.disabled = true;
    btnCO.classList.add("opacity-50", "cursor-not-allowed");
  } else {
    warnEl.classList.add("hidden");
    pmSection.classList.remove("hidden");
    btnCO.disabled = false;
    btnCO.classList.remove("opacity-50", "cursor-not-allowed");
  }

  let total = 0;
  itemsDiv.innerHTML   = "";
  summaryDiv.innerHTML = "";

  cart.forEach(item => {
    const subtotal = item.price * item.qty;
    total += subtotal;

    const row = document.createElement("div");
    row.className = "bg-white rounded-xl shadow-sm p-4 flex items-center gap-4";
    row.innerHTML = `
      <div class="text-4xl">${item.emoji}</div>
      <div class="flex-1">
        <p class="font-semibold text-gray-800">${item.name}</p>
        <p class="text-sm text-gray-500">${formatPrice(item.price)} c/u</p>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="cartChangeQty(${item.id}, -1)" class="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 font-bold flex items-center justify-center transition">−</button>
        <span class="font-bold w-5 text-center">${item.qty}</span>
        <button onclick="cartChangeQty(${item.id}, 1)" class="w-7 h-7 rounded-full bg-brand-600 hover:bg-brand-700 text-white font-bold flex items-center justify-center transition">+</button>
      </div>
      <div class="text-right min-w-[70px]">
        <p class="font-bold text-brand-700">${formatPrice(subtotal)}</p>
      </div>
      <button onclick="removeFromCart(${item.id})" class="text-gray-400 hover:text-red-500 transition ml-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>`;
    itemsDiv.appendChild(row);

    const sumRow = document.createElement("div");
    sumRow.className = "flex justify-between";
    sumRow.innerHTML = `<span>${item.name} x${item.qty}</span><span class="font-medium">${formatPrice(subtotal)}</span>`;
    summaryDiv.appendChild(sumRow);
  });

  totalEl.textContent = formatPrice(total);
}

function cartChangeQty(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== productId);
  saveCart();
  renderCart();
}

// ============================================================
// COMPROBANTE DE PAGO
// ============================================================
let receiptBase64 = null;

function onReceiptSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert("El archivo es demasiado grande. Máximo 5 MB.");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    if (file.type.startsWith("image/")) {
      compressImage(dataUrl, file.name);
    } else {
      receiptBase64 = dataUrl;
      showReceiptPreview(null, file.name);
    }
  };
  reader.readAsDataURL(file);
}

function compressImage(dataUrl, filename) {
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement("canvas");
    const MAX_W   = 900;
    const scale   = img.width > MAX_W ? MAX_W / img.width : 1;
    canvas.width  = Math.round(img.width  * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    receiptBase64 = canvas.toDataURL("image/jpeg", 0.75);
    showReceiptPreview(receiptBase64, filename);
  };
  img.src = dataUrl;
}

function showReceiptPreview(imgSrc, filename) {
  document.getElementById("receipt-preview").classList.remove("hidden");
  document.getElementById("receipt-dropzone").classList.add("hidden");
  document.getElementById("receipt-filename").textContent = "✓ " + filename;
  const imgEl = document.getElementById("receipt-img");
  if (imgSrc) {
    imgEl.src = imgSrc;
    imgEl.classList.remove("hidden");
  } else {
    imgEl.classList.add("hidden");
  }
}

function clearReceipt() {
  receiptBase64 = null;
  document.getElementById("receipt-file").value  = "";
  document.getElementById("receipt-preview").classList.add("hidden");
  document.getElementById("receipt-dropzone").classList.remove("hidden");
  document.getElementById("receipt-img").src = "";
}

// ============================================================
// METODO DE PAGO - resaltar opcion seleccionada
// ============================================================
function onPaymentChange() {
  const isTransfer = document.getElementById("pay-transfer").checked;
  const labelT  = document.getElementById("label-pay-transfer");
  const labelC  = document.getElementById("label-pay-cash");
  const section = document.getElementById("receipt-upload-section");
  if (isTransfer) {
    labelT.classList.add("border-brand-500", "bg-amber-50");
    labelC.classList.remove("border-brand-500", "bg-amber-50");
    section.classList.remove("hidden");
  } else {
    labelC.classList.add("border-brand-500", "bg-amber-50");
    labelT.classList.remove("border-brand-500", "bg-amber-50");
    section.classList.add("hidden");
    clearReceipt();
  }
}

// ============================================================
// CHECKOUT
// ============================================================
function checkout() {
  if (!currentUser) { showPage("login"); return; }
  if (cart.length === 0) return;

  const btn = document.getElementById("btn-checkout");
  btn.textContent = "Enviando...";
  btn.disabled    = true;

  const total         = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const itemsList     = cart.map(i => `• ${i.name} x${i.qty} = ${formatPrice(i.price * i.qty)}`).join("\n");
  const orderDate     = new Date().toISOString();
  const orderId       = generateOrderId();
  const payTransfer   = document.getElementById("pay-transfer");
  const paymentMethod = (payTransfer && payTransfer.checked) ? "transfer" : "cash";

  const u   = currentUser;
  const del = u.delivery || {};
  const deliveryStr = del.street
    ? `${del.street} ${del.number}${del.floor ? ", Piso " + del.floor : ""}${del.apt ? " Depto " + del.apt : ""}, ${del.city}, ${del.province} (CP: ${del.zip})`
    : "No indicada";

  const order = {
    id:            orderId,
    email:         u.email,
    customerName:  u.name,
    date:          orderDate,
    items:         cart.map(i => ({ ...i })),
    total,
    paymentMethod,
    paymentStatus: paymentMethod === "transfer" ? "pendiente_transferencia" : "pendiente_efectivo",
    deliveryAddress: deliveryStr,
  };

  const templateParams = {
    to_email:          "giannattasio.nicolass@gmail.com",
    name:              "Sin Gluten & Feliz",
    email:             u.email,
    order_id:          orderId,
    customer_name:     u.name,
    customer_email:    u.email,
    customer_phone:    u.phone    || "No indicado",
    customer_cuit:     u.cuit     || "No indicado",
    customer_iva:      u.iva      || "No indicado",
    customer_razon:    u.razon    || "No indicada",
    customer_business: u.business || "No indicado",
    delivery_address:  deliveryStr,
    payment_method:    paymentMethod === "transfer" ? "Transferencia bancaria" : "Efectivo",
    order_items:       itemsList,
    order_total:       formatPrice(total),
    order_date:        new Date(orderDate).toLocaleString("es-AR"),
    receipt_image:     receiptBase64
      ? `<img src="${receiptBase64}" style="max-width:580px;width:100%;" alt="Comprobante"/>`
      : "No se adjunto comprobante.",
  };

  emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
    .then(() => {
      saveOrder(order);
      cart = [];
      saveCart();
      clearReceipt();
      renderSuccessPage(order);
      showPage("success");
    })
    .catch(err => {
      console.error("EmailJS error:", JSON.stringify(err));
      const msg = err && err.text ? err.text : (err && err.status ? "Error " + err.status : JSON.stringify(err));
      alert("Error al enviar el pedido:\n" + msg + "\n\nEl pedido fue guardado localmente. Contactanos para confirmarlo.");
      saveOrder(order);
      cart = [];
      saveCart();
      clearReceipt();
      renderSuccessPage(order);
      showPage("success");
      btn.textContent = "Finalizar Compra";
      btn.disabled    = false;
    });
}

function renderSuccessPage(order) {
  document.getElementById("success-order-id").textContent = "Pedido N° " + order.id;

  const transferBlock = document.getElementById("transfer-block");
  const cashBlock     = document.getElementById("cash-block");

  if (order.paymentMethod === "transfer") {
    document.getElementById("bank-owner").textContent = BANK_DATA.owner;
    document.getElementById("bank-cbu").textContent   = BANK_DATA.cbu;
    document.getElementById("bank-alias").textContent = BANK_DATA.alias;
    document.getElementById("bank-name").textContent  = BANK_DATA.bank;
    document.getElementById("bank-cuit").textContent  = BANK_DATA.cuit;
    document.getElementById("transfer-total").textContent = formatPrice(order.total);
    transferBlock.classList.remove("hidden");
    cashBlock.classList.add("hidden");
  } else {
    document.getElementById("cash-total").textContent = formatPrice(order.total);
    cashBlock.classList.remove("hidden");
    transferBlock.classList.add("hidden");
  }

  const itemsDiv = document.getElementById("success-items");
  itemsDiv.innerHTML = order.items.map(i => `
    <div class="flex justify-between">
      <span>${i.emoji} ${i.name} x${i.qty}</span>
      <span class="font-medium">${formatPrice(i.price * i.qty)}</span>
    </div>`).join("");
  document.getElementById("success-total").textContent = formatPrice(order.total);
}

// ============================================================
// ADMIN PANEL
// ============================================================
const ADMIN_PASSWORD = "admin1234";  // ← cambiá esta contraseña
let adminAuthenticated = false;

function showPage(page) {
  const pages = ["home", "register", "login", "products", "cart", "profile", "success", "admin"];
  pages.forEach(p => {
    const el = document.getElementById("page-" + p);
    if (el) el.classList.add("hidden");
  });
  const target = document.getElementById("page-" + page);
  if (target) target.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (page === "products") renderProducts();
  if (page === "cart")     renderCart();
  if (page === "home")     updateHomeButton();
  if (page === "profile") {
    if (!currentUser) { showPage("login"); return; }
    renderProfile();
  }
  if (page === "admin") renderAdminPage();
}

function renderAdminPage() {
  if (adminAuthenticated) {
    document.getElementById("admin-login").classList.add("hidden");
    document.getElementById("admin-panel").classList.remove("hidden");
    adminRenderStats();
    adminRenderClients();
  } else {
    document.getElementById("admin-login").classList.remove("hidden");
    document.getElementById("admin-panel").classList.add("hidden");
    setTimeout(() => document.getElementById("admin-pass-input").focus(), 100);
  }
}

function adminLogin() {
  const val = document.getElementById("admin-pass-input").value;
  if (val === ADMIN_PASSWORD) {
    adminAuthenticated = true;
    document.getElementById("admin-pass-input").value = "";
    renderAdminPage();
  } else {
    const err = document.getElementById("admin-login-error");
    err.textContent = "Contraseña incorrecta.";
    err.classList.remove("hidden");
    setTimeout(() => err.classList.add("hidden"), 3000);
  }
}

function adminLogout() {
  adminAuthenticated = false;
  renderAdminPage();
}

function adminSwitchTab(tab) {
  document.querySelectorAll(".admin-tab").forEach(b => b.classList.remove("active-tab"));
  document.getElementById("atab-" + tab).classList.add("active-tab");
  document.getElementById("admin-tab-clients").classList.toggle("hidden", tab !== "clients");
  document.getElementById("admin-tab-orders").classList.toggle("hidden",  tab !== "orders");
  if (tab === "orders") adminRenderOrders();
}

function adminRenderStats() {
  const users  = JSON.parse(localStorage.getItem("celiac_users")  || "[]");
  const orders = JSON.parse(localStorage.getItem("celiac_orders") || "[]");
  const totalVentas = orders.reduce((s, o) => s + o.total, 0);
  document.getElementById("admin-stats").textContent =
    `${users.length} cliente${users.length !== 1 ? "s" : ""} registrado${users.length !== 1 ? "s" : ""} · ${orders.length} pedido${orders.length !== 1 ? "s" : ""} · Total ventas: ${formatPrice(totalVentas)}`;
}

function adminRenderClients() {
  const q     = (document.getElementById("admin-search").value || "").toLowerCase();
  const users = JSON.parse(localStorage.getItem("celiac_users")  || "[]");
  const orders= JSON.parse(localStorage.getItem("celiac_orders") || "[]");
  const list  = document.getElementById("admin-clients-list");

  const filtered = users.filter(u =>
    (u.name    || "").toLowerCase().includes(q) ||
    (u.email   || "").toLowerCase().includes(q) ||
    (u.phone   || "").toLowerCase().includes(q) ||
    (u.business|| "").toLowerCase().includes(q)
  );

  if (filtered.length === 0) {
    list.innerHTML = `<div class="text-center py-10 text-gray-400">No se encontraron clientes.</div>`;
    return;
  }

  const ivaLabel = { consumidor_final: "Consumidor Final", responsable_inscripto: "Resp. Inscripto", monotributista: "Monotributista", exento: "Exento" };

  list.innerHTML = filtered.map((u, idx) => {
    const userOrders = orders.filter(o => o.email === u.email);
    const totalGastado = userOrders.reduce((s, o) => s + o.total, 0);
    const del = u.delivery || {};
    const delStr = del.street ? `${del.street} ${del.number}${del.floor ? " P" + del.floor : ""}${del.apt ? " D" + del.apt : ""}, ${del.city}, ${del.province} (CP ${del.zip})` : "—";

    return `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button onclick="adminToggleClient('ac-${idx}')" class="w-full flex items-center justify-between px-5 py-4 hover:bg-amber-50 transition text-left">
        <div class="flex items-center gap-3">
          <div class="bg-brand-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-sm flex-shrink-0">
            ${((u.firstname || u.name || "?")[0] + (u.lastname || "")[0] || "").toUpperCase() || "?"}
          </div>
          <div>
            <p class="font-bold text-gray-800">${u.name || u.firstname}</p>
            <p class="text-sm text-gray-500">${u.email}</p>
          </div>
        </div>
        <div class="flex items-center gap-4 text-right">
          <div class="hidden sm:block">
            <p class="text-xs text-gray-400">${userOrders.length} pedido${userOrders.length !== 1 ? "s" : ""}</p>
            <p class="text-sm font-bold text-brand-700">${formatPrice(totalGastado)}</p>
          </div>
          <svg class="w-4 h-4 text-gray-400 transition-transform" id="arrow-ac-${idx}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </div>
      </button>

      <div id="ac-${idx}" class="hidden border-t border-gray-100">
        <div class="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">

          <div class="space-y-1">
            <p class="text-xs font-bold text-brand-700 uppercase tracking-wide mb-2">Datos personales</p>
            <p><span class="text-gray-500">Nombre:</span> <span class="font-medium">${u.firstname || "—"} ${u.lastname || ""}</span></p>
            <p><span class="text-gray-500">Local/Empresa:</span> <span class="font-medium">${u.business || "—"}</span></p>
            <p><span class="text-gray-500">Email:</span> <span class="font-medium">${u.email}</span></p>
            <p><span class="text-gray-500">Teléfono:</span> <span class="font-medium">${u.phone || "—"}</span></p>
          </div>

          <div class="space-y-1">
            <p class="text-xs font-bold text-brand-700 uppercase tracking-wide mb-2">Datos fiscales</p>
            <p><span class="text-gray-500">CUIL/CUIT:</span> <span class="font-medium">${u.cuit || "—"}</span></p>
            <p><span class="text-gray-500">Cond. IVA:</span> <span class="font-medium">${ivaLabel[u.iva] || u.iva || "—"}</span></p>
            <p><span class="text-gray-500">Razón social:</span> <span class="font-medium">${u.razon || "—"}</span></p>
          </div>

          <div class="space-y-1">
            <p class="text-xs font-bold text-brand-700 uppercase tracking-wide mb-2">Dirección de entrega</p>
            <p class="font-medium">${delStr}</p>
            ${del.notes ? `<p class="text-gray-400 text-xs">${del.notes}</p>` : ""}
          </div>

        </div>

        ${userOrders.length > 0 ? `
        <div class="border-t border-gray-100 px-5 pb-4 pt-3">
          <p class="text-xs font-bold text-brand-700 uppercase tracking-wide mb-2">Pedidos (${userOrders.length})</p>
          <div class="space-y-2">
            ${userOrders.map(o => {
              const dt = new Date(o.date);
              const fecha = dt.toLocaleDateString("es-AR") + " " + dt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
              const payLabel = o.paymentMethod === "transfer" ? "Transferencia" : "Efectivo";
              const statusMap = { pendiente_transferencia: "Pend. pago", pendiente_efectivo: "Pend. efectivo", pagado: "Pagado", procesando: "Procesando", enviado: "Enviado", entregado: "Entregado" };
              return `<div class="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs">
                <span class="font-mono text-gray-600">${o.id}</span>
                <span class="text-gray-400">${fecha}</span>
                <span class="text-gray-600">${payLabel}</span>
                <span class="font-bold text-brand-700">${formatPrice(o.total)}</span>
              </div>`;
            }).join("")}
          </div>
          <p class="text-right text-sm font-bold text-brand-800 mt-2">Total gastado: ${formatPrice(totalGastado)}</p>
        </div>` : ""}
      </div>
    </div>`;
  }).join("");
}

function adminToggleClient(id) {
  const el    = document.getElementById(id);
  const idx   = id.split("-")[1];
  const arrow = document.getElementById("arrow-" + id);
  const open  = !el.classList.contains("hidden");
  el.classList.toggle("hidden", open);
  if (arrow) arrow.style.transform = open ? "" : "rotate(180deg)";
}

function adminRenderOrders() {
  const q      = (document.getElementById("admin-order-search").value || "").toLowerCase();
  const orders = JSON.parse(localStorage.getItem("celiac_orders") || "[]");
  const list   = document.getElementById("admin-orders-list");

  const filtered = orders.filter(o =>
    (o.id           || "").toLowerCase().includes(q) ||
    (o.customerName || "").toLowerCase().includes(q) ||
    (o.email        || "").toLowerCase().includes(q)
  );

  if (filtered.length === 0) {
    list.innerHTML = `<div class="text-center py-10 text-gray-400">No hay pedidos registrados.</div>`;
    return;
  }

  const statusCfg = {
    pendiente_transferencia: { label: "Pend. transferencia", cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    pendiente_efectivo:      { label: "Pend. efectivo",      cls: "bg-blue-100 text-blue-800 border-blue-200"     },
    pagado:      { label: "Pagado",      cls: "bg-green-100 text-green-800 border-green-200"   },
    procesando:  { label: "Procesando",  cls: "bg-sky-100 text-sky-800 border-sky-200"         },
    enviado:     { label: "Enviado",     cls: "bg-purple-100 text-purple-800 border-purple-200" },
    entregado:   { label: "Entregado",   cls: "bg-gray-100 text-gray-600 border-gray-200"      },
  };

  list.innerHTML = filtered.map(o => {
    const dt    = new Date(o.date);
    const fecha = dt.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const hora  = dt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    const st    = statusCfg[o.paymentStatus] || statusCfg["pendiente_transferencia"];
    const items = o.items.map(i => `<span class="inline-block bg-gray-100 rounded px-2 py-0.5 text-xs text-gray-600 mr-1 mb-1">${i.emoji} ${i.name} x${i.qty}</span>`).join("");
    return `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <p class="font-bold text-brand-800">${o.id}</p>
          <p class="text-sm text-gray-500">${fecha} a las ${hora}</p>
          <p class="text-sm font-medium text-gray-700 mt-0.5">${o.customerName} &bull; <span class="text-gray-400">${o.email}</span></p>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs font-semibold border px-2 py-1 rounded-full ${st.cls}">${st.label}</span>
          <span class="text-lg font-bold text-brand-700">${formatPrice(o.total)}</span>
        </div>
      </div>
      <div class="mb-2">${items}</div>
      <div class="flex items-center justify-between text-xs text-gray-400">
        <span>Pago: ${o.paymentMethod === "transfer" ? "Transferencia bancaria" : "Efectivo"}</span>
        <span>Entrega: ${o.deliveryAddress || "—"}</span>
      </div>
    </div>`;
  }).join("");
}

function adminExportCSV() {
  const users  = JSON.parse(localStorage.getItem("celiac_users")  || "[]");
  const orders = JSON.parse(localStorage.getItem("celiac_orders") || "[]");
  const ivaLabel = { consumidor_final: "Consumidor Final", responsable_inscripto: "Resp. Inscripto", monotributista: "Monotributista", exento: "Exento" };

  const rows = [["Nombre", "Apellido", "Email", "Teléfono", "Local/Empresa", "CUIT/CUIL", "Cond. IVA", "Razón Social", "Dir. Entrega", "Cant. Pedidos", "Total Gastado"]];
  users.forEach(u => {
    const userOrders   = orders.filter(o => o.email === u.email);
    const totalGastado = userOrders.reduce((s, o) => s + o.total, 0);
    const del = u.delivery || {};
    const delStr = del.street ? `${del.street} ${del.number}, ${del.city}, ${del.province}` : "";
    rows.push([
      u.firstname || u.name || "", u.lastname || "", u.email, u.phone || "",
      u.business || "", u.cuit || "", ivaLabel[u.iva] || u.iva || "", u.razon || "",
      delStr, userOrders.length, totalGastado
    ]);
  });

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "clientes_sin_gluten_feliz.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// INICIO
// ============================================================
updateNavAuth();
updateCartBadge();

// Acceso al admin via ?admin en la URL
if (window.location.search.includes("admin")) {
  showPage("admin");
} else {
  showPage("home");
}
