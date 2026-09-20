// Paystack service — server-side only.
//
// CREDENTIALS: Paystack credentials will eventually be read from backend
// environment variables (PAYSTACK_SECRET_KEY, and PAYSTACK_PUBLIC_KEY only if a
// browser-safe key is ever needed). The secret key must never be imported into,
// serialized to, or referenced by any frontend code. Do not hardcode a key in
// this file or in any other source file; the placeholder lives in
// backend/.env.example and the real value belongs in an untracked local .env.
//
// This milestone performs NO network calls. Both functions below are structural
// placeholders so the future payment milestone has a defined integration point.
// They intentionally throw rather than returning a fabricated success payload,
// because a simulated success could be mistaken for a real charge.

// Amounts are expected in the currency subunit (kobo for NGN) when the real
// request is implemented.
async function initializeTransaction() {
  throw new Error("Paystack initialization is not active yet.");
}

async function verifyTransaction() {
  throw new Error("Paystack verification is not active yet.");
}

module.exports = { initializeTransaction, verifyTransaction };
