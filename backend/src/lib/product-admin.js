import { z } from 'zod';

export const imageSchema = z.object({
  url: z.string().url().max(2048).refine((value) => {
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }),
  publicId: z.string().max(255).optional().nullable(),
});

const productName = z.string().trim().min(1).max(120);
const productDescription = z.string().max(2000);
const productPrice = z.number().int().min(0).max(100000000);
const productStock = z.number().int().min(0).max(1000000);

export const createProductSchema = z.object({
  name: productName,
  description: productDescription.default(''),
  pricePaise: productPrice,
  compareAtPricePaise: productPrice.nullable().optional(),
  stock: productStock.default(0),
  active: z.boolean().default(true),
  gallery: z.array(imageSchema).max(20).default([]),
  spin360: z.array(imageSchema).max(72).default([]),
}).strict();

export const updateProductSchema = z.object({
  name: productName.optional(),
  description: productDescription.optional(),
  pricePaise: productPrice.optional(),
  compareAtPricePaise: productPrice.nullable().optional(),
  stock: productStock.optional(),
  active: z.boolean().optional(),
  gallery: z.array(imageSchema).max(20).optional(),
  spin360: z.array(imageSchema).max(72).optional(),
}).strict();

export function hasValidCompareAtPrice(pricePaise, compareAtPricePaise) {
  return compareAtPricePaise == null || compareAtPricePaise > pricePaise;
}

export function slugifyProductName(name) {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'product';
}
