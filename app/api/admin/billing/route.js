// app/api/admin/billing/route.js
// Admin-only: view all bills across all stores
import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import authAdmin from '@/middlewares/authAdmin';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = await authAdmin(userId);
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '30'));
    const search = searchParams.get('search') || '';
    const storeId = searchParams.get('storeId') || '';

    const where = {
      ...(storeId && { storeId }),
      ...(search && { billNumber: { contains: search, mode: 'insensitive' } }),
    };

    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        include: {
          items: true,
          store: { select: { id: true, name: true } },
          employee: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.bill.count({ where }),
    ]);

    return NextResponse.json({ bills, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
