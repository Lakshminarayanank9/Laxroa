const sampleProducts = [
  {
    id: 'sample-product-one',
    name: 'Sample Product One',
    description: 'First sample product.',
    pricePaise: 49900,
    art: 'one',
  },
  {
    id: 'sample-product-two',
    name: 'Sample Product Two',
    description: 'Second sample product.',
    pricePaise: 99900,
    art: 'two',
  },
  {
    id: 'sample-product-three',
    name: 'Sample Product Three',
    description: 'Third sample product.',
    pricePaise: 149900,
    art: 'three',
  },
];

const configuredApiBase = document.querySelector('meta[name="api-base-url"]')?.content.trim().replace(/\/$/, '') || '';
const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const isAdminRoute = /^\/admin\/?$/.test(window.location.pathname);
const apiBase = configuredApiBase || (isLocalHost ? 'http://localhost:4000' : '');
const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});
const cart = new Map();
let products = [...sampleProducts];
let adminProducts = [];
let currentGallery = [];
let currentSpinFrames = [];
let activeAdminProductId = '';
let adminFormDirty = false;
let isCreatingAdminProduct = false;
let liveCatalogLoaded = false;
let resetToken = new URLSearchParams(window.location.search).get('resetToken');
let accountMode = new URLSearchParams(window.location.search).get('account');
let viewerFrames = [];
let viewerFrameIndex = 0;
let dragPosition = null;

const productGrid = document.querySelector('#product-grid');
const catalogStatus = document.querySelector('#catalog-status');
const heroNote = document.querySelector('#hero-note');
const cartCount = document.querySelector('#cart-count');
const cartDialog = document.querySelector('#cart-dialog');
const cartItems = document.querySelector('#cart-items');
const cartSubtotal = document.querySelector('#cart-subtotal');
const checkoutNote = document.querySelector('#checkout-note');
const checkoutDialog = document.querySelector('#checkout-dialog');
const checkoutForm = document.querySelector('#checkout-form');
const checkoutSummary = document.querySelector('#checkout-summary');
const checkoutStatus = document.querySelector('#checkout-status');
const checkoutConfirmation = document.querySelector('#checkout-confirmation');
const checkoutConfirmationText = document.querySelector('#checkout-confirmation-text');
const placeOrderButton = document.querySelector('#place-cod-order');
const viewerDialog = document.querySelector('#viewer-dialog');
const viewerStage = document.querySelector('#viewer-stage');
const viewerImage = document.querySelector('#viewer-image');
const viewerCounter = document.querySelector('#viewer-counter');
const adminDialog = document.querySelector('#admin-dialog');
const adminLoginSection = document.querySelector('#admin-login-section');
const adminEditorSection = document.querySelector('#admin-editor-section');
const adminLoginStatus = document.querySelector('#admin-login-status');
const adminEditorStatus = document.querySelector('#admin-editor-status');
const adminProductSelect = document.querySelector('#admin-product-select');
const adminProductForm = document.querySelector('#admin-product-form');
const adminOrdersStatus = document.querySelector('#admin-orders-status');
const adminOrdersList = document.querySelector('#admin-orders-list');
const adminSpinList = document.querySelector('#admin-spin-list');
const adminCoverPreview = document.querySelector('#admin-cover-preview');
const adminCoverEmpty = document.querySelector('#admin-cover-empty');
const accountDialog = document.querySelector('#account-dialog');
const accountLoginStatus = document.querySelector('#account-login-status');
const accountRegisterStatus = document.querySelector('#account-register-status');
const accountForgotStatus = document.querySelector('#account-forgot-status');
const accountResetStatus = document.querySelector('#account-reset-status');
const accountPasswordStatus = document.querySelector('#account-password-status');

if (isAdminRoute) document.body.classList.add('admin-route');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function safeHttpUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return '';
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function apiPath(path) {
  return `${apiBase}${path}`;
}

async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(apiPath(path), {
    ...options,
    headers,
    credentials: 'include',
  });
  const responseText = await response.text();
  let data = null;
  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`The API returned an unreadable response (${response.status}).`);
    }
  }

  if (!response.ok) {
    const error = new Error(data?.error || `The request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function imagesFor(product, kind) {
  return (product.images || [])
    .filter((image) => image.kind === kind)
    .sort((first, second) => first.position - second.position);
}

function productArtClass(product, index) {
  const art = product.art || ['one', 'two', 'three'][index % 3];
  return `product-art-${escapeHtml(art)}`;
}

function renderProducts() {
  if (products.length === 0) {
    productGrid.innerHTML = '<p class="empty-cart">There are no products available right now.</p>';
    return;
  }

  productGrid.innerHTML = products.map((product, index) => {
    const gallery = imagesFor(product, 'GALLERY');
    const coverUrl = safeHttpUrl(gallery[0]?.url);
    const frames = imagesFor(product, 'SPIN360').filter((frame) => safeHttpUrl(frame.url));
    const noStock = Number.isFinite(product.stock) && product.stock <= 0;
    const compareAtPrice = Number(product.compareAtPricePaise);
    const hasDiscount = Number.isFinite(compareAtPrice) && compareAtPrice > product.pricePaise;
    const discountPercent = hasDiscount
      ? Math.max(1, Math.round((1 - product.pricePaise / compareAtPrice) * 100))
      : 0;
    return `
      <article class="product-card">
        <div class="product-art ${productArtClass(product, index)}${coverUrl ? ' has-image' : ''}">
          ${coverUrl
            ? `<img class="product-photo" src="${escapeHtml(coverUrl)}" alt="${escapeHtml(product.name)}" loading="lazy">`
            : `<span class="product-number">NO. 0${index + 1}</span><div class="product-shape" aria-hidden="true"></div>`}
          ${frames.length >= 2
            ? `<button class="spin-button" type="button" data-view360="${escapeHtml(product.id)}">360° view</button>`
            : ''}
          ${hasDiscount ? `<span class="product-discount">${discountPercent}% off</span>` : ''}
        </div>
        <div class="product-info">
          <div>
            <h3>${escapeHtml(product.name)}</h3>
            <p>${escapeHtml(product.description)}</p>
          </div>
          <div class="product-price-group">
            <span class="product-price">${currency.format((product.pricePaise || 0) / 100)}</span>
            ${hasDiscount ? `<span class="product-price-compare">${currency.format(compareAtPrice / 100)}</span>` : ''}
          </div>
        </div>
        <button class="add-button" type="button" data-add="${escapeHtml(product.id)}" ${noStock ? 'disabled' : ''}>
          ${noStock ? 'Out of stock' : 'Add to bag'}
        </button>
      </article>
    `;
  }).join('');
}

function renderCart() {
  for (const id of cart.keys()) {
    if (!products.some((product) => product.id === id)) cart.delete(id);
  }

  const entries = [...cart.entries()];
  const quantity = entries.reduce((total, [, count]) => total + count, 0);
  const subtotal = entries.reduce((total, [id, count]) => {
    const product = products.find((item) => item.id === id);
    return total + (product?.pricePaise || 0) * count;
  }, 0);

  cartCount.textContent = String(quantity);
  cartSubtotal.textContent = currency.format(subtotal / 100);

  if (entries.length === 0) {
    cartItems.innerHTML = '<p class="empty-cart">Your bag is empty. Find something you like in the collection.</p>';
    return;
  }

  cartItems.innerHTML = entries.map(([id, count]) => {
    const product = products.find((item) => item.id === id);
    const imageUrl = safeHttpUrl(imagesFor(product, 'GALLERY')[0]?.url);
    return `
      <div class="cart-item">
        <div class="cart-item-swatch ${productArtClass(product, 0)}" aria-hidden="true">
          ${imageUrl ? `<img class="product-photo" src="${escapeHtml(imageUrl)}" alt="">` : ''}
        </div>
        <div>
          <p class="cart-item-name">${escapeHtml(product.name)}</p>
          <p class="cart-item-meta">${currency.format(product.pricePaise / 100)} · Qty ${count}</p>
        </div>
        <button class="remove-button" type="button" data-remove="${escapeHtml(id)}" aria-label="Remove ${escapeHtml(product.name)} from bag">Remove</button>
      </div>
    `;
  }).join('');
}

function renderCheckoutSummary() {
  const entries = [...cart.entries()];
  const subtotal = entries.reduce((total, [id, quantity]) => {
    const product = products.find((item) => item.id === id);
    return total + (product?.pricePaise || 0) * quantity;
  }, 0);
  checkoutSummary.innerHTML = `
    <ul class="checkout-summary-list">
      ${entries.map(([id, quantity]) => {
        const product = products.find((item) => item.id === id);
        if (!product) return '';
        return `<li><span>${escapeHtml(product.name)} × ${quantity}</span><strong>${currency.format(product.pricePaise * quantity / 100)}</strong></li>`;
      }).join('')}
    </ul>
    <div class="checkout-total"><span>Product subtotal</span><strong>${currency.format(subtotal / 100)}</strong></div>
  `;
}

async function loadProducts() {
  try {
    const response = await apiRequest('/api/products');
    if (!Array.isArray(response?.products)) {
      throw new Error('The product API returned an invalid catalog.');
    }
    products = response.products;
    liveCatalogLoaded = true;
    catalogStatus.textContent = 'Live catalog · Prices in INR';
    heroNote.textContent = products.length === 0
      ? 'Our first collection is coming soon.'
      : 'Explore the QIVRA collection.';
  } catch (error) {
    products = [...sampleProducts];
    liveCatalogLoaded = false;
    catalogStatus.textContent = 'Preview catalog — API unavailable; admin changes are not saved.';
    catalogStatus.title = error.message;
    heroNote.textContent = 'Preview products are shown while the live catalog is unavailable.';
    console.warn('Product catalog is using preview data:', error.message);
  }
  renderProducts();
  renderCart();
}

function moveViewer(amount) {
  if (viewerFrames.length === 0) return;
  viewerFrameIndex = (viewerFrameIndex + amount + viewerFrames.length) % viewerFrames.length;
  renderViewerFrame();
}

function renderViewerFrame() {
  const frame = viewerFrames[viewerFrameIndex];
  viewerImage.src = safeHttpUrl(frame.url);
  viewerImage.alt = `${document.querySelector('#viewer-title').textContent}, frame ${viewerFrameIndex + 1}`;
  viewerCounter.textContent = `Frame ${viewerFrameIndex + 1} of ${viewerFrames.length}`;
}

function openViewer(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  viewerFrames = imagesFor(product, 'SPIN360').filter((frame) => safeHttpUrl(frame.url));
  if (viewerFrames.length < 2) return;
  viewerFrameIndex = 0;
  document.querySelector('#viewer-title').textContent = `${product.name} · 360° view`;
  renderViewerFrame();
  viewerDialog.showModal();
  viewerStage.focus();
}

function updateAdminCover() {
  const url = safeHttpUrl(currentGallery[0]?.url);
  adminCoverPreview.hidden = !url;
  adminCoverEmpty.hidden = Boolean(url);
  if (url) adminCoverPreview.src = url;
}

function renderAdminSpinFrames() {
  adminSpinList.innerHTML = currentSpinFrames.map((frame, index) => `
    <li>
      <img src="${escapeHtml(safeHttpUrl(frame.url))}" alt="">
      <span class="admin-spin-name">Frame ${index + 1}</span>
      <button class="admin-spin-action" type="button" data-frame-up="${index}" aria-label="Move frame ${index + 1} up" ${index === 0 ? 'disabled' : ''}>↑</button>
      <button class="admin-spin-action" type="button" data-frame-down="${index}" aria-label="Move frame ${index + 1} down" ${index === currentSpinFrames.length - 1 ? 'disabled' : ''}>↓</button>
      <button class="admin-spin-action" type="button" data-frame-remove="${index}" aria-label="Remove frame ${index + 1}">Remove</button>
    </li>
  `).join('');
}

function setAdminUploadPending(pending) {
  adminProductSelect.disabled = pending || isCreatingAdminProduct || adminProducts.length === 0;
  document.querySelector('#admin-add-product').disabled = pending;
  document.querySelector('#admin-delete-product').disabled =
    pending || isCreatingAdminProduct || !activeAdminProductId;
  document.querySelector('#admin-cover-input').disabled = pending;
  document.querySelector('#admin-spin-input').disabled = pending;
  document.querySelector('#admin-save').disabled = pending;
}

function selectAdminProduct(productId) {
  const product = adminProducts.find((item) => item.id === productId);
  if (!product) {
    activeAdminProductId = '';
    adminProductForm.reset();
    document.querySelector('#admin-stock').value = '0';
    document.querySelector('#admin-active').checked = true;
    currentGallery = [];
    currentSpinFrames = [];
    adminFormDirty = false;
    adminEditorStatus.textContent = 'No products are available yet. Add your first product above.';
    document.querySelector('#admin-delete-product').disabled = true;
    document.querySelector('#admin-save').textContent = 'Save product';
    updateAdminCover();
    renderAdminSpinFrames();
    return;
  }

  isCreatingAdminProduct = false;
  activeAdminProductId = product.id;
  document.querySelector('#admin-name').value = product.name;
  document.querySelector('#admin-description').value = product.description || '';
  document.querySelector('#admin-price').value = (product.pricePaise / 100).toFixed(2).replace(/\.00$/, '');
  document.querySelector('#admin-compare-at-price').value = product.compareAtPricePaise == null
    ? ''
    : (product.compareAtPricePaise / 100).toFixed(2).replace(/\.00$/, '');
  document.querySelector('#admin-stock').value = String(product.stock);
  document.querySelector('#admin-active').checked = product.active;
  currentGallery = imagesFor(product, 'GALLERY').map(({ url, publicId }) => ({ url, publicId }));
  currentSpinFrames = imagesFor(product, 'SPIN360').map(({ url, publicId }) => ({ url, publicId }));
  adminFormDirty = false;
  adminProductSelect.disabled = false;
  document.querySelector('#admin-delete-product').disabled = false;
  document.querySelector('#admin-save').textContent = 'Save product';
  adminEditorStatus.textContent = '';
  updateAdminCover();
  renderAdminSpinFrames();
}

function renderAdminProducts(selectedId) {
  adminProductSelect.innerHTML = adminProducts.map((product) => `
    <option value="${escapeHtml(product.id)}">${escapeHtml(product.name)}</option>
  `).join('');
  const nextId = adminProducts.some((product) => product.id === selectedId)
    ? selectedId
    : adminProducts[0]?.id;
  adminProductSelect.value = nextId || '';
  adminProductSelect.disabled = isCreatingAdminProduct || adminProducts.length === 0;
  selectAdminProduct(nextId);
}

function startCreatingAdminProduct() {
  if (adminFormDirty && !window.confirm('Discard unsaved product changes?')) return;
  isCreatingAdminProduct = true;
  activeAdminProductId = '';
  adminProductForm.reset();
  document.querySelector('#admin-stock').value = '0';
  document.querySelector('#admin-active').checked = true;
  document.querySelector('#admin-save').textContent = 'Create product';
  document.querySelector('#admin-delete-product').disabled = true;
  adminProductSelect.disabled = true;
  adminFormDirty = false;
  currentGallery = [];
  currentSpinFrames = [];
  adminEditorStatus.textContent = 'Add the product details, then create the product.';
  updateAdminCover();
  renderAdminSpinFrames();
}

async function loadAdminProducts() {
  const response = await apiRequest('/api/admin/products');
  if (!Array.isArray(response?.products)) {
    throw new Error('The admin product API returned an invalid product list.');
  }
  adminProducts = response.products;
  products = adminProducts.filter((product) => product.active);
  liveCatalogLoaded = true;
  catalogStatus.textContent = 'Live catalog · Prices in INR';
  heroNote.textContent = products.length === 0
    ? 'Our first collection is coming soon.'
    : 'Explore the QIVRA collection.';
  renderProducts();
  renderCart();
  renderAdminProducts(activeAdminProductId);
}

function renderAdminOrders(orders) {
  if (orders.length === 0) {
    adminOrdersList.innerHTML = '<p class="empty-cart">No orders yet.</p>';
    return;
  }

  adminOrdersList.innerHTML = orders.map((order) => {
    const address = order.addressSnapshot || {};
    const addressLines = [
      address.line1,
      address.line2,
      [address.city, address.state, address.pincode].filter(Boolean).join(', '),
    ].filter(Boolean);
    const itemSummary = order.items
      .map((item) => `${item.name} × ${item.quantity}`)
      .join(', ');
    const productSubtotal = order.items.reduce(
      (total, item) => total + item.unitPricePaise * item.quantity,
      0
    );
    const createdAt = new Date(order.createdAt).toLocaleString('en-IN');
    const totalSummary = order.status === 'PENDING_CONFIRMATION'
      ? `Products ${currency.format(productSubtotal / 100)} · Delivery charge and final total pending`
      : `Total ${currency.format(order.totalPaise / 100)} · Delivery ${currency.format(order.deliveryFeePaise / 100)}`;
    return `
      <article class="admin-order">
        <div class="admin-order-heading">
          <strong>Order ${escapeHtml(order.id)}</strong>
          <span>${escapeHtml(createdAt)}</span>
        </div>
        <p>${escapeHtml(itemSummary)}</p>
        <p>${escapeHtml(totalSummary)} · Cash on delivery · ${escapeHtml(order.status)}</p>
        <p>${escapeHtml(address.fullName)} · ${escapeHtml(address.phone)}</p>
        <p>${addressLines.map(escapeHtml).join('<br>')}</p>
        ${order.status === 'PENDING_CONFIRMATION' && order.paymentMethod === 'COD'
          ? `<form class="admin-form admin-order-confirm" data-confirm-order="${escapeHtml(order.id)}">
              <label>Delivery fee (₹)
                <input name="deliveryFee" type="number" min="0" max="10000" step="0.01" value="${(order.deliveryFeePaise / 100).toFixed(2)}" required>
              </label>
              <button class="button button-dark" type="submit">Confirm after phone call</button>
            </form>`
          : ''}
        ${['PENDING_CONFIRMATION', 'PROCESSING'].includes(order.status) && order.paymentStatus === 'CREATED' && order.paymentMethod === 'COD'
          ? `<button class="text-button admin-order-cancel" type="button" data-cancel-order="${escapeHtml(order.id)}">Cancel and restock</button>`
          : ''}
      </article>
    `;
  }).join('');
}

async function loadAdminOrders() {
  adminOrdersStatus.textContent = 'Loading orders…';
  const response = await apiRequest('/api/admin/orders');
  if (!Array.isArray(response?.orders)) {
    throw new Error('The orders API returned an invalid order list.');
  }
  renderAdminOrders(response.orders);
  adminOrdersStatus.textContent = `${response.orders.length} recent order${response.orders.length === 1 ? '' : 's'}.`;
}

async function showAdminEditor(user) {
  if (user.role !== 'ADMIN') {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    throw new Error('This account does not have admin access.');
  }

  adminLoginSection.hidden = true;
  adminEditorSection.hidden = false;
  document.querySelector('#admin-user').textContent = `Signed in as ${user.email}`;
  try {
    await loadAdminProducts();
  } catch (error) {
    adminEditorStatus.textContent = error.message;
  }
  try {
    await loadAdminOrders();
  } catch (error) {
    adminOrdersStatus.textContent = error.message;
  }
}

async function openAdmin() {
  adminDialog.showModal();
  adminLoginStatus.textContent = 'Checking your session…';
  adminLoginSection.hidden = false;
  adminEditorSection.hidden = true;
  try {
    const response = await apiRequest('/api/auth/me');
    await showAdminEditor(response.user);
  } catch (error) {
    if (adminEditorSection.hidden) {
      adminLoginStatus.textContent = error.message === 'Please sign in.' ? '' : error.message;
    } else {
      adminEditorStatus.textContent = error.message;
    }
  }
}

function showAccountView(view) {
  for (const section of document.querySelectorAll('[data-account-view]')) {
    section.hidden = section.dataset.accountView !== view;
  }
  const titles = {
    login: 'Welcome back',
    register: 'Create your account',
    forgot: 'Reset your password',
    reset: 'Choose a new password',
    profile: 'Your account',
  };
  document.querySelector('#account-title').textContent = titles[view];
}

function showAccountProfile(user) {
  document.querySelector('#open-account').textContent = 'My account';
  document.querySelector('#account-user').textContent = `Signed in as ${user.email}`;
  document.querySelector('#account-password-form').reset();
  accountPasswordStatus.textContent = '';
  showAccountView('profile');
}

async function openAccount() {
  accountDialog.showModal();
  if (resetToken) {
    accountResetStatus.textContent = '';
    showAccountView('reset');
    return;
  }
  if (accountMode === 'forgot') {
    accountMode = null;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
    accountForgotStatus.textContent = '';
    showAccountView('forgot');
    return;
  }

  showAccountView('login');
  accountLoginStatus.textContent = 'Checking your account…';
  try {
    const response = await apiRequest('/api/auth/me');
    showAccountProfile(response.user);
  } catch (error) {
    if (error.status === 401) {
      accountLoginStatus.textContent = '';
    } else {
      accountLoginStatus.textContent = error.message;
    }
    document.querySelector('#open-account').textContent = 'Sign in';
  }
}

document.querySelector('#open-account').addEventListener('click', openAccount);
document.querySelector('#close-account').addEventListener('click', () => accountDialog.close());
accountDialog.addEventListener('click', (event) => {
  if (event.target === accountDialog) accountDialog.close();
});
document.querySelectorAll('[data-account-show]').forEach((button) => {
  button.addEventListener('click', () => {
    showAccountView(button.dataset.accountShow);
    accountLoginStatus.textContent = '';
    accountRegisterStatus.textContent = '';
    accountForgotStatus.textContent = '';
  });
});

document.querySelector('#account-login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  accountLoginStatus.textContent = 'Signing in…';
  try {
    const response = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: form.elements.email.value,
        password: form.elements.password.value,
      }),
    });
    form.reset();
    showAccountProfile(response.user);
  } catch (error) {
    accountLoginStatus.textContent = error.message;
  }
});

document.querySelector('#account-register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  accountRegisterStatus.textContent = 'Creating your account…';
  try {
    const response = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: form.elements.name.value,
        email: form.elements.email.value,
        password: form.elements.password.value,
      }),
    });
    form.reset();
    showAccountProfile(response.user);
  } catch (error) {
    accountRegisterStatus.textContent = error.message;
  }
});

document.querySelector('#account-forgot-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  accountForgotStatus.textContent = 'Requesting a reset link…';
  try {
    const response = await apiRequest('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: form.elements.email.value }),
    });
    accountForgotStatus.textContent = response.message;
  } catch (error) {
    accountForgotStatus.textContent = error.message;
  }
});

document.querySelector('#account-reset-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!resetToken) {
    accountResetStatus.textContent = 'This password reset link is invalid or has expired.';
    return;
  }
  accountResetStatus.textContent = 'Resetting your password…';
  try {
    const response = await apiRequest('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: resetToken, password: form.elements.password.value }),
    });
    resetToken = null;
    form.reset();
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
    showAccountView('login');
    accountLoginStatus.textContent = response.message;
  } catch (error) {
    accountResetStatus.textContent = error.message;
  }
});

document.querySelector('#account-password-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  accountPasswordStatus.textContent = 'Updating your password…';
  try {
    const response = await apiRequest('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: form.elements.currentPassword.value,
        newPassword: form.elements.newPassword.value,
      }),
    });
    showAccountProfile(response.user);
    accountPasswordStatus.textContent = 'Your password has been updated.';
  } catch (error) {
    accountPasswordStatus.textContent = error.message;
  }
});

document.querySelector('#account-logout').addEventListener('click', async () => {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    document.querySelector('#open-account').textContent = 'Sign in';
    showAccountView('login');
    accountLoginStatus.textContent = 'You have signed out.';
  } catch (error) {
    accountPasswordStatus.textContent = error.message;
  }
});

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(new Error(`Could not read ${file.name}.`)));
    reader.readAsDataURL(file);
  });
}

async function uploadImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error(`${file.name} is larger than 5 MB.`);
  }

  const dataUrl = await readFileAsDataUrl(file);
  const response = await apiRequest('/api/admin/media', {
    method: 'POST',
    body: JSON.stringify({ dataUrl, fileName: file.name }),
  });
  return response.image;
}

function parsePricePaise(value) {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Enter a valid price with no more than two decimal places.');
  }
  const [rupees, paise = ''] = normalized.split('.');
  const pricePaise = Number(rupees) * 100 + Number(paise.padEnd(2, '0'));
  if (!Number.isSafeInteger(pricePaise) || pricePaise > 100000000) {
    throw new Error('Enter a price of ₹1,000,000 or less.');
  }
  return pricePaise;
}

function parseOptionalPricePaise(value) {
  return value.trim() === '' ? null : parsePricePaise(value);
}

productGrid.addEventListener('click', (event) => {
  const viewerButton = event.target.closest('[data-view360]');
  if (viewerButton) {
    openViewer(viewerButton.dataset.view360);
    return;
  }

  const button = event.target.closest('[data-add]');
  if (!button || button.disabled) return;

  const id = button.dataset.add;
  const product = products.find((item) => item.id === id);
  if (!product) return;
  const quantity = cart.get(id) || 0;
  if (quantity >= Math.min(10, product.stock)) {
    button.textContent = 'Stock limit reached';
    window.setTimeout(() => {
      if (button.isConnected) button.textContent = 'Add to bag';
    }, 900);
    return;
  }
  cart.set(id, quantity + 1);
  renderCart();
  button.textContent = 'Added to bag';
  window.setTimeout(() => {
    if (button.isConnected) button.textContent = 'Add to bag';
  }, 900);
});

cartItems.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove]');
  if (!button) return;
  cart.delete(button.dataset.remove);
  renderCart();
});

document.querySelector('#open-cart').addEventListener('click', () => cartDialog.showModal());
document.querySelector('#close-cart').addEventListener('click', () => cartDialog.close());
document.querySelector('#checkout-button').addEventListener('click', () => {
  if (!liveCatalogLoaded) {
    checkoutNote.textContent = 'Checkout is unavailable while the live catalog cannot be reached.';
    return;
  }
  if (cart.size === 0) {
    checkoutNote.textContent = 'Add a product to your bag before checking out.';
    return;
  }
  checkoutForm.reset();
  checkoutForm.hidden = false;
  checkoutConfirmation.hidden = true;
  checkoutStatus.textContent = '';
  renderCheckoutSummary();
  cartDialog.close();
  checkoutDialog.showModal();
});
document.querySelector('#close-checkout').addEventListener('click', () => checkoutDialog.close());
checkoutForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  placeOrderButton.disabled = true;
  checkoutStatus.textContent = 'Placing your order…';
  try {
    const response = await apiRequest('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        items: [...cart.entries()].map(([productId, quantity]) => ({ productId, quantity })),
        address: {
          fullName: document.querySelector('#checkout-name').value,
          phone: document.querySelector('#checkout-phone').value,
          line1: document.querySelector('#checkout-line1').value,
          line2: document.querySelector('#checkout-line2').value,
          city: document.querySelector('#checkout-city').value,
          state: document.querySelector('#checkout-state').value,
          pincode: document.querySelector('#checkout-pincode').value,
        },
      }),
    });
    if (!response?.order?.id) {
      throw new Error('The order was not confirmed. Please try again.');
    }

    cart.clear();
    renderCart();
    checkoutForm.hidden = true;
    checkoutConfirmation.hidden = false;
    checkoutConfirmationText.textContent = `Order request ${response.order.id} received. We’ll call you to confirm the delivery charge and final total before accepting it.`;
    checkoutStatus.textContent = '';
  } catch (error) {
    checkoutStatus.textContent = error.message;
  } finally {
    placeOrderButton.disabled = false;
  }
});
cartDialog.addEventListener('click', (event) => {
  if (event.target === cartDialog) cartDialog.close();
});
checkoutDialog.addEventListener('click', (event) => {
  if (event.target === checkoutDialog) checkoutDialog.close();
});

document.querySelector('#close-admin').addEventListener('click', () => {
  if (isAdminRoute) {
    window.location.assign('/');
  } else {
    adminDialog.close();
  }
});
adminDialog.addEventListener('click', (event) => {
  if (event.target === adminDialog && !isAdminRoute) adminDialog.close();
});

document.querySelector('#admin-login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  adminLoginStatus.textContent = 'Signing in…';
  const form = event.currentTarget;
  try {
    const response = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.querySelector('#admin-email').value,
        password: document.querySelector('#admin-password').value,
      }),
    });
    await showAdminEditor(response.user);
    document.querySelector('#admin-password').value = '';
  } catch (error) {
    adminLoginStatus.textContent = error.message;
    adminEditorSection.hidden = true;
    adminLoginSection.hidden = false;
  }
});

document.querySelector('#admin-forgot-user-id').addEventListener('click', async () => {
  const status = document.querySelector('#admin-forgot-user-id-status');
  status.textContent = 'Requesting a user ID reminder…';
  try {
    const response = await apiRequest('/api/auth/forgot-user-id', { method: 'POST' });
    status.textContent = response.message;
  } catch (error) {
    status.textContent = error.message;
  }
});

document.querySelector('#admin-logout').addEventListener('click', async () => {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    adminEditorSection.hidden = true;
    adminLoginSection.hidden = false;
    adminLoginStatus.textContent = 'You have signed out.';
    adminProductForm.reset();
  } catch (error) {
    adminEditorStatus.textContent = error.message;
  }
});

document.querySelector('#admin-password-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.querySelector('#admin-password-status');
  status.textContent = 'Updating your password…';
  try {
    await apiRequest('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: form.elements.currentPassword.value,
        newPassword: form.elements.newPassword.value,
      }),
    });
    form.reset();
    status.textContent = 'Your password has been updated.';
  } catch (error) {
    status.textContent = error.message;
  }
});

document.querySelector('#refresh-orders').addEventListener('click', async () => {
  try {
    await loadAdminOrders();
  } catch (error) {
    adminOrdersStatus.textContent = error.message;
  }
});

adminOrdersList.addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-confirm-order]');
  if (!form) return;
  event.preventDefault();

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  adminOrdersStatus.textContent = 'Saving delivery charge…';
  try {
    const deliveryFeePaise = parsePricePaise(form.querySelector('[name="deliveryFee"]').value);
    if (deliveryFeePaise > 1_000_000) {
      throw new Error('Delivery fee must be ₹10,000 or less.');
    }
    await apiRequest(`/api/admin/orders/${encodeURIComponent(form.dataset.confirmOrder)}/confirm`, {
      method: 'PATCH',
      body: JSON.stringify({ deliveryFeePaise }),
    });
    await loadAdminOrders();
    adminEditorStatus.textContent = 'Delivery charge saved and order accepted.';
  } catch (error) {
    adminOrdersStatus.textContent = error.message;
    button.disabled = false;
  }
});

adminOrdersList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-cancel-order]');
  if (!button || !window.confirm('Cancel this COD order and return its items to stock?')) return;

  button.disabled = true;
  adminOrdersStatus.textContent = 'Cancelling order…';
  try {
    await apiRequest(`/api/admin/orders/${encodeURIComponent(button.dataset.cancelOrder)}/cancel`, {
      method: 'PATCH',
    });
    await loadAdminOrders();
    if (!adminFormDirty) await loadAdminProducts();
    adminEditorStatus.textContent = 'Order cancelled and stock restored.';
  } catch (error) {
    adminOrdersStatus.textContent = error.message;
    button.disabled = false;
  }
});

adminProductSelect.addEventListener('change', () => {
  const previousId = activeAdminProductId;
  if (adminFormDirty && !window.confirm('Discard unsaved product changes?')) {
    adminProductSelect.value = previousId;
    return;
  }
  selectAdminProduct(adminProductSelect.value);
});

document.querySelector('#admin-add-product').addEventListener('click', startCreatingAdminProduct);

document.querySelector('#admin-delete-product').addEventListener('click', async () => {
  const product = adminProducts.find((item) => item.id === activeAdminProductId);
  if (!product || !window.confirm(`Remove "${product.name}" from the storefront? Products with order history will be archived.`)) {
    return;
  }

  const button = document.querySelector('#admin-delete-product');
  button.disabled = true;
  adminEditorStatus.textContent = 'Removing product…';
  try {
    const result = await apiRequest(`/api/admin/products/${encodeURIComponent(product.id)}`, {
      method: 'DELETE',
    });
    isCreatingAdminProduct = false;
    await loadAdminProducts();
    adminEditorStatus.textContent = result.archived
      ? 'Product removed from the storefront. Its order history has been preserved.'
      : 'Product removed.';
  } catch (error) {
    adminEditorStatus.textContent = error.message;
    button.disabled = false;
  }
});

adminProductForm.addEventListener('input', () => {
  adminFormDirty = true;
});

document.querySelector('#admin-cover-input').addEventListener('change', async (event) => {
  const input = event.currentTarget;
  const [file] = input.files;
  if (!file) return;
  adminFormDirty = true;
  setAdminUploadPending(true);
  adminEditorStatus.textContent = 'Uploading main image…';
  try {
    const image = await uploadImage(file);
    currentGallery = [{ url: image.url, publicId: image.publicId }, ...currentGallery.slice(1)];
    updateAdminCover();
    adminEditorStatus.textContent = 'Main image uploaded. Save the product to publish it.';
  } catch (error) {
    adminEditorStatus.textContent = error.message;
  } finally {
    input.value = '';
    setAdminUploadPending(false);
  }
});

document.querySelector('#admin-spin-input').addEventListener('change', async (event) => {
  const input = event.currentTarget;
  const files = Array.from(input.files).sort((first, second) =>
    first.name.localeCompare(second.name, undefined, { numeric: true, sensitivity: 'base' })
  );
  if (currentSpinFrames.length + files.length > 72) {
    adminEditorStatus.textContent = 'A product can have up to 72 360° frames.';
    input.value = '';
    return;
  }

  adminFormDirty = files.length > 0;
  setAdminUploadPending(files.length > 0);
  try {
    for (let index = 0; index < files.length; index += 1) {
      adminEditorStatus.textContent = `Uploading 360° frame ${index + 1} of ${files.length}…`;
      const image = await uploadImage(files[index]);
      currentSpinFrames.push({ url: image.url, publicId: image.publicId });
      renderAdminSpinFrames();
    }
    if (files.length > 0) {
      adminEditorStatus.textContent = 'Frames uploaded in filename order. Save the product to publish them.';
    }
  } catch (error) {
    adminEditorStatus.textContent = error.message;
  } finally {
    input.value = '';
    setAdminUploadPending(false);
  }
});

adminSpinList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-frame-up], [data-frame-down], [data-frame-remove]');
  if (!button) return;
  const index = Number(
    button.dataset.frameUp ?? button.dataset.frameDown ?? button.dataset.frameRemove
  );

  if (button.hasAttribute('data-frame-remove')) {
    currentSpinFrames.splice(index, 1);
  } else {
    const nextIndex = button.hasAttribute('data-frame-up') ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= currentSpinFrames.length) return;
    [currentSpinFrames[index], currentSpinFrames[nextIndex]] = [
      currentSpinFrames[nextIndex],
      currentSpinFrames[index],
    ];
  }
  adminFormDirty = true;
  renderAdminSpinFrames();
});

adminProductForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const saveButton = document.querySelector('#admin-save');
  saveButton.disabled = true;
  adminEditorStatus.textContent = 'Saving product…';
  try {
    const changes = {
      name: document.querySelector('#admin-name').value.trim(),
      description: document.querySelector('#admin-description').value,
      pricePaise: parsePricePaise(document.querySelector('#admin-price').value),
      compareAtPricePaise: parseOptionalPricePaise(document.querySelector('#admin-compare-at-price').value),
      stock: Number(document.querySelector('#admin-stock').value),
      active: document.querySelector('#admin-active').checked,
      gallery: currentGallery,
      spin360: currentSpinFrames,
    };
    if (changes.compareAtPricePaise !== null && changes.compareAtPricePaise <= changes.pricePaise) {
      throw new Error('The original price must be greater than the current price.');
    }
    const response = await apiRequest(
      isCreatingAdminProduct
        ? '/api/admin/products'
        : `/api/admin/products/${encodeURIComponent(activeAdminProductId)}`,
      {
        method: isCreatingAdminProduct ? 'POST' : 'PATCH',
        body: JSON.stringify(changes),
      }
    );
    isCreatingAdminProduct = false;
    adminProducts = adminProducts.some((product) => product.id === response.product.id)
      ? adminProducts.map((product) => product.id === response.product.id ? response.product : product)
      : [...adminProducts, response.product];
    products = adminProducts.filter((product) => product.active);
    renderProducts();
    renderCart();
    renderAdminProducts(response.product.id);
    adminEditorStatus.textContent = 'Product saved.';
  } catch (error) {
    adminEditorStatus.textContent = error.message;
  } finally {
    saveButton.disabled = false;
  }
});

document.querySelector('#viewer-previous').addEventListener('click', () => moveViewer(-1));
document.querySelector('#viewer-next').addEventListener('click', () => moveViewer(1));
document.querySelector('#close-viewer').addEventListener('click', () => viewerDialog.close());
viewerDialog.addEventListener('click', (event) => {
  if (event.target === viewerDialog) viewerDialog.close();
});
viewerStage.addEventListener('pointerdown', (event) => {
  if (viewerFrames.length === 0) return;
  dragPosition = event.clientX;
  viewerStage.setPointerCapture(event.pointerId);
});
viewerStage.addEventListener('pointermove', (event) => {
  if (dragPosition === null) return;
  const distance = event.clientX - dragPosition;
  const framesToMove = Math.trunc(distance / 8);
  if (framesToMove !== 0) {
    moveViewer(-framesToMove);
    dragPosition = event.clientX;
  }
});
viewerStage.addEventListener('pointerup', () => {
  dragPosition = null;
});
viewerStage.addEventListener('pointercancel', () => {
  dragPosition = null;
});
viewerStage.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') moveViewer(-1);
  if (event.key === 'ArrowRight') moveViewer(1);
});

document.querySelector('#current-year').textContent = String(new Date().getFullYear());
renderProducts();
renderCart();
if (isAdminRoute) {
  openAdmin();
} else {
  if (resetToken || accountMode === 'forgot') openAccount();
  loadProducts();
}
