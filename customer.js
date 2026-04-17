/**
 * SHOP COMPANION — Customer Panel Logic
 * Handles: Product browsing, Barcode scanning, Cart, Shopping Lists,
 *          QR Code generation, Customer login/registration
 */

/* ─── STATE ─── */
let currentCustomer = null;   // { id, name, email, phone, ... }
let cart = [];                // [{ id, name, price, qty, unit, image }]
let activeCategoryFilter = '';
let shopScanner = null;

/* ─── INIT ─── */
document.addEventListener('DOMContentLoaded', () => {
  seedData();
  renderShop();
  renderCart();
  renderLists();
  loadLoginModal();

  // Try to restore last customer from session
  const saved = sessionStorage.getItem('sc_current_customer');
  if (saved) {
    try { setCurrentCustomer(JSON.parse(saved)); } catch {}
  }
});

/* ═══════════════════════════════════════════════
   TAB NAVIGATION
═══════════════════════════════════════════════ */
function custSwitchTab(tab, el) {
  document.querySelectorAll('.cust-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('cpanel-' + tab)?.classList.remove('hidden');
  document.querySelectorAll('.cust-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');

  // Stop scanner when leaving shop
  if (tab !== 'shop') closeShopScanner();
  if (tab === 'qr') renderQRCode();
  if (tab === 'cart') renderCart();
}

/* ═══════════════════════════════════════════════
   CUSTOMER AUTH
═══════════════════════════════════════════════ */
function setCurrentCustomer(customer) {
  currentCustomer = customer;
  sessionStorage.setItem('sc_current_customer', JSON.stringify(customer));
  document.getElementById('custWelcome').textContent = `👋 ${customer.name}`;
  closeModal('modal-login');
  toast(`Welcome, ${customer.name}!`, 'success');
}

function continueAsGuest() {
  currentCustomer = { id: null, name: 'Guest', email: '', phone: '' };
  document.getElementById('custWelcome').textContent = `👋 Guest`;
  closeModal('modal-login');
}

function loadLoginModal() {
  const customers = Customers.getAll();
  const el = document.getElementById('customerList');
  if (!customers.length) {
    el.innerHTML = `<p style="color:var(--gray-400);font-size:13px">No registered customers yet. Register below.</p>`;
    return;
  }
  el.innerHTML = customers.map(c => `
    <div class="customer-select-item" onclick="setCurrentCustomer(${JSON.stringify(c).replace(/"/g,'&quot;')})">
      <div class="csi-avatar">${c.name.charAt(0)}</div>
      <div>
        <div class="csi-name">${c.name}</div>
        <div class="csi-email">${c.email || c.phone || 'No contact'}</div>
      </div>
    </div>`).join('');
}

function switchLoginTab(tab, el) {
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  if (tab === 'login') loadLoginModal();
}

function registerCustomer() {
  const name  = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  if (!name) { toast('Name is required', 'warning'); return; }

  const newCust = Customers.add({ name, email, phone });
  setCurrentCustomer(newCust);
  document.getElementById('regName').value  = '';
  document.getElementById('regEmail').value = '';
  document.getElementById('regPhone').value = '';
}

/* ═══════════════════════════════════════════════
   SHOP / PRODUCT BROWSER
═══════════════════════════════════════════════ */
function renderShop(data) {
  const inv = data || Inventory.getAll();

  // Category pills
  const cats = ['All', ...Inventory.categories()];
  document.getElementById('categoryPills').innerHTML = cats.map(c => `
    <button class="pill ${(c === 'All' && !activeCategoryFilter) || c === activeCategoryFilter ? 'active' : ''}"
      onclick="setCategory('${c}')">${c}
    </button>`).join('');

  // Populate category dropdown
  const catSel = document.getElementById('shopCategory');
  const curCat = catSel.value;
  catSel.innerHTML = '<option value="">All Categories</option>' +
    Inventory.categories().map(c => `<option value="${c}" ${c===curCat?'selected':''}>${c}</option>`).join('');

  // Product cards
  const grid = document.getElementById('productGrid');
  if (!inv.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🔍</div><p>No products found</p></div>`;
    return;
  }

  grid.innerHTML = inv.map(p => {
    const cartQty  = (cart.find(i => i.id === p.id) || { qty: 0 }).qty;
    const outOfStock = p.stock === 0;
    return `
      <div class="product-card ${outOfStock ? 'out-of-stock' : ''}">
        <span class="product-emoji">${p.image || '📦'}</span>
        <div>
          <div class="product-name">${p.name}</div>
          <div class="product-meta">${p.category} · per ${p.unit || 'unit'}</div>
          <div class="product-meta" style="margin-top:4px">
            ${p.stock > 0 ? `<span style="color:var(--green)">✔ ${p.stock} in stock</span>` : '<span style="color:var(--red)">Out of stock</span>'}
          </div>
        </div>
        <div class="product-price">${formatPHP(p.price)}</div>
        <div class="product-actions">
          <div class="qty-control">
            <button class="qty-btn" onclick="changeShopQty('${p.id}', -1)">−</button>
            <span class="qty-val" id="shopqty_${p.id}">${cartQty || 1}</span>
            <button class="qty-btn" onclick="changeShopQty('${p.id}', 1)">+</button>
          </div>
          <button class="add-cart-btn" onclick="addToCart('${p.id}')">
            🛒 Add
          </button>
          <button class="add-list-btn" title="Add to list" onclick="openAddToListModal('${p.id}')">📝</button>
        </div>
        ${outOfStock ? '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--red);background:rgba(0,0,0,0.5);border-radius:var(--radius-lg)">OUT OF STOCK</div>' : ''}
      </div>`;
  }).join('');
}

function filterShop() {
  const query = document.getElementById('shopSearch').value.toLowerCase().trim();
  const cat   = document.getElementById('shopCategory').value;
  const sort  = document.getElementById('shopSort').value;

  activeCategoryFilter = cat;

  let items = Inventory.getAll()
    .filter(p =>
      (!query || p.name.toLowerCase().includes(query) || p.barcode.includes(query)) &&
      (!cat   || p.category === cat)
    );

  if (sort === 'price-asc')  items.sort((a,b) => a.price - b.price);
  if (sort === 'price-desc') items.sort((a,b) => b.price - a.price);
  if (sort === 'name')       items.sort((a,b) => a.name.localeCompare(b.name));

  renderShop(items);
}

function setCategory(cat) {
  activeCategoryFilter = cat === 'All' ? '' : cat;
  document.getElementById('shopCategory').value = activeCategoryFilter;
  filterShop();
}

/* Qty control on shop product card (before adding to cart) */
const shopQtyMap = {};   // tracks selected qty per product card
function changeShopQty(id, delta) {
  shopQtyMap[id] = Math.max(1, (shopQtyMap[id] || 1) + delta);
  const el = document.getElementById('shopqty_' + id);
  if (el) el.textContent = shopQtyMap[id];
}

/* ═══════════════════════════════════════════════
   BARCODE SCANNING (SHOP)
═══════════════════════════════════════════════ */
document.getElementById('modal-barcode-shop').addEventListener('click', (e) => {
  // Start scanner when modal opens
  if (!Scanner.active) {
    Scanner.start(document.getElementById('shopScanVideo'), (code) => {
      handleShopBarcode(code);
    });
  }
});

function handleShopBarcode(code) {
  const product = Inventory.findByBarcode(code);
  closeShopScanner();
  if (product) {
    addProductToCart(product, 1);
    toast(`Added: ${product.name}`, 'success');
  } else {
    toast(`Barcode not found: ${code}`, 'error');
  }
}

function closeShopScanner() {
  Scanner.stop();
  closeModal('modal-barcode-shop');
}

/* ═══════════════════════════════════════════════
   CART
═══════════════════════════════════════════════ */
function addToCart(productId) {
  const product = Inventory.findById(productId);
  if (!product) return;
  const qty = shopQtyMap[productId] || 1;
  addProductToCart(product, qty);
}

function addProductToCart(product, qty = 1) {
  const existing = cart.find(i => i.id === product.id);
  if (existing) {
    existing.qty = Math.min(existing.qty + qty, product.stock);
  } else {
    cart.push({ id: product.id, name: product.name, price: product.price, qty, unit: product.unit || 'unit', image: product.image || '📦' });
  }
  updateCartBadge();
  renderCart();
  toast(`${product.name} added to cart 🛒`, 'success');
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  updateCartBadge();
  renderCart();
}

function updateCartQty(id, qty) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  if (qty <= 0) { removeFromCart(id); return; }
  const product = Inventory.findById(id);
  item.qty = Math.min(qty, product?.stock || qty);
  renderCart();
}

function clearCart() {
  if (cart.length && !confirm('Clear all items from cart?')) return;
  cart = [];
  updateCartBadge();
  renderCart();
}

function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  const count = cart.reduce((s, i) => s + i.qty, 0);
  badge.textContent = count;
  badge.classList.toggle('hidden', count === 0);
}

function renderCart() {
  const el = document.getElementById('cartItems');
  if (!cart.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🛒</div><p>Your cart is empty. Browse the shop!</p></div>`;
    document.getElementById('cartSummary').innerHTML = '';
    document.getElementById('saveToListCard')?.classList.add('hidden');
    return;
  }

  document.getElementById('saveToListCard')?.classList.remove('hidden');

  el.innerHTML = cart.map(item => `
    <div class="cart-item">
      <span class="cart-item-emoji">${item.image}</span>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-unit">per ${item.unit}</div>
        <div class="cart-item-price">${formatPHP(item.price)} each</div>
      </div>
      <div class="cart-item-right">
        <div class="qty-control">
          <button class="qty-btn" onclick="updateCartQty('${item.id}', ${item.qty-1})">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" onclick="updateCartQty('${item.id}', ${item.qty+1})">+</button>
        </div>
        <span class="cart-item-subtotal">${formatPHP(item.price * item.qty)}</span>
        <button class="cart-remove" onclick="removeFromCart('${item.id}')" title="Remove">✕</button>
      </div>
    </div>`).join('');

  // Summary
  const { subtotal, tax, total } = calcTotals(cart);
  document.getElementById('cartSummary').innerHTML = `
    <div class="summary-row"><span>Items (${cart.reduce((s,i)=>s+i.qty,0)})</span><span>${formatPHP(subtotal)}</span></div>
    <div class="summary-row"><span>VAT (12%)</span><span>${formatPHP(tax)}</span></div>
    <div class="summary-total"><span>Total</span><span>${formatPHP(total)}</span></div>`;
}

/* ═══════════════════════════════════════════════
   SHOPPING LISTS
═══════════════════════════════════════════════ */
function getLists() { return Store.get('cust_lists') || []; }
function saveLists(lists) { Store.set('cust_lists', lists); }

function renderLists() {
  const lists = getLists();
  const el = document.getElementById('listsContainer');

  if (!lists.length) {
    el.innerHTML = `
      <div class="empty-state" style="padding-top:60px">
        <div class="empty-icon">📝</div>
        <p>No shopping lists yet. Create one from your cart or click "New List".</p>
      </div>`;
    return;
  }

  el.innerHTML = `<div class="lists-grid">` + lists.map((list, idx) => {
    const { total } = calcTotals(list.items);
    return `
      <div class="list-card">
        <div class="list-card-header">
          <div>
            <div class="list-name">${list.name}</div>
            <div style="font-size:12px;color:var(--gray-400);margin-top:3px">${list.items.length} items · ${formatPHP(total)}</div>
          </div>
          <span class="badge badge-blue">${new Date(list.created).toLocaleDateString()}</span>
        </div>
        ${list.items.slice(0,4).map(i => `
          <div class="list-item-preview">
            <span>${i.image||'📦'} ${i.name}</span>
            <span>×${i.qty} · ${formatPHP(i.price*i.qty)}</span>
          </div>`).join('')}
        ${list.items.length > 4 ? `<div style="font-size:12px;color:var(--gray-400);margin-top:6px">+ ${list.items.length-4} more items</div>` : ''}
        <div class="list-actions">
          <button class="btn btn-primary btn-sm" onclick="loadListToCart(${idx})">🛒 Load to Cart</button>
          <button class="btn btn-ghost btn-sm"   onclick="viewListQR(${idx})">📱 View QR</button>
          <button class="btn btn-danger btn-sm"  onclick="deleteList(${idx})">🗑️</button>
        </div>
      </div>`;
  }).join('') + '</div>';
}

function openNewListModal() {
  document.getElementById('newListNameModal').value = '';
  openModal('modal-new-list');
}

function createNewList() {
  const name = document.getElementById('newListNameModal').value.trim();
  if (!name) { toast('Please enter a list name', 'warning'); return; }

  const lists = getLists();
  lists.push({ name, items: [], created: new Date().toISOString() });
  saveLists(lists);
  closeModal('modal-new-list');
  renderLists();
  toast(`List "${name}" created`, 'success');
}

function saveCartAsList() {
  if (!cart.length) { toast('Cart is empty', 'warning'); return; }
  const name = document.getElementById('newListName').value.trim();
  if (!name) { toast('Enter a list name', 'warning'); return; }

  const lists = getLists();
  lists.push({ name, items: [...cart], created: new Date().toISOString() });
  saveLists(lists);
  document.getElementById('newListName').value = '';
  toast(`Saved as "${name}" ✅`, 'success');
  renderLists();
}

function loadListToCart(idx) {
  const list = getLists()[idx];
  if (!list) return;
  cart = list.items.map(i => ({ ...i }));
  updateCartBadge();
  renderCart();
  custSwitchTab('cart', document.querySelector('[data-tab=cart]'));
  toast(`"${list.name}" loaded to cart`, 'success');
}

function deleteList(idx) {
  const lists = getLists();
  if (!confirm(`Delete "${lists[idx]?.name}"?`)) return;
  lists.splice(idx, 1);
  saveLists(lists);
  renderLists();
  toast('List deleted', 'warning');
}

function viewListQR(idx) {
  const list = getLists()[idx];
  if (!list) return;
  // Temporarily set cart to list items and go to QR tab
  cart = list.items.map(i => ({ ...i }));
  updateCartBadge();
  custSwitchTab('qr', document.querySelector('[data-tab=qr]'));
  toast(`Showing QR for "${list.name}"`, 'info');
}

/* ─── Add product to an existing list ─── */
let addToListProductId = null;

function openAddToListModal(productId) {
  addToListProductId = productId;
  const product = Inventory.findById(productId);
  document.getElementById('addToListProductName').textContent = `Adding: ${product?.name}`;

  const lists = getLists();
  const el = document.getElementById('addToListOptions');
  if (!lists.length) {
    el.innerHTML = `<p style="color:var(--gray-400);font-size:13px">No lists yet. Create one first.</p>
      <button class="btn btn-primary" style="margin-top:12px" onclick="closeModal('modal-add-to-list');openNewListModal()">Create a List</button>`;
  } else {
    el.innerHTML = lists.map((list, idx) => `
      <div class="customer-select-item" onclick="addProductToList(${idx})">
        <span style="font-size:20px">📝</span>
        <div>
          <div class="csi-name">${list.name}</div>
          <div class="csi-email">${list.items.length} items</div>
        </div>
      </div>`).join('');
  }
  openModal('modal-add-to-list');
}

function addProductToList(listIdx) {
  if (!addToListProductId) return;
  const product = Inventory.findById(addToListProductId);
  if (!product) return;

  const lists = getLists();
  const list = lists[listIdx];
  const existing = list.items.find(i => i.id === product.id);
  if (existing) {
    existing.qty += 1;
  } else {
    list.items.push({ id: product.id, name: product.name, price: product.price, qty: 1, unit: product.unit || 'unit', image: product.image || '📦' });
  }
  saveLists(lists);
  closeModal('modal-add-to-list');
  renderLists();
  toast(`Added to "${list.name}" ✅`, 'success');
}

/* ═══════════════════════════════════════════════
   QR CODE GENERATION
═══════════════════════════════════════════════ */
function renderQRCode() {
  const qrEl  = document.getElementById('qrOutput');
  const sumEl = document.getElementById('qrCartSummary');

  if (!cart.length) {
    qrEl.innerHTML = `<div class="empty-state"><div class="empty-icon">🛒</div><p>Add items to your cart first</p></div>`;
    sumEl.innerHTML = '';
    return;
  }

  const { subtotal, tax, total } = calcTotals(cart);

  // QR payload: structured order data for admin to read
  const payload = {
    customerId:   currentCustomer?.id   || null,
    customerName: currentCustomer?.name || 'Guest',
    items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax:      parseFloat(tax.toFixed(2)),
    total:    parseFloat(total.toFixed(2)),
    timestamp: new Date().toISOString(),
  };

  generateQR(qrEl, payload, 220);

  // Cart preview
  sumEl.innerHTML = `
    <div class="qr-cart-preview">
      <strong style="font-size:14px">Order for: ${currentCustomer?.name || 'Guest'}</strong>
      <div style="margin:10px 0">
        ${cart.map(i => `
          <div class="qr-item-line">
            <span>${i.image} ${i.name} ×${i.qty}</span>
            <span>${formatPHP(i.price * i.qty)}</span>
          </div>`).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;padding-top:8px;font-weight:700;color:var(--green)">
        <span>Total (incl. VAT):</span>
        <span>${formatPHP(total)}</span>
      </div>
    </div>`;
}

function regenerateQR() {
  document.getElementById('qrOutput').innerHTML = '';
  renderQRCode();
  toast('QR code refreshed', 'info');
}
