/**
 * SHOP COMPANION — Shared Utilities & Data Layer
 * Handles: LocalStorage, Inventory, Customers, Orders, Toast, QR/Barcode libs
 */

/* ============================================================
   DATA STORE — LocalStorage wrapper
   ============================================================ */
const Store = {
  get(key) {
    try { return JSON.parse(localStorage.getItem('sc_' + key)) || null; }
    catch { return null; }
  },
  set(key, val) { localStorage.setItem('sc_' + key, JSON.stringify(val)); },
  remove(key)   { localStorage.removeItem('sc_' + key); }
};

/* ============================================================
   INITIAL SEED DATA — Populated if store is empty
   ============================================================ */
function seedData() {
  if (!Store.get('seeded')) {
    Store.set('inventory', [
      { id: 'P001', name: 'Whole Milk (1L)',        barcode: '8901234560011', category: 'Dairy',    price: 75,  stock: 50, unit: 'bottle', image: '🥛' },
      { id: 'P002', name: 'White Bread Loaf',       barcode: '8901234560028', category: 'Bakery',   price: 55,  stock: 30, unit: 'loaf',   image: '🍞' },
      { id: 'P003', name: 'Organic Eggs (12 pcs)',  barcode: '8901234560035', category: 'Dairy',    price: 120, stock: 40, unit: 'tray',   image: '🥚' },
      { id: 'P004', name: 'Cheddar Cheese (200g)',  barcode: '8901234560042', category: 'Dairy',    price: 185, stock: 20, unit: 'pack',   image: '🧀' },
      { id: 'P005', name: 'Chicken Breast (500g)',  barcode: '8901234560059', category: 'Meat',     price: 210, stock: 25, unit: 'pack',   image: '🍗' },
      { id: 'P006', name: 'Jasmine Rice (1kg)',     barcode: '8901234560066', category: 'Grains',   price: 65,  stock: 80, unit: 'bag',    image: '🍚' },
      { id: 'P007', name: 'Olive Oil (500ml)',      barcode: '8901234560073', category: 'Pantry',   price: 320, stock: 15, unit: 'bottle', image: '🫒' },
      { id: 'P008', name: 'Pasta (500g)',           barcode: '8901234560080', category: 'Grains',   price: 45,  stock: 60, unit: 'pack',   image: '🍝' },
      { id: 'P009', name: 'Tomato Sauce (250g)',    barcode: '8901234560097', category: 'Pantry',   price: 35,  stock: 45, unit: 'can',    image: '🥫' },
      { id: 'P010', name: 'Orange Juice (1L)',      barcode: '8901234560103', category: 'Beverages',price: 95,  stock: 35, unit: 'bottle', image: '🍊' },
      { id: 'P011', name: 'Greek Yogurt (200g)',    barcode: '8901234560110', category: 'Dairy',    price: 85,  stock: 28, unit: 'cup',    image: '🍦' },
      { id: 'P012', name: 'Banana (per kg)',        barcode: '8901234560127', category: 'Produce',  price: 60,  stock: 55, unit: 'kg',     image: '🍌' },
      { id: 'P013', name: 'Apple Fuji (per kg)',    barcode: '8901234560134', category: 'Produce',  price: 110, stock: 40, unit: 'kg',     image: '🍎' },
      { id: 'P014', name: 'Instant Noodles',        barcode: '8901234560141', category: 'Pantry',   price: 15,  stock: 100,unit: 'pack',   image: '🍜' },
      { id: 'P015', name: 'Bottled Water (1.5L)',   barcode: '8901234560158', category: 'Beverages',price: 25,  stock: 90, unit: 'bottle', image: '💧' },
    ]);

    Store.set('customers', [
      { id: 'C001', name: 'Maria Santos',    email: 'maria@email.com',  phone: '09171234567', joined: '2024-01-15', totalOrders: 12 },
      { id: 'C002', name: 'Jose Reyes',      email: 'jose@email.com',   phone: '09181234567', joined: '2024-02-20', totalOrders: 8  },
      { id: 'C003', name: 'Ana Cruz',        email: 'ana@email.com',    phone: '09191234567', joined: '2024-03-10', totalOrders: 5  },
    ]);

    Store.set('orders', []);
    Store.set('seeded', true);
  }
}

/* ============================================================
   INVENTORY HELPERS
   ============================================================ */
const Inventory = {
  getAll()  { return Store.get('inventory') || []; },
  save(inv) { Store.set('inventory', inv); },

  findById(id)  { return this.getAll().find(p => p.id === id); },
  findByBarcode(bc) { return this.getAll().find(p => p.barcode === bc); },

  add(product) {
    const inv = this.getAll();
    product.id = 'P' + String(Date.now()).slice(-6);
    inv.push(product);
    this.save(inv);
    return product;
  },

  update(id, changes) {
    const inv = this.getAll().map(p => p.id === id ? { ...p, ...changes } : p);
    this.save(inv);
  },

  delete(id) { this.save(this.getAll().filter(p => p.id !== id)); },

  /** Decrease stock after checkout */
  deductStock(items) {
    const inv = this.getAll();
    items.forEach(({ id, qty }) => {
      const p = inv.find(x => x.id === id);
      if (p) p.stock = Math.max(0, p.stock - qty);
    });
    this.save(inv);
  },

  categories() { return [...new Set(this.getAll().map(p => p.category))].sort(); }
};

/* ============================================================
   CUSTOMER HELPERS
   ============================================================ */
const Customers = {
  getAll()  { return Store.get('customers') || []; },
  save(c)   { Store.set('customers', c); },
  findById(id) { return this.getAll().find(c => c.id === id); },

  add(customer) {
    const list = this.getAll();
    customer.id = 'C' + String(Date.now()).slice(-6);
    customer.joined = new Date().toISOString().slice(0,10);
    customer.totalOrders = 0;
    list.push(customer);
    this.save(list);
    return customer;
  },

  update(id, changes) {
    this.save(this.getAll().map(c => c.id === id ? { ...c, ...changes } : c));
  },

  delete(id) { this.save(this.getAll().filter(c => c.id !== id)); }
};

/* ============================================================
   ORDER HELPERS
   ============================================================ */
const Orders = {
  getAll()  { return Store.get('orders') || []; },
  save(o)   { Store.set('orders', o); },

  add(order) {
    const list = this.getAll();
    order.id = 'ORD-' + Date.now();
    order.date = new Date().toISOString();
    list.unshift(order);
    this.save(list);
    return order;
  }
};

/* ============================================================
   TAX & TOTALS
   ============================================================ */
const TAX_RATE = 0.12; // 12% VAT (Philippines)

function calcTotals(items) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const tax      = subtotal * TAX_RATE;
  const total    = subtotal + tax;
  return { subtotal, tax, total };
}

function formatPHP(num) {
  return '₱' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */
function toast(msg, type = 'info') {
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

/* ============================================================
   MODAL HELPERS
   ============================================================ */
function openModal(id)  { document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

/* ============================================================
   TERMS & CONDITIONS — Customer acceptance helpers
   ============================================================ */
function hasAcceptedTerms() {
  return localStorage.getItem('sc_tc_accepted') === '1';
}

function acceptTerms() {
  try {
    localStorage.setItem('sc_tc_accepted', '1');
  } catch (e) {}
  closeModal('modal-terms');
  if (typeof toast === 'function') toast('Terms accepted. You may now use the Customer panel.', 'success');
  // Proceed to customer view if possible
  if (typeof navigateTo === 'function') navigateTo('customer');
}

function declineTerms() {
  closeModal('modal-terms');
  if (typeof toast === 'function') toast('You must accept the Terms to use the Customer panel.', 'warning');
  // Optionally navigate to admin or keep user on current view
  if (typeof navigateTo === 'function') navigateTo('admin');
}

/* ============================================================
   QR CODE — Generate using qrcode.js (CDN)
   ============================================================ */
function generateQR(container, data, size = 200) {
  container.innerHTML = '';
  // Uses qrcode library loaded via CDN
  new QRCode(container, {
    text: typeof data === 'string' ? data : JSON.stringify(data),
    width: size, height: size,
    colorDark: '#1a6bff',
    colorLight: '#0a0a0f',
    correctLevel: QRCode.CorrectLevel.H
  });
}

// Generate a high-contrast black-on-white QR suitable for scanning by phones
function generatePlainQR(container, data, size = 200) {
  container.innerHTML = '';
  new QRCode(container, {
    text: typeof data === 'string' ? data : JSON.stringify(data),
    width: size, height: size,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });
}

/* ============================================================
   CAMERA / BARCODE SCANNING — Uses ZXing library via CDN
   ============================================================ */
const Scanner = {
  reader: null,
  active: false,

  async start(videoEl, onDecode) {
    if (this.active) await this.stop();
    try {
      const ZXing = window.ZXing;
      const hints = new Map();
      const formats = [
        ZXing.BarcodeFormat.QR_CODE,
        ZXing.BarcodeFormat.EAN_13,
        ZXing.BarcodeFormat.EAN_8,
        ZXing.BarcodeFormat.CODE_128,
        ZXing.BarcodeFormat.CODE_39,
        ZXing.BarcodeFormat.UPC_A,
      ];
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
      this.reader = new ZXing.BrowserMultiFormatReader(hints);
      this.active = true;

      await this.reader.decodeFromVideoDevice(null, videoEl, (result, err) => {
        if (result) onDecode(result.getText());
      });
    } catch (err) {
      console.warn('Scanner error:', err);
      toast('Camera access denied or unavailable', 'error');
    }
  },

  async stop() {
    if (this.reader) {
      this.reader.reset();
      this.reader = null;
    }
    this.active = false;
  }
};

/* ============================================================
   DEBOUNCE UTILITY
   ============================================================ */
function debounce(fn, ms = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

/* ============================================================
   DATE FORMATTING
   ============================================================ */
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/* ============================================================
   ID GENERATOR
   ============================================================ */
function uid() { return Math.random().toString(36).slice(2, 9).toUpperCase(); }

/* ============================================================
   THEME (Light / Dark) — simple toggle persisted to localStorage
   Adds/removes the `light-theme` class on the documentElement
   ============================================================ */
function setTheme(theme) {
  try { localStorage.setItem('sc_theme', theme); } catch(e){}
  document.documentElement.classList.toggle('light-theme', theme === 'light');
  // Update any theme toggle buttons present in the DOM
  const btnAdmin = document.getElementById('themeToggleAdmin');
  const btnCust  = document.getElementById('themeToggleCust');
  const icon = theme === 'light' ? '🌙' : '☀️';
  if (btnAdmin) btnAdmin.textContent = icon;
  if (btnCust) btnCust.textContent = icon;
}

function toggleTheme() {
  const cur = (localStorage.getItem('sc_theme') || 'dark');
  const next = cur === 'dark' ? 'light' : 'dark';
  setTheme(next);
  toast(`${next === 'light' ? 'Light' : 'Dark'} mode enabled`, 'info');
}

function initTheme() {
  const saved = localStorage.getItem('sc_theme');
  if (saved) setTheme(saved);
  else {
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    setTheme(prefersLight ? 'light' : 'dark');
  }
}

window.addEventListener('DOMContentLoaded', initTheme);
// Splash screen: show logo on load then hide after a short delay
function initSplash(ms = 6000) {
  try {
    const splash = document.getElementById('splash');
    if (!splash) return;
    // Allow early dismiss on click
    splash.addEventListener('click', () => hideSplash(splash));
    // Hide after ms (default 5000)
    setTimeout(() => hideSplash(splash), parseInt(ms, 10) || 6000);
  } catch (e) { /* ignore */ }
}

function hideSplash(el) {
  if (!el) el = document.getElementById('splash');
  if (!el) return;
  el.classList.add('splash-hidden');
  // remove from DOM after transition to keep things clean
  setTimeout(() => { try { el.remove(); } catch (e) {} }, 600);
}

window.addEventListener('DOMContentLoaded', () => initSplash(6000));

/** ============================================================
 * CUSTOMER ACCESS TOKENS
 * Admin can create short-lived one-time tokens encoded in a QR.
 * The customer scanning the QR opens the URL which validates and
 * consumes the token, allowing access for that session.
 * Stored under key 'cust_access_tokens' in sc_ store.
 * ============================================================ */
function getCustomerAccessTokens() {
  return Store.get('cust_access_tokens') || [];
}

function saveCustomerAccessTokens(list) {
  Store.set('cust_access_tokens', list || []);
}

function createCustomerAccessToken(minutes = 10) {
  const token = uid();
  const now = Date.now();
  const expires = now + Math.max(1, parseInt(minutes||10, 10)) * 60 * 1000;
  const list = getCustomerAccessTokens();
  const item = { token, created: now, expires, used: false };
  list.push(item);
  saveCustomerAccessTokens(list);
  return item;
}

function revokeCustomerAccessToken(token) {
  const list = getCustomerAccessTokens().filter(t => t.token !== token);
  saveCustomerAccessTokens(list);
}

function validateAndConsumeCustomerAccessToken(token) {
  if (!token) return false;
  const list = getCustomerAccessTokens();
  const idx = list.findIndex(t => t.token === token);
  if (idx === -1) return false;
  const entry = list[idx];
  if (entry.used) return false;
  if (Date.now() > entry.expires) {
    // expired — remove it
    list.splice(idx, 1);
    saveCustomerAccessTokens(list);
    return false;
  }
  // consume token (one-time)
  list.splice(idx, 1);
  saveCustomerAccessTokens(list);
  return true;
}

function initCustomerAccessFromURL() {
  // Support URL like: /index.html#customer?access=TOKEN
  try {
    const hash = window.location.hash || '';
    if (!hash) return;
    // remove leading '#'
    const raw = hash.slice(1);
    const [path, qs] = raw.split('?');
    if (!qs) return;
    const params = new URLSearchParams(qs);
    const token = params.get('access') || params.get('token');
    if (!token) return;
    // If the URL includes an explicit expiry, accept based on time only
    const exp = params.get('exp');
    if (exp) {
      const expTs = parseInt(exp, 10);
      if (!isNaN(expTs) && Date.now() <= expTs) {
        sessionStorage.setItem('sc_customer_allowed', '1');
        if (typeof navigateTo === 'function') navigateTo('customer');
        toast('Customer access granted — welcome!', 'success');
        history.replaceState(null, '', window.location.pathname + '#customer');
        return;
      } else {
        toast('Access link expired.', 'error');
        return;
      }
    }
    // Fallback: try local-store validation (admin-generated tokens stored locally)
    const ok = validateAndConsumeCustomerAccessToken(token);
    if (ok) {
      sessionStorage.setItem('sc_customer_allowed', '1');
      if (typeof navigateTo === 'function') navigateTo('customer');
      toast('Customer access granted — welcome!', 'success');
      history.replaceState(null, '', window.location.pathname + '#customer');
    } else {
      toast('Invalid or expired access token.', 'error');
    }
  } catch (e) { /* ignore */ }
}

window.addEventListener('DOMContentLoaded', initCustomerAccessFromURL);
