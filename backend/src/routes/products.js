import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
      include: {
        images: {
          orderBy: [{ kind: 'asc' }, { position: 'asc' }],
          select: { id: true, url: true, kind: true, position: true },
        },
      },
    });
    res.json({ products });
  } catch (error) {
    next(error);
  }
});

export default router;
