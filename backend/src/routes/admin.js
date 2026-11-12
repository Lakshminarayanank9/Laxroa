import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAdmin, requireUser } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { uploadProductImage } from '../lib/cloudinary.js';
import {
  createProductSchema,
  hasValidCompareAtPrice,
  slugifyProductName,
  updateProductSchema,
} from '../lib/product-admin.js';

const router = Router();
const maxImageBytes = 5 * 1024 * 1024;
const uploadSchema = z.object({
  dataUrl: z.string().max(7_500_000),
  fileName: z.string().trim().min(1).max(120),
});
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function includeProductImages() {
  return {
    images: {
      orderBy: [{ kind: 'asc' }, { position: 'asc' }],
      select: { id: true, url: true, publicId: true, kind: true, position: true },
    },
  };
}

router.use(requireUser, requireAdmin);

router.get('/products', async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'asc' },
      include: includeProductImages(),
    });
    res.json({ products });
  } catch (error) {
    next(error);
  }
});

router.post('/products', async (req, res, next) => {
  try {
    const changes = createProductSchema.parse(req.body);
    if (!hasValidCompareAtPrice(changes.pricePaise, changes.compareAtPricePaise)) {
      return res.status(400).json({ error: 'The original price must be greater than the current price.' });
    }

    const product = await prisma.$transaction(async (transaction) => {
      const { gallery, spin360, ...productChanges } = changes;
      const baseSlug = slugifyProductName(changes.name);
      let slug = baseSlug;
      let suffix = 1;
      while (await transaction.product.findUnique({ where: { slug }, select: { id: true } })) {
        suffix += 1;
        slug = `${baseSlug}-${suffix}`;
      }

      const images = [
        ...gallery.map((image, position) => ({
          ...image,
          kind: 'GALLERY',
          position,
        })),
        ...spin360.map((image, position) => ({
          ...image,
          kind: 'SPIN360',
          position,
        })),
      ];
      return transaction.product.create({
        data: {
          ...productChanges,
          slug,
          images: { create: images },
        },
        include: includeProductImages(),
      });
    });

    return res.status(201).json({ product });
  } catch (error) {
    return next(error);
  }
});

router.delete('/products/:id', async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const existingProduct = await transaction.product.findUnique({
        where: { id: req.params.id },
        select: { id: true },
      });
      if (!existingProduct) {
        const error = new Error('Product not found.');
        error.status = 404;
        throw error;
      }

      const orderCount = await transaction.orderItem.count({
        where: { productId: req.params.id },
      });
      if (orderCount > 0) {
        await transaction.product.update({
          where: { id: req.params.id },
          data: { active: false },
        });
        return { archived: true };
      }

      await transaction.product.delete({ where: { id: req.params.id } });
      return { archived: false };
    });

    return res.json({ productId: req.params.id, ...result });
  } catch (error) {
    if (error.code === 'P2003') {
      error.status = 409;
      error.message = 'This product has order history and can only be removed from the storefront.';
    }
    return next(error);
  }
});

router.get('/orders', async (_req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        addressSnapshot: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        deliveryFeePaise: true,
        totalPaise: true,
        createdAt: true,
        items: {
          select: {
            name: true,
            unitPricePaise: true,
            quantity: true,
          },
        },
      },
    });
    res.json({ orders });
  } catch (error) {
    next(error);
  }
});

const confirmOrderSchema = z.object({
  deliveryFeePaise: z.number().int().min(0).max(1_000_000),
}).strict();

router.patch('/orders/:id/confirm', async (req, res, next) => {
  try {
    const { deliveryFeePaise } = confirmOrderSchema.parse(req.body);
    const order = await prisma.$transaction(async (transaction) => {
      const existingOrder = await transaction.order.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          status: true,
          paymentMethod: true,
          items: {
            select: { unitPricePaise: true, quantity: true },
          },
        },
      });
      if (!existingOrder) {
        const error = new Error('Order not found.');
        error.status = 404;
        throw error;
      }
      if (existingOrder.status !== 'PENDING_CONFIRMATION' || existingOrder.paymentMethod !== 'COD') {
        const error = new Error('This order is not awaiting delivery confirmation.');
        error.status = 409;
        throw error;
      }

      const subtotalPaise = existingOrder.items.reduce(
        (total, item) => total + item.unitPricePaise * item.quantity,
        0
      );
      const totalPaise = subtotalPaise + deliveryFeePaise;
      if (!Number.isSafeInteger(totalPaise) || totalPaise > 2_147_483_647) {
        const error = new Error('The confirmed order total is too large.');
        error.status = 400;
        throw error;
      }

      const confirmation = await transaction.order.updateMany({
        where: {
          id: req.params.id,
          status: 'PENDING_CONFIRMATION',
          paymentMethod: 'COD',
        },
        data: {
          deliveryFeePaise,
          totalPaise,
          status: 'PROCESSING',
        },
      });
      if (confirmation.count !== 1) {
        const error = new Error('The order changed while it was being confirmed. Refresh and try again.');
        error.status = 409;
        throw error;
      }

      return transaction.order.findUnique({
        where: { id: req.params.id },
        select: { id: true, status: true, deliveryFeePaise: true, totalPaise: true },
      });
    });

    return res.json({ order });
  } catch (error) {
    return next(error);
  }
});

router.patch('/orders/:id/cancel', async (req, res, next) => {
  try {
    const order = await prisma.$transaction(async (transaction) => {
      const cancellation = await transaction.order.updateMany({
        where: {
          id: req.params.id,
          status: { in: ['PENDING_CONFIRMATION', 'PROCESSING'] },
          paymentStatus: 'CREATED',
          paymentMethod: 'COD',
        },
        data: { status: 'CANCELLED' },
      });

      if (cancellation.count === 0) {
        const existingOrder = await transaction.order.findUnique({
          where: { id: req.params.id },
          select: { id: true, status: true },
        });
        if (!existingOrder) {
          const error = new Error('Order not found.');
          error.status = 404;
          throw error;
        }
        if (existingOrder.status === 'CANCELLED') return existingOrder;
        const error = new Error('This order can no longer be cancelled.');
        error.status = 409;
        throw error;
      }

      const items = await transaction.orderItem.findMany({
        where: { orderId: req.params.id },
        select: { productId: true, quantity: true },
      });
      for (const item of items) {
        await transaction.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
      return transaction.order.findUnique({
        where: { id: req.params.id },
        select: { id: true, status: true },
      });
    });

    return res.json({ order });
  } catch (error) {
    return next(error);
  }
});

router.post('/media', async (req, res, next) => {
  try {
    if (!env.cloudinaryReady) {
      return res.status(503).json({ error: 'Image uploads are not configured. Add the Cloudinary environment variables first.' });
    }

    const { dataUrl, fileName } = uploadSchema.parse(req.body);
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
    if (!match || !allowedImageTypes.has(match[1])) {
      return res.status(400).json({ error: 'Choose a JPEG, PNG, or WebP image.' });
    }

    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0 || buffer.length > maxImageBytes) {
      return res.status(400).json({ error: 'Images must be smaller than 5 MB.' });
    }

    const image = await uploadProductImage(buffer, match[1], fileName);
    return res.status(201).json({ image });
  } catch (error) {
    return next(error);
  }
});

router.patch('/products/:id', async (req, res, next) => {
  try {
    const changes = updateProductSchema.parse(req.body);
    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ error: 'Provide at least one product field to update.' });
    }

    const { gallery, spin360, ...productChanges } = changes;
    const product = await prisma.$transaction(async (transaction) => {
      const existingProduct = await transaction.product.findUnique({
        where: { id: req.params.id },
        select: { id: true, pricePaise: true, compareAtPricePaise: true },
      });
      if (!existingProduct) {
        const error = new Error('Product not found.');
        error.status = 404;
        throw error;
      }

      const nextPrice = productChanges.pricePaise ?? existingProduct.pricePaise;
      const nextCompareAtPrice = productChanges.compareAtPricePaise === undefined
        ? existingProduct.compareAtPricePaise
        : productChanges.compareAtPricePaise;
      if (!hasValidCompareAtPrice(nextPrice, nextCompareAtPrice)) {
        const error = new Error('The original price must be greater than the current price.');
        error.status = 400;
        throw error;
      }

      if (Object.keys(productChanges).length > 0) {
        await transaction.product.update({
          where: { id: req.params.id },
          data: productChanges,
        });
      }

      if (gallery !== undefined || spin360 !== undefined) {
        const currentImages = await transaction.productImage.findMany({
          where: { productId: req.params.id },
          orderBy: [{ kind: 'asc' }, { position: 'asc' }],
        });
        const nextGallery = gallery ?? currentImages
          .filter((image) => image.kind === 'GALLERY')
          .map(({ url, publicId }) => ({ url, publicId }));
        const nextSpin360 = spin360 ?? currentImages
          .filter((image) => image.kind === 'SPIN360')
          .map(({ url, publicId }) => ({ url, publicId }));

        await transaction.productImage.deleteMany({ where: { productId: req.params.id } });
        const nextImages = [
          ...nextGallery.map((image, position) => ({
            ...image,
            productId: req.params.id,
            kind: 'GALLERY',
            position,
          })),
          ...nextSpin360.map((image, position) => ({
            ...image,
            productId: req.params.id,
            kind: 'SPIN360',
            position,
          })),
        ];
        if (nextImages.length > 0) {
          await transaction.productImage.createMany({ data: nextImages });
        }
      }

      return transaction.product.findUnique({
        where: { id: req.params.id },
        include: includeProductImages(),
      });
    });

    return res.json({ product });
  } catch (error) {
    if (error.code === 'P2025' && !error.status) {
      error.status = 404;
      error.message = 'Product not found.';
    }
    return next(error);
  }
});

export default router;
