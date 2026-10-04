const PAYSTACK_API_BASE = "https://api.paystack.co";

class PaystackServiceError extends Error {
  constructor(message, { status = 502, retryable = false } = {}) {
    super(message);
    this.name = "PaystackServiceError";
    this.status = status;
    this.retryable = retryable;
  }
}

function getSecretKey() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey || secretKey === "your_secret_key_here") {
    throw new PaystackServiceError("Payment service is not configured.", {
      status: 503,
    });
  }
  return secretKey;
}

async function requestPaystack(path, options = {}) {
  const secretKey = getSecretKey();
  let response;
  try {
    response = await fetch(`${PAYSTACK_API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        ...(options.headers || {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new PaystackServiceError(
      "Payment provider could not be reached. Please try again.",
      { retryable: true },
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new PaystackServiceError("Payment provider returned an invalid response.");
  }

  if (!response.ok || payload?.status !== true || !payload.data) {
    throw new PaystackServiceError("Payment provider could not process the request.");
  }
  return payload.data;
}

async function initializeTransaction({ email, amount, currency, reference }) {
  const callbackUrl = process.env.PAYSTACK_CALLBACK_URL;
  const payload = await requestPaystack("/transaction/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      amount: String(amount),
      currency,
      reference,
      ...(callbackUrl ? { callback_url: callbackUrl } : {}),
    }),
  });

  let authorizationUrl;
  try {
    authorizationUrl = new URL(payload.authorization_url);
  } catch {
    throw new PaystackServiceError("Payment provider returned an invalid checkout URL.");
  }
  if (
    authorizationUrl.protocol !== "https:" ||
    authorizationUrl.hostname !== "checkout.paystack.com" ||
    typeof payload.reference !== "string" ||
    !payload.reference
  ) {
    throw new PaystackServiceError("Payment provider returned invalid checkout details.");
  }

  return {
    authorizationUrl: authorizationUrl.toString(),
    reference: payload.reference,
  };
}

async function verifyTransaction(reference) {
  const payload = await requestPaystack(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: "GET" },
  );

  return {
    status: payload.status,
    reference: payload.reference,
    amount: payload.amount,
    currency: payload.currency,
    transactionId: payload.id,
  };
}

module.exports = {
  initializeTransaction,
  verifyTransaction,
  PaystackServiceError,
};
