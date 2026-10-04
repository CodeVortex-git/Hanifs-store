ALTER TABLE "Order"
ADD COLUMN "paymentReference" VARCHAR(100);

CREATE UNIQUE INDEX "Order_paymentReference_key"
ON "Order"("paymentReference");
