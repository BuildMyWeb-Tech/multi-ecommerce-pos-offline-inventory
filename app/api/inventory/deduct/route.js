// app/api/inventory/deduct/route.js
import prisma from '@/lib/prisma';
import authSeller from '@/middlewares/authSeller';
import verifyEmployeeToken, { hasPermission, PERMISSIONS } from '@/middlewares/authEmployee';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// POST /api/inventory/deduct — Deduct stock when an order is placed
// Called internally by order creation. Each item must have variantId + quantity.
// Body: { items: [{ variantId, quantity }] }
export async function POST(request) {
  try {
    // Auth: store owner, employee with MANAGE_INVENTORY, or internal call
    const employee = verifyEmployeeToken(request);
    let storeId = null;

    if (employee) {
      if (!hasPermission(employee, PERMISSIONS.MANAGE_INVENTORY)) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
      }
      storeId = employee.storeId;
    } else {
      const { userId } = getAuth(request);
      if (userId) {
        storeId = await authSeller(userId);
      }
      // Note: for internal order placement, storeId may be passed in body
    }

    const { items = [], storeId: bodyStoreId } = await request.json();

    // Allow internal calls to pass storeId in body (order system)
    const effectiveStoreId = storeId || bodyStoreId;

    if (!effectiveStoreId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!items.length) {
      return NextResponse.json({ message: 'No items to deduct', deducted: [] });
    }

    const deducted = [];
    const errors   = [];

    for (const item of items) {
      const deductQty = Math.max(0, Number(item.quantity));
      if (!deductQty || !item.variantId) continue;

      // Clean variantId (strip any duplicate suffix used by billing POS)
      const cleanVariantId = String(item.variantId).split('_')[0];

      try {
        await prisma.$transaction(async (tx) => {
          const variant = await tx.productVariant.findUnique({
            where: { id: cleanVariantId },
            include: {
              product: { select: { storeId: true, id: true } },
              inventory: true,
            },
          });

          if (!variant) throw new Error(`Variant ${cleanVariantId} not found`);

          if (variant.product.storeId !== effectiveStoreId) {
            throw new Error(`Variant ${cleanVariantId} does not belong to this store`);
          }

          const currentStock = variant.stock;
          if (currentStock < deductQty) {
            throw new Error(
              `Insufficient stock for variant ${cleanVariantId}. Available: ${currentStock}`
            );
          }

          // Deduct batch if provided
          if (item.batchId) {
            const batch = await tx.productBatch.findUnique({
              where: { id: item.batchId },
              select: { id: true, remainingQty: true },
            });
            if (!batch) throw new Error(`Batch ${item.batchId} not found`);
            if (batch.remainingQty < deductQty) {
              throw new Error(`Insufficient batch qty. Available: ${batch.remainingQty}`);
            }
            await tx.productBatch.update({
              where: { id: item.batchId },
              data: { remainingQty: { decrement: deductQty } },
            });
          }

          const newStock = currentStock - deductQty;

          await tx.productVariant.update({
            where: { id: cleanVariantId },
            data: { stock: newStock },
          });

          await tx.inventory.upsert({
            where: { variantId: cleanVariantId },
            update: { quantity: newStock },
            create: {
              variantId: cleanVariantId,
              storeId: effectiveStoreId,
              quantity: newStock,
              lowStock: 10,
            },
          });

          deducted.push({
            variantId: cleanVariantId,
            productId: variant.product.id,
            deducted: deductQty,
            newStock,
          });
        });
      } catch (err) {
        console.error(`Deduct error for variant ${cleanVariantId}:`, err.message);
        errors.push({ variantId: cleanVariantId, reason: err.message });
      }
    }

    const status = errors.length > 0 && deducted.length === 0 ? 500 : 200;

    return NextResponse.json(
      { message: 'Deduction complete', deducted, errors },
      { status }
    );
  } catch (error) {
    console.error('POST /api/inventory/deduct error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}