// ============================================================
// CONFIGURACION EMAILJS
// Reemplaza estos valores con los tuyos de emailjs.com
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

// ============================================================
// INICIALIZAR EMAILJS
// ============================================================
emailjs.init(EMAILJS_PUBLIC_KEY);

// ============================================================
// NAVEGACION
// ============================================================
function showPage(page) {
  const pages = ["home", "register", "login", "products", "cart", "success"];
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
  const navUsername = document.getElementById("nav-username");
  if (currentUser) {
    navAuth.classList.add("hidden");
    navUser.classList.remove("hidden");
    navUser.classList.add("flex");
    navUsername.textContent = "Hola, " + currentUser.name.split(" ")[0];
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
  const name  = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim().toLowerCase();
  const phone = document.getElementById("reg-phone").value.trim();
  const pass  = document.getElementById("reg-password").value;
  const pass2 = document.getElementById("reg-password2").value;

  if (!name || !email || !pass) return showError("register-error", "Completá todos los campos obligatorios.");
  if (pass.length < 6) return showError("register-error", "La contraseña debe tener al menos 6 caracteres.");
  if (pass !== pass2)  return showError("register-error", "Las contraseñas no coinciden.");

  const users = JSON.parse(localStorage.getItem("celiac_users") || "[]");
  if (users.find(u => u.email === email)) return showError("register-error", "Ya existe una cuenta con ese email.");

  const user = { name, email, phone, pass };
  users.push(user);
  localStorage.setItem("celiac_users", JSON.stringify(users));

  currentUser = { name, email, phone };
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

  currentUser = { name: user.name, email: user.email, phone: user.phone };
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
    const inCart  = cart.find(i => i.id === product.id);
    const qty     = inCart ? inCart.qty : 0;
    const card    = document.createElement("div");
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

  if (!currentUser) {
    warnEl.classList.remove("hidden");
    document.getElementById("btn-checkout").disabled = true;
    document.getElementById("btn-checkout").classList.add("opacity-50", "cursor-not-allowed");
  } else {
    warnEl.classList.add("hidden");
    document.getElementById("btn-checkout").disabled = false;
    document.getElementById("btn-checkout").classList.remove("opacity-50", "cursor-not-allowed");
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
// CHECKOUT - ENVIAR EMAIL
// ============================================================
function checkout() {
  if (!currentUser) { showPage("login"); return; }
  if (cart.length === 0) return;

  const btn = document.getElementById("btn-checkout");
  btn.textContent = "Enviando...";
  btn.disabled    = true;

  const total      = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const itemsList  = cart.map(i => `• ${i.name} x${i.qty} = ${formatPrice(i.price * i.qty)}`).join("\n");
  const orderDate  = new Date().toLocaleString("es-AR");

  const templateParams = {
    to_email:     OWNER_EMAIL,
    customer_name:  currentUser.name,
    customer_email: currentUser.email,
    customer_phone: currentUser.phone || "No indicado",
    order_items:    itemsList,
    order_total:    formatPrice(total),
    order_date:     orderDate,
  };

  emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
    .then(() => {
      cart = [];
      saveCart();
      showPage("success");
    })
    .catch(err => {
      console.error("EmailJS error:", err);
      alert("Hubo un error al enviar el pedido. Por favor intentá de nuevo o contactanos directamente.");
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
