
// ============================================================
// DATOS BANCARIOS
// ============================================================
const BANK_DATA = {
  owner: "APELLIDO NOMBRE AQUI",      // ← nombre del titular
  cbu:   "0000000000000000000000",    // ← CBU de 22 dígitos
  alias: "ALIAS.AQUI",                // ← alias de la cuenta
  bank:  "NOMBRE DEL BANCO",          // ← ej: Banco Galicia
  cuit:  "00-00000000-0",             // ← CUIT del titular
};
// ============================================================
// CONFIGURACION EMAILJS
// ============================================================
const EMAILJS_PUBLIC_KEY  = "TU_PUBLIC_KEY_AQUI";
const EMAILJS_SERVICE_ID  = "TU_SERVICE_ID_AQUI";
const EMAILJS_TEMPLATE_ID = "TU_TEMPLATE_ID_AQUI";
const OWNER_EMAIL         = "giannattasio.nicolass@gmail.com";

// ============================================================
// ESTADO GLOBAL
// ============================================================
let currentUser = JSON.parse(localStorage.getItem("celiac_user") || "null");
let cart        = JSON.parse(localStorage.getItem("celiac_cart") || "[]");

emailjs.init(EMAILJS_PUBLIC_KEY);

// ============================================================
// NAVEGACION
// ============================================================
function showPage(page) {
  const pages = ["home", "register", "login", "products", "cart", "profile", "success"];
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
}

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
  const navAuth = document.getElementById("nav-auth");
  const navUser = document.getElementById("nav-user");
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
    name:      user.name || (user.firstname + " " + user.lastname),
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

// Helper: actualizar datos del usuario en localStorage
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
// PERFIL - TABS
// ============================================================
function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.remove("bg-brand-600", "text-white");
    btn.classList.add("text-gray-600", "hover:bg-amber-50");
  });
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));

  document.getElementById("tab-" + tab).classList.add("bg-brand-600", "text-white");
  document.getElementById("tab-" + tab).classList.remove("text-gray-600", "hover:bg-amber-50");
  document.getElementById("tab-content-" + tab).classList.remove("hidden");
}

function renderProfile() {
  const u = currentUser;
  const initials = ((u.firstname || u.name || "?")[0] + (u.lastname || "")[0] || "").toUpperCase() || "?";
  document.getElementById("profile-avatar").textContent = initials || "?";
  document.getElementById("profile-title").textContent  = u.name || u.firstname;
  document.getElementById("profile-subtitle").textContent = u.business ? u.business : u.email;

  // Datos personales
  document.getElementById("pf-firstname").value = u.firstname || "";
  document.getElementById("pf-lastname").value  = u.lastname  || "";
  document.getElementById("pf-business").value  = u.business  || "";
  document.getElementById("pf-email").value     = u.email     || "";
  document.getElementById("pf-phone").value     = u.phone     || "";

  // Datos fiscales
  document.getElementById("pf-cuit").value  = u.cuit  || "";
  document.getElementById("pf-iva").value   = u.iva   || "";
  document.getElementById("pf-razon").value = u.razon || "";

  // Direccion entrega
  const d = u.delivery || {};
  document.getElementById("pf-del-street").value   = d.street   || "";
  document.getElementById("pf-del-number").value   = d.number   || "";
  document.getElementById("pf-del-floor").value    = d.floor    || "";
  document.getElementById("pf-del-apt").value      = d.apt      || "";
  document.getElementById("pf-del-city").value     = d.city     || "";
  document.getElementById("pf-del-zip").value      = d.zip      || "";
  document.getElementById("pf-del-province").value = d.province || "";
  document.getElementById("pf-del-notes").value    = d.notes    || "";

  // Direccion facturacion
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

  // Contrasena en blanco
  document.getElementById("pf-pass-current").value = "";
  document.getElementById("pf-pass-new").value     = "";
  document.getElementById("pf-pass-new2").value    = "";

  switchTab("personal");
}

function showProfileMsg(id, msg, isError) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = "rounded-lg p-3 mb-4 text-sm " + (isError ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700");
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
  document.getElementById("profile-title").textContent   = firstname + " " + lastname;
  document.getElementById("profile-subtitle").textContent = business || currentUser.email;
  document.getElementById("profile-avatar").textContent  = (firstname[0] + lastname[0]).toUpperCase();
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
  document.getElementById("billing-form").style.opacity  = same ? "0.4" : "1";
  document.getElementById("billing-form").style.pointerEvents = same ? "none" : "auto";
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
  const current = document.getElementById("pf-pass-current").value;
  const newPass = document.getElementById("pf-pass-new").value;
  const newPass2 = document.getElementById("pf-pass-new2").value;

  const users = JSON.parse(localStorage.getItem("celiac_users") || "[]");
  const user  = users.find(u => u.email === currentUser.email);
  if (!user || user.pass !== current) return showProfileMsg("profile-password-msg", "La contraseña actual es incorrecta.", true);
  if (newPass.length < 6) return showProfileMsg("profile-password-msg", "La nueva contraseña debe tener al menos 6 caracteres.", true);
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
  const product = PRODUCTS.find(p => p.id === productId);
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
    btnCO.disabled = true;
    btnCO.classList.add("opacity-50", "cursor-not-allowed");
  } else {
    warnEl.classList.add("hidden");
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
// CHECKOUT
// ============================================================
function checkout() {
  if (!currentUser) { showPage("login"); return; }
  if (cart.length === 0) return;

  const btn = document.getElementById("btn-checkout");
  btn.textContent = "Enviando...";
  btn.disabled    = true;

  const total     = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const itemsList = cart.map(i => `• ${i.name} x${i.qty} = ${formatPrice(i.price * i.qty)}`).join("\n");
  const orderDate = new Date().toLocaleString("es-AR");

  const u = currentUser;
  const del = u.delivery || {};
  const deliveryStr = del.street
    ? `${del.street} ${del.number}${del.floor ? ", Piso " + del.floor : ""}${del.apt ? " Depto " + del.apt : ""}, ${del.city}, ${del.province} (CP: ${del.zip})`
    : "No indicada";

  const templateParams = {
    to_email:         OWNER_EMAIL,
    customer_name:    u.name,
    customer_email:   u.email,
    customer_phone:   u.phone    || "No indicado",
    customer_cuit:    u.cuit     || "No indicado",
    customer_iva:     u.iva      || "No indicado",
    customer_razon:   u.razon    || "No indicada",
    customer_business: u.business || "No indicado",
    delivery_address: deliveryStr,
    order_items:      itemsList,
    order_total:      formatPrice(total),
    order_date:       orderDate,
  };

  emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
    .then(() => {
      cart = [];
      saveCart();
      showPage("success");
    })
    .catch(err => {
      console.error("EmailJS error:", err);
      alert("Hubo un error al enviar el pedido. Por favor intentá de nuevo.");
      btn.textContent = "Finalizar Compra";
      btn.disabled    = false;
    });
}

// ============================================================
// INICIO
// ============================================================
updateNavAuth();
updateCartBadge();
showPage("home");
