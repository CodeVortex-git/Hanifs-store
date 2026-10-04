const prisma = require("./prisma");
const { ORDER_STATUS, PAYMENT_STATUS } = require("../constants/statuses");

const RESERVATION_TTL_MS = 30 * 60 * 1000;
const RESERVATION_STATUS = Object.freeze({
  NONE: "none",
  RESERVED: "reserved",
  COMMITTED: "committed",
  RELEASED: "released",
});

class InventoryServiceError extends Error {
  constructor(status, message, code = "inventory_conflict") {
    super(message);
    this.name = "InventoryServiceError";
    this.status = status;
    this.code = code;
  }
}

const reservationOrderSelect = {
  id: true,
  orderStatus: true,
  paymentStatus: true,
  paymentReference: true,
  inventoryReservationStatus: true,
  inventoryReservationExpiresAt: true,
  paymentReconciliationRequired: true,
  items: {
    orderBy: { productVariantId: "asc" },
    select: { productVariantId: true, quantity: true },
  },
};

function aggregateItems(items) {
  const quantities = new Map();
  for (const item of items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      throw new Error("Order contains an invalid inventory quantity.");
    }
    const quantity = (quantities.get(item.productVariantId) || 0) + item.quantity;
    if (!Number.isSafeInteger(quantity)) throw new Error("Order inventory quantity is invalid.");
    quantities.set(item.productVariantId, quantity);
  }
  return [...quantities.entries()].sort(([left], [right]) => left - right);
}

async function reserveOrderInventory(transaction, orderId, { allowRetry = false, expiresAt = null } = {}) {
  const order = await transaction.order.findUnique({
    where: { id: orderId },
    select: reservationOrderSelect,
  });
  if (!order) throw new InventoryServiceError(404, "Order not found.", "order_not_found");

  if (order.paymentReconciliationRequired) {
    throw new InventoryServiceError(
      409,
      "This payment needs reconciliation before another attempt can start.",
      "payment_reconciliation_required",
    );
  }
  if (order.inventoryReservationStatus === RESERVATION_STATUS.COMMITTED) {
    return { status: "already_committed" };
  }
  if (order.inventoryReservationStatus === RESERVATION_STATUS.RESERVED) {
    return { status: "already_reserved" };
  }
  if (order.inventoryReservationStatus === RESERVATION_STATUS.RELEASED && !allowRetry) {
    throw new InventoryServiceError(409, "Inventory is no longer reserved for this order.");
  }
  if (
    order.inventoryReservationStatus === RESERVATION_STATUS.RELEASED &&
    order.paymentStatus !== PAYMENT_STATUS.FAILED
  ) {
    throw new InventoryServiceError(
      409,
      "The previous payment attempt must be confirmed failed before inventory can be reserved again.",
      "payment_attempt_pending",
    );
  }
  if (![ORDER_STATUS.PENDING, ORDER_STATUS.PAYMENT_PENDING].includes(order.orderStatus)) {
    throw new InventoryServiceError(409, "This order cannot reserve inventory in its current state.");
  }
  if (!order.items.length) throw new Error("Order has no inventory lines to reserve.");

  for (const [variantId, quantity] of aggregateItems(order.items)) {
    const updated = await transaction.productVariant.updateMany({
      where: {
        id: variantId,
        active: true,
        product: { is: { active: true } },
        stock: { gte: quantity },
      },
      data: { stock: { decrement: quantity } },
    });
    if (updated.count !== 1) {
      throw new InventoryServiceError(
        409,
        "There is not enough available stock for one or more items. Update your bag and try again.",
        "inventory_unavailable",
      );
    }
  }

  const expectedStatus = order.inventoryReservationStatus;
  const changed = await transaction.order.updateMany({
    where: {
      id: order.id,
      inventoryReservationStatus: expectedStatus,
      orderStatus: { in: [ORDER_STATUS.PENDING, ORDER_STATUS.PAYMENT_PENDING] },
      ...(allowRetry ? { paymentStatus: PAYMENT_STATUS.FAILED } : {}),
    },
    data: {
      inventoryReservationStatus: RESERVATION_STATUS.RESERVED,
      inventoryReservationExpiresAt: expiresAt || new Date(Date.now() + RESERVATION_TTL_MS),
    },
  });
  if (changed.count !== 1) {
    throw new InventoryServiceError(409, "Inventory reservation changed. Please retry.");
  }
  return { status: "reserved" };
}

async function commitOrderReservation(transaction, { orderId, reference, amount, transactionId = null }) {
  const updated = await transaction.order.updateMany({
    where: {
      id: orderId,
      paymentReference: reference,
      totalAmount: amount,
      inventoryReservationStatus: RESERVATION_STATUS.RESERVED,
      paymentStatus: PAYMENT_STATUS.PENDING,
      orderStatus: { in: [ORDER_STATUS.PENDING, ORDER_STATUS.PAYMENT_PENDING] },
    },
    data: {
      inventoryReservationStatus: RESERVATION_STATUS.COMMITTED,
      inventoryReservationExpiresAt: null,
      paymentStatus: PAYMENT_STATUS.SUCCESS,
      orderStatus: ORDER_STATUS.PAID,
      paymentReconciliationRequired: false,
      ...(transactionId ? { paystackTransactionId: String(transactionId).slice(0, 100) } : {}),
    },
  });

  const latest = await transaction.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      totalAmount: true,
      orderStatus: true,
      paymentStatus: true,
      paymentReference: true,
      inventoryReservationStatus: true,
      paymentReconciliationRequired: true,
      paystackTransactionId: true,
    },
  });
  if (!latest) throw new Error("Order disappeared during inventory settlement.");

  if (
    latest.paymentReference === reference &&
    latest.inventoryReservationStatus === RESERVATION_STATUS.COMMITTED &&
    latest.paymentStatus === PAYMENT_STATUS.SUCCESS &&
    latest.orderStatus === ORDER_STATUS.PAID
  ) {
    return { status: updated.count === 1 ? "settled" : "already_settled", order: latest };
  }

  if (
    latest.paymentReference === reference &&
    [RESERVATION_STATUS.RELEASED, RESERVATION_STATUS.NONE].includes(latest.inventoryReservationStatus) &&
    latest.paymentStatus !== PAYMENT_STATUS.SUCCESS &&
    [ORDER_STATUS.PENDING, ORDER_STATUS.PAYMENT_PENDING].includes(latest.orderStatus)
  ) {
    const recorded = await transaction.order.updateMany({
      where: {
        id: orderId,
        paymentReference: reference,
        inventoryReservationStatus: latest.inventoryReservationStatus,
        paymentStatus: { not: PAYMENT_STATUS.SUCCESS },
      },
      data: {
        paymentReconciliationRequired: true,
        ...(transactionId ? { paystackTransactionId: String(transactionId).slice(0, 100) } : {}),
      },
    });
    if (recorded.count === 1) {
      return { status: "reservation_released", order: { ...latest, paymentReconciliationRequired: true } };
    }
  }

  return { status: "ineligible_state", order: latest };
}

async function releaseOrderReservation(
  transaction,
  orderId,
  { expectedReference, onlyExpiredAtOrBefore, markPaymentFailed = false } = {},
) {
  const order = await transaction.order.findUnique({
    where: { id: orderId },
    select: reservationOrderSelect,
  });
  if (!order) return { status: "not_found" };
  if (order.paymentReconciliationRequired) return { status: "reconciliation_required" };
  if (order.inventoryReservationStatus !== RESERVATION_STATUS.RESERVED) {
    return { status: order.inventoryReservationStatus === RESERVATION_STATUS.COMMITTED ? "committed" : "already_released" };
  }

  const where = {
    id: order.id,
    inventoryReservationStatus: RESERVATION_STATUS.RESERVED,
    paymentStatus: { not: PAYMENT_STATUS.SUCCESS },
    orderStatus: { in: [ORDER_STATUS.PENDING, ORDER_STATUS.PAYMENT_PENDING] },
    ...(expectedReference ? { paymentReference: expectedReference } : {}),
    ...(onlyExpiredAtOrBefore ? { inventoryReservationExpiresAt: { lte: onlyExpiredAtOrBefore } } : {}),
  };
  const updated = await transaction.order.updateMany({
    where,
    data: {
      inventoryReservationStatus: RESERVATION_STATUS.RELEASED,
      inventoryReservationExpiresAt: null,
      ...(markPaymentFailed ? { paymentStatus: PAYMENT_STATUS.FAILED } : {}),
    },
  });
  if (updated.count !== 1) return { status: "already_released" };

  for (const [variantId, quantity] of aggregateItems(order.items)) {
    const restored = await transaction.productVariant.updateMany({
      where: { id: variantId },
      data: { stock: { increment: quantity } },
    });
    if (restored.count !== 1) throw new Error("Reserved product variant could not be restored.");
  }
  return { status: "released" };
}

async function releaseExpiredReservations(now = new Date()) {
  const expired = await prisma.order.findMany({
    where: {
      inventoryReservationStatus: RESERVATION_STATUS.RESERVED,
      inventoryReservationExpiresAt: { lte: now },
      paymentStatus: { not: PAYMENT_STATUS.SUCCESS },
      orderStatus: { in: [ORDER_STATUS.PENDING, ORDER_STATUS.PAYMENT_PENDING] },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  let released = 0;
  for (const { id } of expired) {
    const result = await prisma.$transaction((transaction) =>
      releaseOrderReservation(transaction, id, { onlyExpiredAtOrBefore: now }),
    );
    if (result.status === "released") released += 1;
  }
  return { scanned: expired.length, released };
}

module.exports = {
  RESERVATION_STATUS,
  RESERVATION_TTL_MS,
  InventoryServiceError,
  reserveOrderInventory,
  commitOrderReservation,
  releaseOrderReservation,
  releaseExpiredReservations,
};
