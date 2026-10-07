-- Record every administrator stock change in the same transaction as the update.
CREATE TABLE "InventoryAdjustment" (
    "id" TEXT NOT NULL,
    "productVariantId" INTEGER NOT NULL,
    "adminId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "previousStock" INTEGER NOT NULL,
    "resultingStock" INTEGER NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAdjustment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InventoryAdjustment_delta_nonzero_check" CHECK ("delta" <> 0),
    CONSTRAINT "InventoryAdjustment_previous_stock_nonnegative_check" CHECK ("previousStock" >= 0),
    CONSTRAINT "InventoryAdjustment_resulting_stock_nonnegative_check" CHECK ("resultingStock" >= 0),
    CONSTRAINT "InventoryAdjustment_stock_math_check" CHECK ("resultingStock"::BIGINT = "previousStock"::BIGINT + "delta"::BIGINT)
);

CREATE INDEX "InventoryAdjustment_productVariantId_createdAt_idx"
ON "InventoryAdjustment"("productVariantId", "createdAt");

CREATE INDEX "InventoryAdjustment_adminId_createdAt_idx"
ON "InventoryAdjustment"("adminId", "createdAt");

ALTER TABLE "InventoryAdjustment"
ADD CONSTRAINT "InventoryAdjustment_productVariantId_fkey"
FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryAdjustment"
ADD CONSTRAINT "InventoryAdjustment_adminId_fkey"
FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
