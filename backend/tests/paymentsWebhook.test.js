const { createHmac } = require("node:crypto");
const { after, before, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const secret = "local-webhook-test-secret-only";
const reference = "hanifs-test-ref-1";
const totalAmount = 125000;
let order;
let failTransaction = false;
let providerVerification;
let server;
let baseUrl;
let previousSecret;

function freshOrder() {
  return {
    id: "local-test-order",
    totalAmount,
    orderStatus: "payment_pending",
    paymentStatus: "pending",
    paymentReference: reference,
    inventoryReservationStatus: "reserved",
    inventoryReservationExpiresAt: new Date(Date.now() + 60_000),
    paymentReconciliationRequired: false,
    paystackTransactionId: null,
  };
}

function matchesOrder(where) {
  if (where.id && where.id !== order?.id) return false;
  if (Object.hasOwn(where, "paymentReference") && where.paymentReference !== order?.paymentReference) return false;
  if (Object.hasOwn(where, "totalAmount") && where.totalAmount !== order?.totalAmount) return false;
  if (where.paymentStatus && typeof where.paymentStatus === "string" && where.paymentStatus !== order?.paymentStatus) return false;
  if (where.paymentStatus && typeof where.paymentStatus === "object" && where.paymentStatus.not === order?.paymentStatus) return false;
  if (where.inventoryReservationStatus && where.inventoryReservationStatus !== order?.inventoryReservationStatus) return false;
  if (typeof where.paymentReconciliationRequired === "boolean" && where.paymentReconciliationRequired !== order?.paymentReconciliationRequired) return false;
  if (where.orderStatus && typeof where.orderStatus === "string" && where.orderStatus !== order?.orderStatus) return false;
  if (where.orderStatus?.in && !where.orderStatus.in.includes(order?.orderStatus)) return false;
  return Boolean(order);
}

function selectedOrder() {
  if (!order) return null;
  return {
    id: order.id,
    totalAmount: order.totalAmount,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    paymentReference: order.paymentReference,
    inventoryReservationStatus: order.inventoryReservationStatus,
    inventoryReservationExpiresAt: order.inventoryReservationExpiresAt,
    paymentReconciliationRequired: order.paymentReconciliationRequired,
    paystackTransactionId: order.paystackTransactionId,
  };
}

const fakePrisma = {
  order: {
    async findUnique({ where }) {
      if (!order) return null;
      if (where.id && where.id !== order.id) return null;
      if (Object.hasOwn(where, "paymentReference") && where.paymentReference !== order.paymentReference) return null;
      return selectedOrder();
    },
    async updateMany({ where, data }) {
      if (failTransaction) throw new Error("simulated database outage");
      if (!matchesOrder(where)) return { count: 0 };
      Object.assign(order, data);
      return { count: 1 };
    },
  },
  async $transaction(callback) {
    if (failTransaction) throw new Error("simulated database outage");
    return callback(fakePrisma);
  },
};

function sign(raw) {
  return createHmac("sha512", secret).update(raw).digest("hex");
}

function event(data = {}) {
  return JSON.stringify({
    event: "charge.success",
    data: { status: "success", reference, amount: totalAmount, currency: "NGN", ...data },
  });
}

async function sendWebhook(raw, signature = sign(raw)) {
  const headers = { "content-type": "application/json" };
  if (signature !== null) headers["x-paystack-signature"] = signature;
  return fetch(`${baseUrl}/api/payments/webhook`, { method: "POST", headers, body: raw });
}

before(async () => {
  previousSecret = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = secret;

  const prismaPath = require.resolve("../services/prisma");
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };

  const paystackPath = require.resolve("../services/paystackService");
  require.cache[paystackPath] = {
    id: paystackPath,
    filename: paystackPath,
    loaded: true,
    exports: {
      async verifyTransaction() {
        if (!providerVerification) throw new Error("Unexpected provider verification call in test.");
        return providerVerification;
      },
      PaystackServiceError: class PaystackServiceError extends Error {},
    },
  };

  const app = require(path.resolve(__dirname, "../server"));
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  if (previousSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY;
  else process.env.PAYSTACK_SECRET_KEY = previousSecret;
});

beforeEach(() => {
  order = freshOrder();
  failTransaction = false;
  providerVerification = null;
});

test("valid signed charge.success settles the matching order", async () => {
  order = freshOrder();
  const response = await sendWebhook(event());
  assert.equal(response.status, 200);
  assert.equal(order.paymentStatus, "success");
  assert.equal(order.orderStatus, "paid");
  assert.equal(order.inventoryReservationStatus, "committed");
});

test("invalid and missing signatures are rejected without changing the order", async () => {
  order = freshOrder();
  const raw = event();
  const invalid = await sendWebhook(raw, "0".repeat(128));
  assert.equal(invalid.status, 401);
  assert.equal(order.paymentStatus, "pending");

  const missing = await sendWebhook(raw, null);
  assert.equal(missing.status, 401);
  assert.equal(order.orderStatus, "payment_pending");
});

test("malformed JSON is rejected without changing the order", async () => {
  order = freshOrder();
  const malformed = "{";
  const response = await sendWebhook(malformed, sign(malformed));
  assert.equal(response.status, 400);
  assert.equal(order.paymentStatus, "pending");
});

test("unknown reference is acknowledged without modifying an order", async () => {
  order = freshOrder();
  const response = await sendWebhook(event({ reference: "unknown-reference" }));
  assert.equal(response.status, 200);
  assert.equal(order.paymentStatus, "pending");
});

test("amount and currency mismatches are acknowledged without settlement", async () => {
  order = freshOrder();
  const amount = await sendWebhook(event({ amount: totalAmount + 100 }));
  assert.equal(amount.status, 200);
  assert.equal(order.paymentStatus, "pending");

  const currency = await sendWebhook(event({ currency: "USD" }));
  assert.equal(currency.status, 200);
  assert.equal(order.orderStatus, "payment_pending");
});

test("non-success charge status and unsupported events do not change order state", async () => {
  order = freshOrder();
  const unsuccessfulRaw = JSON.stringify({ event: "charge.success", data: { status: "pending", reference, amount: totalAmount, currency: "NGN" } });
  const unsuccessful = await sendWebhook(unsuccessfulRaw);
  assert.equal(unsuccessful.status, 200);

  const unsupportedRaw = JSON.stringify({ event: "transfer.success", data: {} });
  const unsupported = await sendWebhook(unsupportedRaw);
  assert.equal(unsupported.status, 200);
  assert.equal(order.paymentStatus, "pending");
});

test("duplicate webhook delivery is idempotent", async () => {
  order = freshOrder();
  assert.equal((await sendWebhook(event())).status, 200);
  assert.equal((await sendWebhook(event())).status, 200);
  assert.equal(order.paymentStatus, "success");
  assert.equal(order.orderStatus, "paid");
  assert.equal(order.inventoryReservationStatus, "committed");
});

test("late successful webhook after reservation release is recorded, not marked paid", async () => {
  order = freshOrder();
  order.inventoryReservationStatus = "released";
  order.paymentStatus = "failed";
  const response = await sendWebhook(event({ id: 4521 }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.reconciliationRequired, true);
  assert.equal(order.paymentStatus, "failed");
  assert.equal(order.orderStatus, "payment_pending");
  assert.equal(order.paymentReconciliationRequired, true);
  assert.equal(order.paystackTransactionId, "4521");
});

test("webhook first then browser verification remains paid", async () => {
  order = freshOrder();
  assert.equal((await sendWebhook(event())).status, 200);
  const response = await fetch(`${baseUrl}/api/payments/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reference }),
  });
  assert.equal(response.status, 200);
  assert.equal(order.paymentStatus, "success");
});

test("browser verification first then webhook remains paid", async () => {
  order = freshOrder();
  providerVerification = { reference, amount: totalAmount, currency: "NGN", status: "success", transactionId: 42 };
  const verified = await fetch(`${baseUrl}/api/payments/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reference }),
  });
  assert.equal(verified.status, 200);
  assert.equal(order.paymentStatus, "success");
  assert.equal((await sendWebhook(event())).status, 200);
  assert.equal(order.orderStatus, "paid");
});

test("transient database failures return retryable 5xx", async () => {
  order = freshOrder();
  failTransaction = true;
  const response = await sendWebhook(event());
  assert.equal(response.status, 500);
  assert.equal(order.paymentStatus, "pending");
});
