// app/api/inventory/batch/[id]/route.js
// PATCH — update a batch (adjust remainingQty or update fields)
// DELETE — remove a batch (also decrements variant stock)

import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import authSeller from '@/middlewares/authSeller';
import { NextResponse } from 'next/server';

async function resolveStore(request) {
  const { userId } = getAuth(request);
  if (!userId) return null;
  return await authSeller(userId);
}

export async function PATCH(request, { params }) {
  try {
    const storeId = await resolveStore(request);
    if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const body = await request.json();

    const batch = await prisma.productBatch.findFirst({
      where: { id, product: { storeId } },
    });
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

    const { batchNumber, expiryDate, remainingQty } = body;
    const updated = await prisma.productBatch.update({
      where: { id },
      data: {
        ...(batchNumber !== undefined && { batchNumber: batchNumber || null }),
        ...(expiryDate !== undefined && { expiryDate: expiryDate ? new Date(expiryDate) : null }),
        ...(remainingQty !== undefined && { remainingQty: Number(remainingQty) }),
      },
    });

    return NextResponse.json({ success: true, batch: updated });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const storeId = await resolveStore(request);
    if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;

    const batch = await prisma.productBatch.findFirst({
      where: { id, product: { storeId } },
    });
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      // Decrement variant stock by the remaining qty being removed
      if (batch.variantId && batch.remainingQty > 0) {
        await tx.productVariant.update({
          where: { id: batch.variantId },
          data: { stock: { decrement: batch.remainingQty } },
        });
        await tx.inventory.updateMany({
          where: { variantId: batch.variantId },
          data: { quantity: { decrement: batch.remainingQty } },
        });
      }
      await tx.productBatch.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
