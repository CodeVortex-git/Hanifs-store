-- Add delivery system

CREATE TYPE "DeliveryStatus" AS ENUM (
    'pending',
    'ready_for_dispatch',
    'out_for_delivery',
    'delivered',
    'delivery_failed'
);

CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'pending',
    "provider" VARCHAR(100),
    "trackingNumber" VARCHAR(255),
    "reference" VARCHAR(255),
    "estimatedDeliveryDate" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Delivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "DeliveryStatusHistory" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "previousStatus" "DeliveryStatus" NOT NULL,
    "newStatus" "DeliveryStatus" NOT NULL,
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryStatusHistory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DeliveryStatusHistory_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DeliveryStatusHistory_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Delivery_orderId_key"
    ON "Delivery"("orderId");

CREATE INDEX "Delivery_status_createdAt_idx"
    ON "Delivery"("status", "createdAt");

CREATE INDEX "DeliveryStatusHistory_deliveryId_createdAt_idx"
    ON "DeliveryStatusHistory"("deliveryId", "createdAt");

CREATE INDEX "DeliveryStatusHistory_adminId_createdAt_idx"
    ON "DeliveryStatusHistory"("adminId", "createdAt");
