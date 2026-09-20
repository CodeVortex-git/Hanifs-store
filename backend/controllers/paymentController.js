// Payment controllers.
//
// SECURITY NOTE — the browser is never the authority for payment state.
// The frontend may ask the backend to start a payment, but only the backend
// may create the pending order, calculate the authoritative amount, talk to
// the payment provider, and later confirm the payment status. Payment status
// must never be trusted when it arrives from client-side state.

const PAYMENT_NOT_CONFIGURED_MESSAGE =
  "Payment integration is not yet configured.";

// POST /api/payments/initialize
//
// Intentionally a placeholder for this milestone: no payment provider is
// contacted and no transaction reference is issued. Returning a fake
// successful initialization would let the frontend pretend an order is paid,
// so this responds with 501 until the payment milestone wires up
// services/paystackService.js and authoritative order pricing.
function initializePayment(_req, res) {
  res.status(501).json({
    success: false,
    message: PAYMENT_NOT_CONFIGURED_MESSAGE,
  });
}

// POST /api/payments/verify
//
// Placeholder as well. Real verification must happen server-to-server against
// the provider using backend-only credentials, then update the stored order.
// It must not rely on any value the browser sends as proof of payment.
function verifyPayment(_req, res) {
  res.status(501).json({
    success: false,
    message: PAYMENT_NOT_CONFIGURED_MESSAGE,
  });
}

module.exports = { initializePayment, verifyPayment };
