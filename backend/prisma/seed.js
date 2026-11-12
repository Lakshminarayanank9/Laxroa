import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env');

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN' },
    create: { name: 'QIVRA Admin', email, passwordHash, role: 'ADMIN' },
  });

  const products = [
    { name: 'Sample Product One', slug: 'sample-product-one', description: 'First sample product.', pricePaise: 49900, stock: 25 },
    { name: 'Sample Product Two', slug: 'sample-product-two', description: 'Second sample product.', pricePaise: 99900, stock: 10 },
    { name: 'Sample Product Three', slug: 'sample-product-three', description: 'Third sample product.', pricePaise: 149900, stock: 5 },
  ];
  for (const p of products) {
    await prisma.product.upsert({ where: { slug: p.slug }, update: {}, create: p });
  }
  console.log(`Seeded admin (${email}) and ${products.length} sample products.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
