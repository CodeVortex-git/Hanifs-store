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

const DELIVERY_STATUS = Object.freeze({
  PENDING: "pending",
  READY_FOR_DISPATCH: "ready_for_dispatch",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  DELIVERY_FAILED: "delivery_failed",
});

module.exports = { ORDER_STATUS, PAYMENT_STATUS, DELIVERY_STATUS };
