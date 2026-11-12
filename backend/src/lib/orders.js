import { z } from 'zod';

const itemSchema = z.object({
  productId: z.string().trim().min(1).max(64),
  quantity: z.number().int().min(1).max(10),
}).strict();

export const createOrderSchema = z.object({
  items: z.array(itemSchema).min(1).max(20).superRefine((items, context) => {
    const productIds = items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Each product may only appear once in the order.',
      });
    }
  }),
  address: z.object({
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().regex(/^\+?[0-9][0-9 ()-]{6,14}$/),
    line1: z.string().trim().min(5).max(200),
    line2: z.string().trim().max(200).optional().default(''),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().min(2).max(100),
    pincode: z.string().trim().regex(/^\d{6}$/),
  }).strict(),
}).strict();

function conflict(message) {
  const error = new Error(message);
  error.status = 409;
  return error;
}

export function priceOrder(items, products) {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const lines = items.map(({ productId, quantity }) => {
    const product = productsById.get(productId);
    if (!product || !product.active) {
      throw conflict('One or more products are no longer available.');
    }
    if (product.stock < quantity) {
      throw conflict(`${product.name} does not have enough stock.`);
    }
    return {
      productId: product.id,
      name: product.name,
      unitPricePaise: product.pricePaise,
      quantity,
    };
  });
  const totalPaise = lines.reduce(
    (total, line) => total + line.unitPricePaise * line.quantity,
    0
  );
  if (!Number.isSafeInteger(totalPaise) || totalPaise > 2_147_483_647) {
    const error = new Error('The order total is too large.');
    error.status = 400;
    throw error;
  }
  return { lines, totalPaise };
}
