import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { createOrderSchema, priceOrder } from '../lib/orders.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { items, address } = createOrderSchema.parse(req.body);
    const order = await prisma.$transaction(async (transaction) => {
      const products = await transaction.product.findMany({
        where: {
          id: { in: items.map((item) => item.productId) },
          active: true,
        },
        select: {
          id: true,
          name: true,
          pricePaise: true,
          stock: true,
          active: true,
        },
      });
      const { lines, totalPaise } = priceOrder(items, products);

      for (const line of lines) {
        const stockUpdate = await transaction.product.updateMany({
          where: {
            id: line.productId,
            active: true,
            stock: { gte: line.quantity },
          },
          data: { stock: { decrement: line.quantity } },
        });
        if (stockUpdate.count !== 1) {
          const error = new Error('Stock changed while placing your order. Please review your bag and try again.');
          error.status = 409;
          throw error;
        }
      }

      return transaction.order.create({
        data: {
          addressSnapshot: address,
          paymentMethod: 'COD',
          status: 'PENDING_CONFIRMATION',
          paymentStatus: 'CREATED',
          totalPaise,
          items: {
            create: lines.map((line) => ({
              name: line.name,
              unitPricePaise: line.unitPricePaise,
              quantity: line.quantity,
              product: { connect: { id: line.productId } },
            })),
          },
        },
        select: {
          id: true,
          totalPaise: true,
          paymentMethod: true,
          status: true,
          createdAt: true,
        },
      });
    });

    return res.status(201).json({ order });
  } catch (error) {
    return next(error);
  }
});

export default router;
