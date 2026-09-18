const ORDER_STATUS = Object.freeze({
  PENDING: "pending",
  PAYMENT_PENDING: "payment_pending",
  PAID: "paid",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
});

const PAYMENT_STATUS = Object.freeze({
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
  REFUNDED: "refunded",
});

module.exports = { ORDER_STATUS, PAYMENT_STATUS };
