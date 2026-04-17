/**
 * SHOP COMPANION — Admin Panel Logic
 * Handles: Dashboard, Inventory CRUD, Barcode Scanner, QR Checkout,
 *          Customer Management, Order History, Receipts
 */

/* ─── INIT ─── */
document.addEventListener('DOMContentLoaded', () => {
  seedData();           // populate local storage if empty
  renderDashboard();
  renderInventory();
  renderCustomers();
  renderCustomerAccess();
  renderOrders();
});

/* ============================================================
   CUSTOMER ACCESS (Admin)
   Provides UI to generate short-lived QR tokens for customer access
   ============================================================ */
function renderCustomerAccess() {
  const out = document.getElementById('caOutput');
  const listEl = document.getElementById('caList');
  if (out) out.innerHTML = '';
  const tokens = getCustomerAccessTokens();
  if (!tokens.length) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">🔐</div><p>No active access tokens</p></div>`;
    return;
  }
  listEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">` + tokens.map(t => {
    const created = new Date(t.created).toLocaleString();
    const exp = new Date(t.expires).toLocaleString();
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:8px;background:rgba(255,255,255,0.03)">
      <div style="font-family:monospace">${t.token}</div>
      <div style="font-size:12px;color:var(--gray-400)">Expires: ${exp}</div>
      <div><button class="btn btn-danger btn-sm" onclick="revokeCustomerAccess('${t.token}')">Revoke</button></div>
    </div>`;
  }).join('') + `</div>`;
}

function generateCustomerAccess() {
  const minutes = parseInt(document.getElementById('caExpiry')?.value || '10', 10);
  const item = createCustomerAccessToken(minutes);
  // Build URL with access token in hash so scanner opens it properly
  const url = `${location.origin}${location.pathname}#customer?access=${item.token}`;
  const out = document.getElementById('caOutput');
  out.innerHTML = '';
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.gap = '12px';
  container.style.alignItems = 'center';
  const qr = document.createElement('div');
  generateQR(qr, url, 220);
  const info = document.createElement('div');
  info.innerHTML = `<div><strong>URL (one-time)</strong></div><div style="font-family:monospace;margin-top:8px">${url}</div>`;
  container.appendChild(qr);
  container.appendChild(info);
  out.appendChild(container);
  renderCustomerAccess();
}

function revokeCustomerAccess(token) {
  if (!confirm('Revoke this access token?')) return;
  revokeCustomerAccessToken(token);
  renderCustomerAccess();
  toast('Token revoked', 'warning');
}

/* ═══════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════ */
function toggleSidebar() {
  const sb   = document.getElementById('sidebar');
  const main = document.querySelector('.admin-main');
  sb.classList.toggle('collapsed');
  main.classList.toggle('expanded');
}

/* ═══════════════════════════════════════════════
   TAB NAVIGATION
═══════════════════════════════════════════════ */
function switchTab(tab, el) {
  // Hide all panels
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  // Show selected
  document.getElementById('tab-' + tab)?.classList.remove('hidden');
  // Update nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');

  // Stop any active scanner when leaving checkout
  if (tab !== 'checkout') stopCheckoutScanner();
}

/* ═══════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════ */
function renderDashboard() {
  const inv      = Inventory.getAll();
  const customers= Customers.getAll();
  const orders   = Orders.getAll();

  const totalProducts = inv.length;
  const lowStock      = inv.filter(p => p.stock <= 10);
  const totalValue    = inv.reduce((s, p) => s + p.price * p.stock, 0);
  const todayRevenue  = orders
    .filter(o => o.date && o.date.slice(0,10) === new Date().toISOString().slice(0,10))
    .reduce((s, o) => s + (o.total || 0), 0);

  // Stats Cards
  const statsGrid = document.getElementById('statsGrid');
  statsGrid.innerHTML = `
    ${statCard('📦', 'Total Products', totalProducts, 'blue')}
    ${statCard('👥', 'Customers',      customers.length, 'green')}
    ${statCard('⚠️', 'Low Stock Items',lowStock.length, 'yellow')}
    ${statCard('💰', "Today's Revenue", formatPHP(todayRevenue), 'blue')}
  `;

  // Low Stock List
  const lsEl = document.getElementById('lowStockList');
  if (!lowStock.length) {
    lsEl.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><p>All items well stocked</p></div>`;
  } else {
    lsEl.innerHTML = lowStock.slice(0,8).map(p => `
      <div class="low-stock-item">
        <div class="low-stock-name"><span>${p.image||'📦'}</span>${p.name}</div>
        <span class="low-stock-count badge badge-yellow">${p.stock} left</span>
      </div>`).join('');
  }

  // Recent Orders
  const roEl = document.getElementById('recentOrdersList');
  if (!orders.length) {
    roEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>No orders yet</p></div>`;
  } else {
    roEl.innerHTML = orders.slice(0,6).map(o => `
      <div class="recent-order-item">
        <div>
          <div style="font-weight:600;font-size:13px">${o.id}</div>
          <div style="color:var(--gray-400);font-size:12px">${o.customerName||'Walk-in'} · ${formatDate(o.date)}</div>
        </div>
        <span class="badge badge-green">${formatPHP(o.total||0)}</span>
      </div>`).join('');
  }
}

function statCard(icon, label, value, color) {
  return `
    <div class="stat-card">
      <div class="stat-icon ${color}">${icon}</div>
      <div>
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
      </div>
    </div>`;
}

/* ═══════════════════════════════════════════════
   INVENTORY
═══════════════════════════════════════════════ */
function renderInventory(data) {
  const items = data || Inventory.getAll();

  // Populate category filter
  const catEl = document.getElementById('invCategory');
  const cats  = Inventory.categories();
  const currentCat = catEl.value;
  catEl.innerHTML  = '<option value="">All Categories</option>' +
    cats.map(c => `<option value="${c}" ${c===currentCat?'selected':''}>${c}</option>`).join('');

  const tbody = document.getElementById('inventoryBody');
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📦</div><p>No products found</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(p => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:22px">${p.image||'📦'}</span>
          <div>
            <div style="font-weight:600">${p.name}</div>
            <div style="font-size:12px;color:var(--gray-400)">${p.id} · per ${p.unit||'unit'}</div>
          </div>
        </div>
      </td>
      <td style="font-family:monospace;font-size:13px;color:var(--gray-400)">${p.barcode}</td>
      <td><span class="badge badge-blue">${p.category}</span></td>
      <td style="font-weight:700;color:var(--blue-light)">${formatPHP(p.price)}</td>
      <td>
        <div class="stock-edit">
          <input type="number" min="0" value="${p.stock}" id="stock_${p.id}"
            onchange="updateStock('${p.id}', this.value)" />
        </div>
      </td>
      <td>${stockBadge(p.stock)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="openEditProductModal('${p.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

function stockBadge(stock) {
  if (stock === 0) return `<span class="badge badge-red">Out of Stock</span>`;
  if (stock <= 5)  return `<span class="badge badge-red">Critical</span>`;
  if (stock <= 10) return `<span class="badge badge-yellow">Low</span>`;
  return `<span class="badge badge-green">In Stock</span>`;
}

function filterInventory() {
  const query = document.getElementById('invSearch').value.toLowerCase().trim();
  const cat   = document.getElementById('invCategory').value;
  const sort  = document.getElementById('invSort').value;

  let items = Inventory.getAll()
    .filter(p =>
      (!query || p.name.toLowerCase().includes(query) || p.barcode.includes(query) || p.id.toLowerCase().includes(query)) &&
      (!cat   || p.category === cat)
    );

  if (sort === 'stock-asc')   items.sort((a,b) => a.stock - b.stock);
  if (sort === 'stock-desc')  items.sort((a,b) => b.stock - a.stock);
  if (sort === 'price-asc')   items.sort((a,b) => a.price - b.price);
  if (sort === 'price-desc')  items.sort((a,b) => b.price - a.price);
  if (sort === 'name')        items.sort((a,b) => a.name.localeCompare(b.name));

  renderInventory(items);
}

function updateStock(id, val) {
  const stock = parseInt(val, 10);
  if (isNaN(stock) || stock < 0) return;
  Inventory.update(id, { stock });
  toast('Stock updated', 'success');
  renderDashboard();
}

/* ── Add / Edit Product Modal ── */
let scannerContext = '';  // 'barcode-inventory'

function openAddProductModal() {
  document.getElementById('productModalTitle').textContent = 'Add Product';
  document.getElementById('productForm').reset();
  document.getElementById('pEditId').value = '';
  openModal('modal-product');
}

function openEditProductModal(id) {
  const p = Inventory.findById(id);
  if (!p) return;
  document.getElementById('productModalTitle').textContent = 'Edit Product';
  document.getElementById('pEditId').value    = p.id;
  document.getElementById('pName').value      = p.name;
  document.getElementById('pBarcode').value   = p.barcode;
  document.getElementById('pCategory').value  = p.category;
  document.getElementById('pUnit').value      = p.unit || '';
  document.getElementById('pPrice').value     = p.price;
  document.getElementById('pStock').value     = p.stock;
  document.getElementById('pImage').value     = p.image || '';
  openModal('modal-product');
}

function saveProduct(e) {
  e.preventDefault();
  const editId = document.getElementById('pEditId').value;
  const data   = {
    name:     document.getElementById('pName').value.trim(),
    barcode:  document.getElementById('pBarcode').value.trim(),
    category: document.getElementById('pCategory').value.trim(),
    unit:     document.getElementById('pUnit').value.trim() || 'unit',
    price:    parseFloat(document.getElementById('pPrice').value),
    stock:    parseInt(document.getElementById('pStock').value, 10),
    image:    document.getElementById('pImage').value.trim() || '📦',
  };

  if (editId) {
    Inventory.update(editId, data);
    toast('Product updated ✅', 'success');
  } else {
    Inventory.add(data);
    toast('Product added ✅', 'success');
  }

  closeModal('modal-product');
  renderInventory();
  renderDashboard();
}

function deleteProduct(id) {
  const p = Inventory.findById(id);
  if (!p) return;
  if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
  Inventory.delete(id);
  toast('Product deleted', 'warning');
  renderInventory();
  renderDashboard();
}

/* ── Inventory Barcode Scanner ── */
function openScannerModal(context) {
  scannerContext = context;
  openModal('modal-scanner');
  // Start scanning
  Scanner.start(document.getElementById('modalVideo'), (code) => {
    handleScannedCode(code);
  });
}

function closeScannerModal() {
  Scanner.stop();
  closeModal('modal-scanner');
}

function handleScannedCode(code) {
  if (scannerContext === 'barcode-inventory') {
    // Find product by barcode
    const product = Inventory.findByBarcode(code);
    closeScannerModal();
    if (product) {
      toast(`Found: ${product.name}`, 'success');
      openEditProductModal(product.id);
    } else {
      toast('Product not found. Create a new one?', 'warning');
      openAddProductModal();
      document.getElementById('pBarcode').value = code;
    }
  }
}

/* ═══════════════════════════════════════════════
   CHECKOUT
═══════════════════════════════════════════════ */
let checkoutScanner = null;

function startCheckoutScanner() {
  document.getElementById('startCheckoutScan').classList.add('hidden');
  document.getElementById('stopCheckoutScan').classList.remove('hidden');
  const video = document.getElementById('checkoutVideo');

  Scanner.start(video, (code) => {
    stopCheckoutScanner();
    try {
      const orderData = JSON.parse(code);
      displayCheckoutOrder(orderData);
    } catch {
      toast('Invalid QR code format', 'error');
    }
  });
}

function stopCheckoutScanner() {
  Scanner.stop();
  document.getElementById('startCheckoutScan').classList.remove('hidden');
  document.getElementById('stopCheckoutScan').classList.add('hidden');
}

function processManualQR() {
  const raw = document.getElementById('manualQRInput').value.trim();
  if (!raw) { toast('Please paste QR data first', 'warning'); return; }
  try {
    const orderData = JSON.parse(raw);
    displayCheckoutOrder(orderData);
  } catch {
    toast('Invalid JSON format', 'error');
  }
}

function displayCheckoutOrder(orderData) {
  // orderData: { customerId, customerName, items:[{id,name,qty,price}], listName }
  const items      = orderData.items || [];
  const { subtotal, tax, total } = calcTotals(items);
  const customer   = Customers.findById(orderData.customerId) || { name: orderData.customerName || 'Walk-in' };

  let html = `
    <div style="margin-bottom:16px">
      <div style="font-size:13px;color:var(--gray-400)">Customer</div>
      <div style="font-weight:700;font-size:1.1rem">${customer.name}</div>
      ${orderData.listName ? `<div class="badge badge-blue" style="margin-top:6px">${orderData.listName}</div>` : ''}
    </div>
    <div class="order-summary-items">
  `;

  // Check stock availability
  let hasStockIssues = false;
  items.forEach(item => {
    const inv = Inventory.findById(item.id);
    const available = inv ? inv.stock : 0;
    const insufficient = available < item.qty;
    if (insufficient) hasStockIssues = true;

    html += `
      <div class="order-item-row" style="${insufficient ? 'border:1px solid var(--red);' : ''}">
        <span class="order-item-icon">${inv?.image || '📦'}</span>
        <div class="order-item-name">
          ${item.name}
          ${insufficient ? `<div style="color:var(--red);font-size:11px">⚠️ Only ${available} available</div>` : ''}
        </div>
        <span class="order-item-qty">×${item.qty}</span>
        <span class="order-item-price">${formatPHP(item.price * item.qty)}</span>
      </div>`;
  });

  html += `</div>
    <div class="order-totals">
      <div class="totals-row"><span>Subtotal</span><span>${formatPHP(subtotal)}</span></div>
      <div class="totals-row"><span>VAT (12%)</span><span>${formatPHP(tax)}</span></div>
      <div class="totals-row total"><span>TOTAL</span><span>${formatPHP(total)}</span></div>
    </div>
    <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap">
      ${hasStockIssues ? `<div class="badge badge-yellow" style="padding:8px 14px">⚠️ Stock issues detected</div>` : ''}
      <button class="btn btn-success btn-lg" style="flex:1" onclick='completeCheckout(${JSON.stringify({...orderData,subtotal,tax,total,customer})})'>
        ✅ Complete Checkout
      </button>
    </div>`;

  document.getElementById('checkoutOrderContent').innerHTML = html;
}

function completeCheckout(data) {
  // Deduct inventory
  Inventory.deductStock(data.items.map(i => ({ id: i.id, qty: i.qty })));

  // Save order
  const order = Orders.add({
    customerId:   data.customerId,
    customerName: data.customer?.name || data.customerName || 'Walk-in',
    listName:     data.listName,
    items:        data.items,
    subtotal:     data.subtotal,
    tax:          data.tax,
    total:        data.total,
    status:       'completed'
  });

  // Update customer order count
  if (data.customerId) {
    const cust = Customers.findById(data.customerId);
    if (cust) Customers.update(data.customerId, { totalOrders: (cust.totalOrders || 0) + 1 });
  }

  toast('Checkout complete! 🎉', 'success');

  // Show receipt
  showReceipt(order);

  // Reset checkout panel
  document.getElementById('checkoutOrderContent').innerHTML = `
    <div class="empty-state"><div class="empty-icon">✅</div><p>Order completed! Scan next customer.</p></div>`;
  document.getElementById('manualQRInput').value = '';

  // Refresh tabs
  renderInventory();
  renderOrders();
  renderDashboard();
}

/* ── Receipt ── */
function showReceipt(order) {
  const now = new Date();
  let html = `
    <div class="receipt">
      <div class="receipt-title">🛒 SHOP COMPANION</div>
      <div style="text-align:center;color:var(--gray-400);font-size:12px;margin-bottom:8px">Official Receipt</div>
      <hr class="receipt-divider" />
      <div class="receipt-row"><span>Order:</span><span>${order.id}</span></div>
      <div class="receipt-row"><span>Customer:</span><span>${order.customerName}</span></div>
      <div class="receipt-row"><span>Date:</span><span>${now.toLocaleDateString()}</span></div>
      <div class="receipt-row"><span>Time:</span><span>${now.toLocaleTimeString()}</span></div>
      <hr class="receipt-divider" />
  `;

  order.items.forEach(item => {
    html += `<div class="receipt-row">
      <span>${item.name} (×${item.qty})</span>
      <span>${formatPHP(item.price * item.qty)}</span>
    </div>`;
  });

  html += `
      <hr class="receipt-divider" />
      <div class="receipt-row"><span>Subtotal:</span><span>${formatPHP(order.subtotal)}</span></div>
      <div class="receipt-row"><span>VAT (12%):</span><span>${formatPHP(order.tax)}</span></div>
      <hr class="receipt-divider" />
      <div class="receipt-row receipt-total"><span>TOTAL:</span><span>${formatPHP(order.total)}</span></div>
      <hr class="receipt-divider" />
      <div style="text-align:center;margin-top:10px;color:var(--gray-400);font-size:12px">
        Thank you for shopping! 💙
      </div>
    </div>
  `;

  document.getElementById('receiptContent').innerHTML = html;
  openModal('modal-receipt');
}

function printReceipt() {
  const content = document.getElementById('receiptContent').innerHTML;
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>Receipt</title>
    <style>
      body { font-family: monospace; padding: 20px; max-width: 380px; margin: auto; }
      .receipt-row { display: flex; justify-content: space-between; }
    </style></head>
    <body>${content}</body></html>`);
  win.document.close();
  win.print();
}

/* View specific order receipt from history */
function viewOrderReceipt(orderId) {
  const order = Orders.getAll().find(o => o.id === orderId);
  if (!order) return;
  showReceipt(order);
}

/* ═══════════════════════════════════════════════
   CUSTOMERS
═══════════════════════════════════════════════ */
function renderCustomers(data) {
  const customers = data || Customers.getAll();
  const tbody = document.getElementById('customersBody');

  if (!customers.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">👥</div><p>No customers yet</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = customers.map(c => `
    <tr>
      <td style="font-family:monospace;font-size:12px;color:var(--gray-400)">${c.id}</td>
      <td><strong>${c.name}</strong></td>
      <td style="color:var(--gray-400)">${c.email || '—'}</td>
      <td style="color:var(--gray-400)">${c.phone || '—'}</td>
      <td style="color:var(--gray-400)">${c.joined || '—'}</td>
      <td><span class="badge badge-blue">${c.totalOrders || 0} orders</span></td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="openEditCustomerModal('${c.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteCustomer('${c.id}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

function filterCustomers() {
  const q = document.getElementById('custSearch').value.toLowerCase();
  const filtered = Customers.getAll().filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.email || '').toLowerCase().includes(q) ||
    (c.phone || '').includes(q)
  );
  renderCustomers(filtered);
}

function openAddCustomerModal() {
  document.getElementById('custModalTitle').textContent = 'Add Customer';
  document.getElementById('cName').value  = '';
  document.getElementById('cEmail').value = '';
  document.getElementById('cPhone').value = '';
  document.getElementById('cEditId').value = '';
  openModal('modal-customer');
}

function openEditCustomerModal(id) {
  const c = Customers.findById(id);
  if (!c) return;
  document.getElementById('custModalTitle').textContent = 'Edit Customer';
  document.getElementById('cEditId').value = c.id;
  document.getElementById('cName').value   = c.name;
  document.getElementById('cEmail').value  = c.email || '';
  document.getElementById('cPhone').value  = c.phone || '';
  openModal('modal-customer');
}

function saveCustomer(e) {
  e.preventDefault();
  const editId = document.getElementById('cEditId').value;
  const data = {
    name:  document.getElementById('cName').value.trim(),
    email: document.getElementById('cEmail').value.trim(),
    phone: document.getElementById('cPhone').value.trim(),
  };
  if (!data.name) return;

  if (editId) {
    Customers.update(editId, data);
    toast('Customer updated ✅', 'success');
  } else {
    Customers.add(data);
    toast('Customer added ✅', 'success');
  }
  closeModal('modal-customer');
  renderCustomers();
  renderDashboard();
}

function deleteCustomer(id) {
  const c = Customers.findById(id);
  if (!c || !confirm(`Remove customer "${c.name}"?`)) return;
  Customers.delete(id);
  toast('Customer removed', 'warning');
  renderCustomers();
  renderDashboard();
}

/* ═══════════════════════════════════════════════
   ORDERS HISTORY
═══════════════════════════════════════════════ */
function renderOrders() {
  const orders = Orders.getAll();
  const tbody  = document.getElementById('ordersBody');

  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📋</div><p>No orders yet</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td style="font-family:monospace;font-size:12px">${o.id}</td>
      <td><strong>${o.customerName || 'Walk-in'}</strong></td>
      <td style="color:var(--gray-400);font-size:13px">${formatDate(o.date)}</td>
      <td style="color:var(--gray-400)">${o.items?.length || 0} items</td>
      <td style="font-weight:700;color:var(--green)">${formatPHP(o.total||0)}</td>
      <td><span class="badge badge-green">${o.status || 'completed'}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="viewOrderReceipt('${o.id}')">🧾 Receipt</button>
      </td>
    </tr>`).join('');
}
