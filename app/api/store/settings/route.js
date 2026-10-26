// app/api/store/settings/route.js
import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import authSeller from '@/middlewares/authSeller';
import authAdmin from '@/middlewares/authAdmin';
import verifyEmployeeToken, { hasPermission, PERMISSIONS } from '@/middlewares/authEmployee';

// GET /api/store/settings — Fetch store settings
export async function GET(request) {
  try {
    const { userId } = getAuth(request);
    const { searchParams } = new URL(request.url);
    const queryStoreId = searchParams.get('storeId');

    // Admin fetching any store's settings
    if (queryStoreId) {
      const isAdminUser = await authAdmin(userId);
      if (!isAdminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const store = await prisma.store.findUnique({
        where: { id: queryStoreId },
        select: {
          id: true, name: true, description: true,
          address: true, email: true, contact: true,
          logo: true, status: true, isActive: true,
          commission: { select: { percentage: true } },
          shippingRules: true,
        },
      });
      if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      return NextResponse.json({ settings: store });
    }

    // Employee fetching own store settings (billing employees also need settings for tax calc)
    const employee = verifyEmployeeToken(request);
    if (employee) {
      const store = await prisma.store.findUnique({
        where: { id: employee.storeId },
        select: {
          id: true, name: true, description: true,
          address: true, email: true, contact: true, logo: true,
          storeSettings: true,
        },
      });
      return NextResponse.json({ settings: { ...store, ...(store?.storeSettings || {}) } });
    }

    // Store owner fetching own settings
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const storeId = await authSeller(userId);
    if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true, name: true, description: true,
        address: true, email: true, contact: true,
        logo: true, status: true, isActive: true,
        commission: { select: { percentage: true } },
        shippingRules: true,
        storeSettings: true,
      },
    });

    return NextResponse.json({ settings: { ...store, ...(store?.storeSettings || {}) } });
  } catch (error) {
    console.error('GET /api/store/settings error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/store/settings — Update store settings (owner only)
export async function POST(request) {
  try {
    // Block employees
    const employee = verifyEmployeeToken(request);
    if (employee) {
      if (!hasPermission(employee, PERMISSIONS.MANAGE_STORE_SETTINGS)) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
      }
    }

    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const storeId = await authSeller(userId);
    if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { name, description, address, email, contact,
      // Billing/POS settings
      taxType, taxPercent, cgst, sgst, gstNumber, currency,
      showStoreName, showGST, footerMessage, defaultLowStock,
    } = body;

    // Update core store info (if provided)
    let updatedStore = null;
    if (name || email || contact) {
      if (!name || !email || !contact) {
        return NextResponse.json({ error: 'Name, email and contact are required' }, { status: 400 });
      }
      updatedStore = await prisma.store.update({
        where: { id: storeId },
        data: {
          name,
          description: description || '',
          address: address || '',
          email,
          contact,
        },
        select: { id: true, name: true, description: true, address: true, email: true, contact: true, logo: true },
      });
    }

    // Update StoreSettings (billing/tax config)
    const hasBillingSettings = taxType !== undefined || taxPercent !== undefined || gstNumber !== undefined
      || cgst !== undefined || sgst !== undefined || currency !== undefined
      || showStoreName !== undefined || showGST !== undefined || footerMessage !== undefined
      || defaultLowStock !== undefined;

    let updatedBillingSettings = null;
    if (hasBillingSettings) {
      const store = await prisma.store.findUnique({ where: { id: storeId }, select: { name: true, address: true } });
      updatedBillingSettings = await prisma.storeSettings.upsert({
        where: { storeId },
        update: {
          ...(taxType !== undefined && { taxType }),
          ...(taxPercent !== undefined && { taxPercent: Number(taxPercent) }),
          ...(cgst !== undefined && { cgst: Number(cgst) }),
          ...(sgst !== undefined && { sgst: Number(sgst) }),
          ...(gstNumber !== undefined && { gstNumber }),
          ...(currency !== undefined && { currency }),
          ...(showStoreName !== undefined && { showStoreName }),
          ...(showGST !== undefined && { showGST }),
          ...(footerMessage !== undefined && { footerMessage }),
          ...(defaultLowStock !== undefined && { defaultLowStock: Number(defaultLowStock) }),
        },
        create: {
          storeId,
          storeName: store?.name || '',
          address: store?.address || address || '',
          taxType: taxType || 'SINGLE',
          taxPercent: taxPercent != null ? Number(taxPercent) : 18,
          cgst: cgst != null ? Number(cgst) : 9,
          sgst: sgst != null ? Number(sgst) : 9,
          gstNumber: gstNumber || null,
          currency: currency || 'INR',
          showStoreName: showStoreName !== false,
          showGST: showGST !== false,
          footerMessage: footerMessage || 'Thank you for shopping with us!',
          defaultLowStock: defaultLowStock != null ? Number(defaultLowStock) : 10,
        },
      });
    }

    return NextResponse.json({
      message: 'Settings updated successfully',
      settings: { ...(updatedStore || {}), ...(updatedBillingSettings || {}) },
    });
  } catch (error) {
    console.error('POST /api/store/settings error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const PUT = POST;