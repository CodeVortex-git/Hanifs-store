// Paystack integration belongs on the server only. Never expose PAYSTACK_SECRET_KEY to the browser.
// The backend will eventually send amounts in the currency subunit during initialization.

async function initializeTransaction() {
  throw new Error("Paystack initialization is not active yet.");
}

async function verifyTransaction() {
  throw new Error("Paystack verification is not active yet.");
}

module.exports = { initializeTransaction, verifyTransaction };
