import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderSchema, priceOrder } from '../src/lib/orders.js';

const validOrder = {
  items: [{ productId: 'product-1', quantity: 2 }],
  address: {
    fullName: 'A Customer',
    phone: '+91 98765 43210',
    line1: '12 Example Street',
    line2: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
  },
};

test('accepts a COD order with a complete Indian delivery address', () => {
  assert.equal(createOrderSchema.safeParse(validOrder).success, true);
});

test('rejects duplicate products and invalid postal codes', () => {
  const duplicateItems = {
    ...validOrder,
    items: [...validOrder.items, ...validOrder.items],
  };
  const invalidPincode = {
    ...validOrder,
    address: { ...validOrder.address, pincode: '56001' },
  };

  assert.equal(createOrderSchema.safeParse(duplicateItems).success, false);
  assert.equal(createOrderSchema.safeParse(invalidPincode).success, false);
});

test('prices an order from database product prices and rejects unavailable stock', () => {
  const product = {
    id: 'product-1',
    name: 'Everyday item',
    pricePaise: 49900,
    stock: 3,
    active: true,
  };

  assert.deepEqual(priceOrder(validOrder.items, [product]), {
    lines: [{
      productId: product.id,
      name: product.name,
      unitPricePaise: product.pricePaise,
      quantity: 2,
    }],
    totalPaise: 99800,
  });
  assert.throws(() => priceOrder([{ productId: product.id, quantity: 4 }], [product]), { status: 409 });
});
