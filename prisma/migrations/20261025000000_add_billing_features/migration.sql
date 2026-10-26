-- AlterTable: Add role to Employee, relations to Store
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'EMPLOYEE';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "batches" TEXT; -- placeholder for Prisma relations (no column needed)

-- CreateTable: Bill
CREATE TABLE IF NOT EXISTS "Bill" (
    "id" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'CASH',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" TEXT,
    "paidAmount" DOUBLE PRECISION,
    "changeAmount" DOUBLE PRECISION,
    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BillItem
CREATE TABLE IF NOT EXISTS "BillItem" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "batchId" TEXT,
    "name" TEXT NOT NULL,
    "size" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "BillItem_pkey" PRIMARY KEY ("id")
);

-- CreateEnum: SaleSource
DO $$ BEGIN
    CREATE TYPE "SaleSource" AS ENUM ('ORDER', 'BILLING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: Sale
CREATE TABLE IF NOT EXISTS "Sale" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "source" "SaleSource" NOT NULL DEFAULT 'ORDER',
    "referenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" TEXT,
    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable: StoreSettings
CREATE TABLE IF NOT EXISTS "StoreSettings" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "gstNumber" TEXT,
    "address" TEXT NOT NULL,
    "taxType" TEXT NOT NULL DEFAULT 'SINGLE',
    "taxPercent" DOUBLE PRECISION DEFAULT 18,
    "cgst" DOUBLE PRECISION DEFAULT 9,
    "sgst" DOUBLE PRECISION DEFAULT 9,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "showStoreName" BOOLEAN NOT NULL DEFAULT true,
    "showGST" BOOLEAN NOT NULL DEFAULT true,
    "footerMessage" TEXT DEFAULT 'Thank you for shopping with us!',
    "defaultLowStock" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: StoreSize
CREATE TABLE IF NOT EXISTS "StoreSize" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoreSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProductBatch
CREATE TABLE IF NOT EXISTS "ProductBatch" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "batchNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL,
    "remainingQty" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductBatch_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
ALTER TABLE "StoreSettings" DROP CONSTRAINT IF EXISTS "StoreSettings_storeId_key";
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_storeId_key" UNIQUE ("storeId");
ALTER TABLE "StoreSize" DROP CONSTRAINT IF EXISTS "StoreSize_storeId_label_key";
ALTER TABLE "StoreSize" ADD CONSTRAINT "StoreSize_storeId_label_key" UNIQUE ("storeId", "label");

-- Indexes
CREATE INDEX IF NOT EXISTS "Bill_storeId_idx" ON "Bill"("storeId");
CREATE INDEX IF NOT EXISTS "Bill_createdAt_idx" ON "Bill"("createdAt");
CREATE INDEX IF NOT EXISTS "Bill_billNumber_idx" ON "Bill"("billNumber");
CREATE INDEX IF NOT EXISTS "Bill_storeId_createdAt_idx" ON "Bill"("storeId", "createdAt");
CREATE INDEX IF NOT EXISTS "Bill_employeeId_idx" ON "Bill"("employeeId");
CREATE INDEX IF NOT EXISTS "BillItem_billId_idx" ON "BillItem"("billId");
CREATE INDEX IF NOT EXISTS "BillItem_productId_idx" ON "BillItem"("productId");
CREATE INDEX IF NOT EXISTS "BillItem_variantId_idx" ON "BillItem"("variantId");
CREATE INDEX IF NOT EXISTS "Sale_storeId_idx" ON "Sale"("storeId");
CREATE INDEX IF NOT EXISTS "Sale_createdAt_idx" ON "Sale"("createdAt");
CREATE INDEX IF NOT EXISTS "Sale_storeId_createdAt_idx" ON "Sale"("storeId", "createdAt");
CREATE INDEX IF NOT EXISTS "Sale_source_idx" ON "Sale"("source");
CREATE INDEX IF NOT EXISTS "Sale_referenceId_idx" ON "Sale"("referenceId");
CREATE INDEX IF NOT EXISTS "Sale_employeeId_idx" ON "Sale"("employeeId");
CREATE INDEX IF NOT EXISTS "StoreSize_storeId_idx" ON "StoreSize"("storeId");
CREATE INDEX IF NOT EXISTS "ProductBatch_productId_idx" ON "ProductBatch"("productId");
CREATE INDEX IF NOT EXISTS "ProductBatch_variantId_idx" ON "ProductBatch"("variantId");
CREATE INDEX IF NOT EXISTS "ProductBatch_expiryDate_idx" ON "ProductBatch"("expiryDate");
CREATE INDEX IF NOT EXISTS "ProductBatch_remainingQty_idx" ON "ProductBatch"("remainingQty");
CREATE INDEX IF NOT EXISTS "ProductBatch_productId_expiryDate_idx" ON "ProductBatch"("productId", "expiryDate");
CREATE INDEX IF NOT EXISTS "ProductBatch_remainingQty_expiryDate_idx" ON "ProductBatch"("remainingQty", "expiryDate");
CREATE INDEX IF NOT EXISTS "ProductBatch_batchNumber_idx" ON "ProductBatch"("batchNumber");

-- Foreign Keys
ALTER TABLE "Bill" DROP CONSTRAINT IF EXISTS "Bill_storeId_fkey";
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bill" DROP CONSTRAINT IF EXISTS "Bill_employeeId_fkey";
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillItem" DROP CONSTRAINT IF EXISTS "BillItem_billId_fkey";
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillItem" DROP CONSTRAINT IF EXISTS "BillItem_productId_fkey";
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillItem" DROP CONSTRAINT IF EXISTS "BillItem_variantId_fkey";
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillItem" DROP CONSTRAINT IF EXISTS "BillItem_batchId_fkey";
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sale" DROP CONSTRAINT IF EXISTS "Sale_storeId_fkey";
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sale" DROP CONSTRAINT IF EXISTS "Sale_employeeId_fkey";
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoreSettings" DROP CONSTRAINT IF EXISTS "StoreSettings_storeId_fkey";
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreSize" DROP CONSTRAINT IF EXISTS "StoreSize_storeId_fkey";
ALTER TABLE "StoreSize" ADD CONSTRAINT "StoreSize_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductBatch" DROP CONSTRAINT IF EXISTS "ProductBatch_productId_fkey";
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductBatch" DROP CONSTRAINT IF EXISTS "ProductBatch_variantId_fkey";
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
