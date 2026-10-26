// prisma/seed.js
// Safe seed: adds billing test data only if the store exists
// Run: node prisma/seed.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Find first active store
  const store = await prisma.store.findFirst({ where: { isActive: true } });
  if (!store) {
    console.log('No active store found — create a store first, then re-run this seed.');
    return;
  }
  console.log(`Using store: ${store.name} (${store.id})`);

  // ── StoreSettings ────────────────────────────────────────────────
  const existing = await prisma.storeSettings.findUnique({ where: { storeId: store.id } });
  if (!existing) {
    await prisma.storeSettings.create({
      data: {
        storeId: store.id,
        storeName: store.name,
        address: store.address || '123 Main Street, City',
        gstNumber: 'TEST123456789',
        taxType: 'SINGLE',
        taxPercent: 18,
        currency: 'INR',
        showStoreName: true,
        showGST: true,
        footerMessage: 'Thank you for shopping with us!',
        defaultLowStock: 10,
      },
    });
    console.log('Created StoreSettings');
  } else {
    console.log('StoreSettings already exists — skipped');
  }

  // ── Find or create a test product with variant ────────────────────
  const product = await prisma.product.findFirst({
    where: { storeId: store.id, status: 'ACTIVE' },
    include: { variants: true },
  });

  if (!product) {
    console.log('No active products found — add products first, then re-run for batch seed data.');
    return;
  }

  const variant = product.variants[0];
  if (!variant) {
    console.log('Product has no variants — skipping batch seed.');
    return;
  }

  // ── ProductBatch test data ───────────────────────────────────────
  const existingBatch = await prisma.productBatch.findFirst({ where: { productId: product.id } });
  if (!existingBatch) {
    const now = new Date();
    const in20days = new Date(now); in20days.setDate(now.getDate() + 20);
    const in90days = new Date(now); in90days.setDate(now.getDate() + 90);
    const minus5days = new Date(now); minus5days.setDate(now.getDate() - 5);

    await prisma.productBatch.createMany({
      data: [
        {
          productId: product.id,
          variantId: variant.id,
          batchNumber: 'BATCH-001',
          expiryDate: in20days,
          quantity: 50,
          remainingQty: 50,
        },
        {
          productId: product.id,
          variantId: variant.id,
          batchNumber: 'BATCH-002',
          expiryDate: in90days,
          quantity: 100,
          remainingQty: 100,
        },
        {
          productId: product.id,
          variantId: variant.id,
          batchNumber: 'BATCH-EXPIRED',
          expiryDate: minus5days,
          quantity: 20,
          remainingQty: 5,
        },
      ],
    });
    console.log(`Created 3 test ProductBatch records for "${product.name}" (${variant.size || 'default'})`);
  } else {
    console.log('ProductBatch data already exists — skipped');
  }

  console.log('Seed complete!');
}

main()
  .catch((e) => { console.error('Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
