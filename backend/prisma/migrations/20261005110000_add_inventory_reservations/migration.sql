CREATE TYPE "InventoryReservationStatus" AS ENUM ('none', 'reserved', 'committed', 'released');

ALTER TABLE "Order"
ADD COLUMN "inventoryReservationStatus" "InventoryReservationStatus" NOT NULL DEFAULT 'none',
ADD COLUMN "inventoryReservationExpiresAt" TIMESTAMP(3),
ADD COLUMN "paymentReconciliationRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "paystackTransactionId" VARCHAR(100);

CREATE INDEX "Order_inventoryReservationStatus_inventoryReservationExpiresAt_idx"
ON "Order"("inventoryReservationStatus", "inventoryReservationExpiresAt");

ALTER TABLE "ProductVariant"
ADD CONSTRAINT "ProductVariant_stock_nonnegative_check" CHECK ("stock" >= 0);
