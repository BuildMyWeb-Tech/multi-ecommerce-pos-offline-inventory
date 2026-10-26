// app/api/store/expiry-alerts/route.js
// GET — returns products expiring within 30 days, expired batches, low-stock variants
// Used by admin/store panels for notification badges

import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import authSeller from '@/middlewares/authSeller';
import { verifyEmployeeToken, hasPermission } from '@/middlewares/authEmployee';
import { NextResponse } from 'next/server';

async function resolveStoreId(request) {
  try {
    const emp = verifyEmployeeToken(request);
    if (emp?.storeId) return emp.storeId;
  } catch (_) {}
  const { userId } = getAuth(request);
  if (!userId) return null;
  return await authSeller(userId);
}

export async function GET(request) {
  try {
    const storeId = await resolveStoreId(request);
    if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const now = new Date();
    const in30days = new Date(now);
    in30days.setDate(now.getDate() + 30);
    const in7days = new Date(now);
    in7days.setDate(now.getDate() + 7);

    const [expiredBatches, criticalBatches, soonBatches, lowStockVariants, outOfStockVariants] =
      await Promise.all([
        // Expired batches with remaining stock
        prisma.productBatch.findMany({
          where: {
            remainingQty: { gt: 0 },
            expiryDate: { not: null, lt: now },
            product: { storeId },
          },
          select: {
            id: true, batchNumber: true, expiryDate: true, remainingQty: true,
            product: { select: { id: true, name: true } },
            variant: { select: { id: true, size: true } },
          },
          take: 50,
          orderBy: { expiryDate: 'asc' },
        }),

        // Batches expiring in 7 days
        prisma.productBatch.findMany({
          where: {
            remainingQty: { gt: 0 },
            expiryDate: { gte: now, lte: in7days },
            product: { storeId },
          },
          select: {
            id: true, batchNumber: true, expiryDate: true, remainingQty: true,
            product: { select: { id: true, name: true } },
            variant: { select: { id: true, size: true } },
          },
          take: 50,
          orderBy: { expiryDate: 'asc' },
        }),

        // Batches expiring in 30 days
        prisma.productBatch.findMany({
          where: {
            remainingQty: { gt: 0 },
            expiryDate: { gte: in7days, lte: in30days },
            product: { storeId },
          },
          select: {
            id: true, batchNumber: true, expiryDate: true, remainingQty: true,
            product: { select: { id: true, name: true } },
            variant: { select: { id: true, size: true } },
          },
          take: 50,
          orderBy: { expiryDate: 'asc' },
        }),

        // placeholder — low stock computed via JS filter below
        Promise.resolve([]),

        // Out of stock variants
        prisma.productVariant.findMany({
          where: {
            stock: { lte: 0 },
            product: { storeId, status: 'ACTIVE' },
          },
          select: {
            id: true, size: true, stock: true,
            product: { select: { id: true, name: true } },
          },
          take: 50,
        }),
      ]);

    // JS fallback for low-stock (Prisma doesn't support column comparison in where)
    const lowStockViaInventory = await prisma.inventory.findMany({
      where: { storeId, quantity: { gt: 0 } },
      select: {
        id: true, quantity: true, lowStock: true,
        variant: {
          select: {
            id: true, size: true, stock: true,
            product: { select: { id: true, name: true } },
          },
        },
      },
    }).then((rows) => rows.filter((r) => r.quantity <= r.lowStock));

    return NextResponse.json({
      expiredBatches,
      criticalBatches,
      soonBatches,
      lowStockVariants: lowStockViaInventory.slice(0, 50),
      outOfStockVariants,
      summary: {
        expired: expiredBatches.length,
        critical: criticalBatches.length,
        soon: soonBatches.length,
        lowStock: lowStockViaInventory.length,
        outOfStock: outOfStockVariants.length,
      },
    });
  } catch (error) {
    console.error('GET /api/store/expiry-alerts error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
