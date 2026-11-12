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
let viewerFrames = [];
let viewerFrameIndex = 0;
let dragPosition = null;

const productGrid = document.querySelector('#product-grid');
const catalogStatus = document.querySelector('#catalog-status');
const cartCount = document.querySelector('#cart-count');
const cartDialog = document.querySelector('#cart-dialog');
const cartItems = document.querySelector('#cart-items');
const cartSubtotal = document.querySelector('#cart-subtotal');
const checkoutNote = document.querySelector('#checkout-note');
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
const adminSpinList = document.querySelector('#admin-spin-list');
const adminCoverPreview = document.querySelector('#admin-cover-preview');
const adminCoverEmpty = document.querySelector('#admin-cover-empty');

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
    throw new Error(data?.error || `The request failed (${response.status}).`);
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
    return `
      <article class="product-card">
        <div class="product-art ${productArtClass(product, index)}${coverUrl ? ' has-image' : ''}">
          ${coverUrl
            ? `<img class="product-photo" src="${escapeHtml(coverUrl)}" alt="${escapeHtml(product.name)}" loading="lazy">`
            : `<span class="product-number">NO. 0${index + 1}</span><div class="product-shape" aria-hidden="true"></div>`}
          ${frames.length >= 2
            ? `<button class="spin-button" type="button" data-view360="${escapeHtml(product.id)}">360° view</button>`
            : ''}
        </div>
        <div class="product-info">
          <div>
            <h3>${escapeHtml(product.name)}</h3>
            <p>${escapeHtml(product.description)}</p>
          </div>
          <span class="product-price">${currency.format((product.pricePaise || 0) / 100)}</span>
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

async function loadProducts() {
  try {
    const response = await apiRequest('/api/products');
    if (!Array.isArray(response?.products)) {
      throw new Error('The product API returned an invalid catalog.');
    }
    products = response.products;
    catalogStatus.textContent = 'Live catalog · Prices in INR';
  } catch (error) {
    products = [...sampleProducts];
    catalogStatus.textContent = 'Preview catalog — API unavailable; admin changes are not saved.';
    catalogStatus.title = error.message;
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
  adminProductSelect.disabled = pending;
  document.querySelector('#admin-cover-input').disabled = pending;
  document.querySelector('#admin-spin-input').disabled = pending;
  document.querySelector('#admin-save').disabled = pending;
}

function selectAdminProduct(productId) {
  const product = adminProducts.find((item) => item.id === productId);
  if (!product) {
    adminEditorStatus.textContent = 'No products are available to edit.';
    return;
  }

  activeAdminProductId = product.id;
  document.querySelector('#admin-name').value = product.name;
  document.querySelector('#admin-description').value = product.description || '';
  document.querySelector('#admin-price').value = (product.pricePaise / 100).toFixed(2).replace(/\.00$/, '');
  document.querySelector('#admin-stock').value = String(product.stock);
  document.querySelector('#admin-active').checked = product.active;
  currentGallery = imagesFor(product, 'GALLERY').map(({ url, publicId }) => ({ url, publicId }));
  currentSpinFrames = imagesFor(product, 'SPIN360').map(({ url, publicId }) => ({ url, publicId }));
  adminFormDirty = false;
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
  selectAdminProduct(nextId);
}

async function loadAdminProducts() {
  const response = await apiRequest('/api/admin/products');
  if (!Array.isArray(response?.products)) {
    throw new Error('The admin product API returned an invalid product list.');
  }
  adminProducts = response.products;
  products = adminProducts.filter((product) => product.active);
  catalogStatus.textContent = 'Live catalog · Prices in INR';
  renderProducts();
  renderCart();
  renderAdminProducts(activeAdminProductId);
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

productGrid.addEventListener('click', (event) => {
  const viewerButton = event.target.closest('[data-view360]');
  if (viewerButton) {
    openViewer(viewerButton.dataset.view360);
    return;
  }

  const button = event.target.closest('[data-add]');
  if (!button || button.disabled) return;

  const id = button.dataset.add;
  cart.set(id, (cart.get(id) || 0) + 1);
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
  checkoutNote.textContent = 'Checkout is not connected yet. This preview does not accept orders.';
});
cartDialog.addEventListener('click', (event) => {
  if (event.target === cartDialog) cartDialog.close();
});

document.querySelector('#open-admin').addEventListener('click', openAdmin);
document.querySelector('#close-admin').addEventListener('click', () => adminDialog.close());
adminDialog.addEventListener('click', (event) => {
  if (event.target === adminDialog) adminDialog.close();
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

adminProductSelect.addEventListener('change', () => {
  const previousId = activeAdminProductId;
  if (adminFormDirty && !window.confirm('Discard unsaved product changes?')) {
    adminProductSelect.value = previousId;
    return;
  }
  selectAdminProduct(adminProductSelect.value);
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
      stock: Number(document.querySelector('#admin-stock').value),
      active: document.querySelector('#admin-active').checked,
      gallery: currentGallery,
      spin360: currentSpinFrames,
    };
    const response = await apiRequest(`/api/admin/products/${encodeURIComponent(activeAdminProductId)}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    });
    adminProducts = adminProducts.map((product) =>
      product.id === response.product.id ? response.product : product
    );
    products = adminProducts.filter((product) => product.active);
    renderProducts();
    renderCart();
    renderAdminProducts(response.product.id);
    adminEditorStatus.textContent = 'Product saved and published.';
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
loadProducts();
