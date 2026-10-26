// app/api/inventory/backfill-batches/route.js
// POST — creates MANUAL-STOCK ProductBatch for every variant that has stock but no batch
// Safe to run multiple times (idempotent). Call once after deployment.
// Auth: store owner only.

import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import authSeller from '@/middlewares/authSeller';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const storeId = await authSeller(userId);
    if (!storeId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Find all variants with stock > 0 that have NO ProductBatch records at all
    const variants = await prisma.productVariant.findMany({
      where: {
        stock: { gt: 0 },
        product: { storeId, status: 'ACTIVE' },
        batches: { none: {} },
      },
      select: { id: true, stock: true, productId: true },
    });

    if (variants.length === 0) {
      return NextResponse.json({ message: 'All variants already have batch records', created: 0 });
    }

    await prisma.productBatch.createMany({
      data: variants.map((v) => ({
        productId: v.productId,
        variantId: v.id,
        batchNumber: 'MANUAL-STOCK',
        expiryDate: null,
        quantity: v.stock,
        remainingQty: v.stock,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      message: `Backfilled ${variants.length} variant(s) with MANUAL-STOCK batch`,
      created: variants.length,
    });
  } catch (error) {
    console.error('backfill-batches error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
