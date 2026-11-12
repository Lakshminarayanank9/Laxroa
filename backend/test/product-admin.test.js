import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProductSchema,
  hasValidCompareAtPrice,
  slugifyProductName,
  updateProductSchema,
} from '../src/lib/product-admin.js';

test('accepts a product with an original price above its current price', () => {
  const parsed = createProductSchema.safeParse({
    name: 'QIVRA Everyday Set',
    pricePaise: 79900,
    compareAtPricePaise: 99900,
    stock: 4,
  });

  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.data.gallery, []);
  assert.equal(parsed.data.active, true);
});

test('discount prices must be greater than the current price', () => {
  assert.equal(hasValidCompareAtPrice(79900, 79900), false);
  assert.equal(hasValidCompareAtPrice(79900, 70000), false);
  assert.equal(hasValidCompareAtPrice(79900, null), true);
  assert.equal(updateProductSchema.safeParse({ compareAtPricePaise: -1 }).success, false);
});

test('product slugs are normalized and never empty', () => {
  assert.equal(slugifyProductName('  QIVRA & Everyday Set  '), 'qivra-everyday-set');
  assert.equal(slugifyProductName('新品'), 'product');
});
