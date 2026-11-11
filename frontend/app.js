const products = [
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

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const cart = new Map();
const productGrid = document.querySelector('#product-grid');
const cartCount = document.querySelector('#cart-count');
const cartDialog = document.querySelector('#cart-dialog');
const cartItems = document.querySelector('#cart-items');
const cartSubtotal = document.querySelector('#cart-subtotal');
const checkoutNote = document.querySelector('#checkout-note');

function renderProducts() {
  productGrid.innerHTML = products.map((product, index) => `
    <article class="product-card">
      <div class="product-art product-art-${product.art}" aria-hidden="true">
        <span class="product-number">NO. 0${index + 1}</span>
        <div class="product-shape"></div>
      </div>
      <div class="product-info">
        <div>
          <h3>${product.name}</h3>
          <p>${product.description}</p>
        </div>
        <span class="product-price">${currency.format(product.pricePaise / 100)}</span>
      </div>
      <button class="add-button" type="button" data-add="${product.id}">Add to bag</button>
    </article>
  `).join('');
}

function renderCart() {
  const entries = [...cart.entries()];
  const quantity = entries.reduce((total, [, count]) => total + count, 0);
  const subtotal = entries.reduce((total, [id, count]) => {
    const product = products.find((item) => item.id === id);
    return total + product.pricePaise * count;
  }, 0);

  cartCount.textContent = String(quantity);
  cartSubtotal.textContent = currency.format(subtotal / 100);

  if (entries.length === 0) {
    cartItems.innerHTML = '<p class="empty-cart">Your bag is empty. Find something you like in the collection.</p>';
    return;
  }

  cartItems.innerHTML = entries.map(([id, count]) => {
    const product = products.find((item) => item.id === id);
    return `
      <div class="cart-item">
        <div class="cart-item-swatch product-art-${product.art}" aria-hidden="true"></div>
        <div>
          <p class="cart-item-name">${product.name}</p>
          <p class="cart-item-meta">${currency.format(product.pricePaise / 100)} · Qty ${count}</p>
        </div>
        <button class="remove-button" type="button" data-remove="${id}" aria-label="Remove ${product.name} from bag">Remove</button>
      </div>
    `;
  }).join('');
}

productGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-add]');
  if (!button) return;

  const id = button.dataset.add;
  cart.set(id, (cart.get(id) || 0) + 1);
  renderCart();
  button.textContent = 'Added to bag';
  window.setTimeout(() => {
    button.textContent = 'Add to bag';
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

document.querySelector('#current-year').textContent = String(new Date().getFullYear());
renderProducts();
renderCart();
