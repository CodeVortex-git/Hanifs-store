const crypto = require("node:crypto");
const paymentService = require("../services/paymentService");

const PAYSTACK_SIGNATURE_PATTERN = /^[a-f\d]{128}$/i;

function hasValidPaystackSignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || !secret || typeof signature !== "string") {
    return false;
  }
  if (!PAYSTACK_SIGNATURE_PATTERN.test(signature)) return false;

  const supplied = Buffer.from(signature, "hex");
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest();
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

function sendPaymentError(res, error) {
  if (error instanceof paymentService.PaymentServiceError) {
    res.status(error.status).json({
      success: false,
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(error.payment ? { payment: error.payment } : {}),
    });
    return;
  }

  console.error("Payment request failed:", error.message);
  res.status(500).json({
    success: false,
    message: "We could not process the payment request. Please try again.",
  });
}

async function initializePayment(req, res) {
  try {
    const result = await paymentService.initializePayment(req.body?.orderId, req.auth?.user?.id ?? null);
    res.status(201).json({ success: true, payment: result });
  } catch (error) {
    sendPaymentError(res, error);
  }
}

async function verifyPayment(req, res) {
  try {
    const result = await paymentService.verifyPayment(req.body?.reference, req.auth?.user?.id ?? null);
    res.status(200).json({ success: true, payment: result });
  } catch (error) {
    sendPaymentError(res, error);
  }
}

async function handlePaystackWebhook(req, res) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    res.status(503).json({ success: false, message: "Payment webhook is not configured." });
    return;
  }

  const signature = req.get("x-paystack-signature");
  if (!hasValidPaystackSignature(req.rawBody, signature, secret)) {
    res.status(401).json({ success: false, message: "Invalid webhook signature." });
    return;
  }

  const payload = req.body;
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof payload.event !== "string") {
    res.status(400).json({ success: false, message: "Invalid webhook payload." });
    return;
  }

  if (payload.event !== "charge.success") {
    res.status(200).json({ success: true, received: true });
    return;
  }

  const transaction = payload.data;
  if (!transaction || typeof transaction !== "object" || Array.isArray(transaction)) {
    res.status(400).json({ success: false, message: "Invalid webhook payload." });
    return;
  }

  // A signed charge.success notification with a non-success status is safely
  // acknowledged, but can never settle the order.
  if (transaction.status !== "success") {
    res.status(200).json({ success: true, received: true });
    return;
  }

  if (
    typeof transaction.reference !== "string" ||
    !Number.isSafeInteger(transaction.amount) ||
    typeof transaction.currency !== "string"
  ) {
    res.status(400).json({ success: false, message: "Invalid webhook payload." });
    return;
  }

  try {
    const result = await paymentService.settlePayment({
      reference: transaction.reference,
      amount: transaction.amount,
      currency: transaction.currency,
      transactionId:
        typeof transaction.id === "string" || typeof transaction.id === "number"
          ? transaction.id
          : null,
    });

    if (result.status === "reservation_released") {
      console.error(
        `Paystack success requires inventory reconciliation for order ${result.order.id}.`,
      );
      res.status(200).json({ success: true, received: true, reconciliationRequired: true });
      return;
    }

    if (["amount_mismatch", "currency_mismatch", "ineligible_state", "unknown_reference"].includes(result.status)) {
      console.warn(`Paystack webhook acknowledged without settlement: ${result.status}.`);
    }
    res.status(200).json({ success: true, received: true });
  } catch (error) {
    console.error("Paystack webhook processing failed.");
    res.status(500).json({ success: false, message: "Webhook processing failed. Please retry." });
  }
}

module.exports = { initializePayment, verifyPayment, handlePaystackWebhook };
