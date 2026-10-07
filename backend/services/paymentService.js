const { randomUUID } = require("node:crypto");
const prisma = require("./prisma");
const paystackService = require("./paystackService");
const inventoryService = require("./inventoryService");
const { ownsResource } = require("../middleware/auth");
const { ORDER_STATUS, PAYMENT_STATUS } = require("../constants/statuses");

const CURRENCY = "NGN";
const PAYSTACK_REFERENCE_PATTERN = /^[A-Za-z0-9.=-]{1,100}$/;

class PaymentServiceError extends Error {
  constructor(status, message, payment = null, code = null) {
    super(message);
    this.name = "PaymentServiceError";
    this.status = status;
    this.payment = payment;
    this.code = code;
  }
}

function validateOrderId(orderId) {
  if (typeof orderId !== "string" || !orderId.trim() || orderId.length > 100) {
    throw new PaymentServiceError(400, "A valid order ID is required.");
  }
  return orderId.trim();
}

function validateReference(reference) {
  if (typeof reference !== "string" || !PAYSTACK_REFERENCE_PATTERN.test(reference)) {
    throw new PaymentServiceError(400, "A valid payment reference is required.");
  }
  return reference;
}

function publicOrderState(order) {
  return {
    id: order.id,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    amount: order.totalAmount,
    currency: CURRENCY,
    reference: order.paymentReference,
  };
}

async function initializePayment(rawOrderId, authenticatedUserId = null) {
  const orderId = validateOrderId(rawOrderId);
  await inventoryService.releaseExpiredReservations();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      customerEmail: true,
      totalAmount: true,
      orderStatus: true,
      paymentStatus: true,
      paymentReference: true,
      paymentReconciliationRequired: true,
    },
  });

  if (!order) throw new PaymentServiceError(404, "Order not found.");
  if (!ownsResource(authenticatedUserId, order.userId)) throw new PaymentServiceError(404, "Order not found.");
  if (!Number.isSafeInteger(order.totalAmount) || order.totalAmount < 1) {
    throw new PaymentServiceError(409, "This order does not have a valid payable amount.");
  }
  if (order.paymentStatus === PAYMENT_STATUS.SUCCESS || order.orderStatus === ORDER_STATUS.PAID) {
    throw new PaymentServiceError(409, "This order has already been paid.");
  }
  if (order.paymentReconciliationRequired) {
    throw new PaymentServiceError(
      409,
      "This payment needs reconciliation before another attempt can start.",
      null,
      "payment_reconciliation_required",
    );
  }
  if (![ORDER_STATUS.PENDING, ORDER_STATUS.PAYMENT_PENDING].includes(order.orderStatus)) {
    throw new PaymentServiceError(409, "This order cannot accept payment in its current state.");
  }
  if (order.paymentReference && order.paymentStatus !== PAYMENT_STATUS.FAILED) {
    throw new PaymentServiceError(409, "A payment is already initialized for this order.");
  }

  const reference = `hanifs-${randomUUID()}`;
  const isRetry = order.paymentStatus === PAYMENT_STATUS.FAILED;
  try {
    await prisma.$transaction(async (transaction) => {
      const result = await inventoryService.reserveOrderInventory(transaction, order.id, {
        allowRetry: isRetry,
        expiresAt: new Date(Date.now() + inventoryService.RESERVATION_TTL_MS),
      });
      if (result.status !== "reserved") {
        throw new PaymentServiceError(409, "Payment is already being initialized. Please retry shortly.");
      }
    });
  } catch (error) {
    if (error instanceof inventoryService.InventoryServiceError) {
      throw new PaymentServiceError(error.status, error.message, null, error.code);
    }
    throw error;
  }

  let initialized;
  try {
    initialized = await paystackService.initializeTransaction({
      email: order.customerEmail,
      amount: order.totalAmount,
      currency: CURRENCY,
      reference,
    });
    if (initialized.reference !== reference) {
      throw new paystackService.PaystackServiceError("Payment provider returned a mismatched reference.");
    }
  } catch (error) {
    await prisma.$transaction(async (transaction) => {
      await inventoryService.releaseOrderReservation(transaction, order.id, {
        markPaymentFailed: true,
      });
    });
    if (error instanceof paystackService.PaystackServiceError) {
      throw new PaymentServiceError(error.status, error.message);
    }
    throw error;
  }

  const initializedOrder = await prisma.$transaction((transaction) =>
    transaction.order.updateMany({
      where: {
        id: order.id,
        paymentReference: order.paymentReference,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        inventoryReservationStatus: inventoryService.RESERVATION_STATUS.RESERVED,
        paymentReconciliationRequired: false,
      },
      data: {
        paymentReference: reference,
        orderStatus: ORDER_STATUS.PAYMENT_PENDING,
        paymentStatus: PAYMENT_STATUS.PENDING,
        paymentReconciliationRequired: false,
        paystackTransactionId: null,
      },
    }),
  );
  if (initializedOrder.count !== 1) {
    await prisma.$transaction((transaction) =>
      inventoryService.releaseOrderReservation(transaction, order.id),
    );
    throw new PaymentServiceError(409, "The order state changed while payment was being initialized.");
  }

  return {
    orderId: order.id,
    orderStatus: ORDER_STATUS.PAYMENT_PENDING,
    paymentStatus: PAYMENT_STATUS.PENDING,
    amount: order.totalAmount,
    currency: CURRENCY,
    reference,
    authorizationUrl: initialized.authorizationUrl,
  };
}

async function verifyPayment(rawReference, authenticatedUserId = null) {
  const reference = validateReference(rawReference);
  const order = await prisma.order.findUnique({
    where: { paymentReference: reference },
    select: {
      id: true,
      userId: true,
      totalAmount: true,
      orderStatus: true,
      paymentStatus: true,
      paymentReference: true,
      inventoryReservationStatus: true,
    },
  });
  if (!order) throw new PaymentServiceError(404, "Payment reference not found.");
  if (!ownsResource(authenticatedUserId, order.userId)) throw new PaymentServiceError(404, "Payment reference not found.");

  if (order.paymentStatus === PAYMENT_STATUS.SUCCESS && order.orderStatus === ORDER_STATUS.PAID) {
    return { verified: true, ...publicOrderState(order) };
  }

  let verified;
  try {
    verified = await paystackService.verifyTransaction(reference);
  } catch (error) {
    if (error instanceof paystackService.PaystackServiceError) {
      throw new PaymentServiceError(error.status, error.message);
    }
    throw error;
  }

  if (verified.reference !== order.paymentReference) {
    throw new PaymentServiceError(409, "Payment could not be verified for this order.");
  }
  if (verified.amount !== order.totalAmount || verified.currency !== CURRENCY) {
    throw new PaymentServiceError(409, "Verified payment details do not match this order.");
  }

  if (verified.status !== "success") {
    if (["failed", "abandoned"].includes(verified.status)) {
      const failedOrder = await prisma.$transaction(async (transaction) => {
        const released = await inventoryService.releaseOrderReservation(transaction, order.id, {
          expectedReference: reference,
          markPaymentFailed: true,
        });
        if (released.status === "already_released") {
          await transaction.order.updateMany({
            where: {
              id: order.id,
              paymentReference: reference,
              paymentReconciliationRequired: false,
              paymentStatus: { not: PAYMENT_STATUS.SUCCESS },
              orderStatus: { in: [ORDER_STATUS.PENDING, ORDER_STATUS.PAYMENT_PENDING] },
            },
            data: { paymentStatus: PAYMENT_STATUS.FAILED },
          });
        }
        return transaction.order.findUnique({
          where: { id: order.id },
          select: {
            id: true,
            totalAmount: true,
            orderStatus: true,
            paymentStatus: true,
            paymentReference: true,
            paymentReconciliationRequired: true,
          },
        });
      });
      if (failedOrder?.paymentStatus === PAYMENT_STATUS.SUCCESS && failedOrder.orderStatus === ORDER_STATUS.PAID) {
        return { verified: true, ...publicOrderState(failedOrder) };
      }
      throw new PaymentServiceError(
        409,
        "Payment was not successful. You can retry payment for this order.",
        publicOrderState(failedOrder),
      );
    }
    throw new PaymentServiceError(409, "Payment is not complete yet.");
  }

  const settlement = await settlePayment({
    reference,
    amount: verified.amount,
    currency: verified.currency,
    transactionId: verified.transactionId,
  });
  if (settlement.status === "reservation_released") {
    throw new PaymentServiceError(
      409,
      "Payment was received after its inventory reservation ended. Contact support to reconcile this order.",
      publicOrderState(settlement.order),
      "payment_reconciliation_required",
    );
  }
  if (!["settled", "already_settled"].includes(settlement.status)) {
    throw new PaymentServiceError(409, "The order state changed before payment could be confirmed.");
  }

  return {
    verified: true,
    ...publicOrderState(settlement.order),
    transactionId: verified.transactionId,
  };
}

async function settlePayment({ reference: rawReference, amount, currency, transactionId = null }) {
  if (typeof rawReference !== "string" || !PAYSTACK_REFERENCE_PATTERN.test(rawReference)) {
    return { status: "unknown_reference" };
  }
  const reference = rawReference;
  const order = await prisma.order.findUnique({
    where: { paymentReference: reference },
    select: {
      id: true,
      totalAmount: true,
      orderStatus: true,
      paymentStatus: true,
      paymentReference: true,
      inventoryReservationStatus: true,
    },
  });
  if (!order) return { status: "unknown_reference" };
  if (amount !== order.totalAmount) return { status: "amount_mismatch" };
  if (currency !== CURRENCY) return { status: "currency_mismatch" };

  if (order.paymentStatus === PAYMENT_STATUS.SUCCESS && order.orderStatus === ORDER_STATUS.PAID) {
    return { status: "already_settled", order };
  }
  const reservationWasReleased = [
    inventoryService.RESERVATION_STATUS.RELEASED,
    inventoryService.RESERVATION_STATUS.NONE,
  ].includes(order.inventoryReservationStatus);
  if (!reservationWasReleased && (
    ![ORDER_STATUS.PENDING, ORDER_STATUS.PAYMENT_PENDING].includes(order.orderStatus) ||
    order.paymentStatus !== PAYMENT_STATUS.PENDING
  )) {
    return { status: "ineligible_state" };
  }

  return prisma.$transaction((transaction) =>
    inventoryService.commitOrderReservation(transaction, {
      orderId: order.id,
      reference,
      amount,
      transactionId,
    }),
  );
}

module.exports = { initializePayment, verifyPayment, settlePayment, PaymentServiceError };
