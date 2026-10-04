const { after, before, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");

let db;
let idCounter;
let transactionTail;
let initializeCalls;
let verifyResult;
let initializeFailure;
let prisma;
let inventoryService;
let paymentService;
let orderService;
let PaystackServiceError;

function clone(value) {
  return structuredClone(value);
}

function seedState() {
  db = { variants: new Map(), orders: new Map() };
  idCounter = 0;
  transactionTail = Promise.resolve();
  initializeCalls = 0;
  verifyResult = null;
  initializeFailure = null;
}

function matches(actual, expected) {
  if (expected && typeof expected === "object" && !(expected instanceof Date)) {
    if (Object.hasOwn(expected, "in") && !expected.in.includes(actual)) return false;
    if (Object.hasOwn(expected, "not") && expected.not === actual) return false;
    if (Object.hasOwn(expected, "gte") && (actual == null || !(actual >= expected.gte))) return false;
    if (Object.hasOwn(expected, "lte") && (actual == null || !(actual <= expected.lte))) return false;
    return true;
  }
  if (expected instanceof Date) return actual instanceof Date && actual.getTime() === expected.getTime();
  return actual === expected;
}

function orderMatches(order, where) {
  if (!order) return false;
  for (const [key, expected] of Object.entries(where)) {
    if (key === "product") {
      if (expected.is?.active !== undefined && order.product?.active !== expected.is.active) return false;
    } else if (!matches(order[key], expected)) {
      return false;
    }
  }
  return true;
}

function variantMatches(variant, where) {
  if (!variant) return false;
  for (const [key, expected] of Object.entries(where)) {
    if (key === "product") {
      if (expected.is?.active !== undefined && variant.product.active !== expected.is.active) return false;
    } else if (!matches(variant[key], expected)) {
      return false;
    }
  }
  return true;
}

const client = {
  order: {
    async findUnique({ where }) {
      const order = [...db.orders.values()].find((item) =>
        (where.id === undefined || item.id === where.id) &&
        (where.paymentReference === undefined || item.paymentReference === where.paymentReference),
      );
      return order ? clone(order) : null;
    },
    async findMany({ where = {}, orderBy } = {}) {
      let orders = [...db.orders.values()].filter((order) => orderMatches(order, where));
      if (orderBy?.id === "asc") orders = orders.sort((a, b) => a.id.localeCompare(b.id));
      return clone(orders.map(({ id }) => ({ id })));
    },
    async updateMany({ where, data }) {
      const order = db.orders.get(where.id);
      if (!orderMatches(order, where)) return { count: 0 };
      Object.assign(order, data);
      return { count: 1 };
    },
    async create({ data }) {
      const id = `created-order-${++idCounter}`;
      const { items, ...fields } = data;
      const order = {
        id,
        ...clone(fields),
        paymentReference: null,
        inventoryReservationStatus: "none",
        inventoryReservationExpiresAt: null,
        paymentReconciliationRequired: false,
        paystackTransactionId: null,
        items: clone(items.create),
      };
      db.orders.set(id, order);
      return clone(order);
    },
  },
  productVariant: {
    async findMany({ where }) {
      return [...db.variants.values()]
        .filter((variant) => where.id.in.includes(variant.id))
        .map(clone);
    },
    async updateMany({ where, data }) {
      const variant = db.variants.get(where.id);
      if (!variantMatches(variant, where)) return { count: 0 };
      if (data.stock?.decrement !== undefined) variant.stock -= data.stock.decrement;
      else if (data.stock?.increment !== undefined) variant.stock += data.stock.increment;
      return { count: 1 };
    },
  },
  async $transaction(callback) {
    let release;
    const previous = transactionTail;
    transactionTail = new Promise((resolve) => { release = resolve; });
    await previous;
    const beforeState = clone(db);
    try {
      return await callback(client);
    } catch (error) {
      db = beforeState;
      throw error;
    } finally {
      release();
    }
  },
};

function addVariant({ id, stock, active = true, productActive = true }) {
  db.variants.set(id, {
    id,
    stock,
    active,
    size: "M",
    color: "Black",
    price: 1000,
    product: { active: productActive, name: `Product ${id}` },
  });
}

function addOrder({
  id = "order-a",
  items = [{ productVariantId: 1, quantity: 1 }],
  orderStatus = "payment_pending",
  paymentStatus = "pending",
  inventoryReservationStatus = "none",
  inventoryReservationExpiresAt = null,
  paymentReference = "ref-order-a",
  paymentReconciliationRequired = false,
  totalAmount = 1000,
} = {}) {
  db.orders.set(id, {
    id,
    customerEmail: "customer@example.test",
    totalAmount,
    orderStatus,
    paymentStatus,
    paymentReference,
    inventoryReservationStatus,
    inventoryReservationExpiresAt,
    paymentReconciliationRequired,
    paystackTransactionId: null,
    items: clone(items),
  });
}

function newPaymentRef(orderId = "order-a") {
  return db.orders.get(orderId).paymentReference;
}

before(() => {
  const prismaPath = require.resolve("../services/prisma");
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: client };
  const paystackPath = require.resolve("../services/paystackService");
  require.cache[paystackPath] = {
    id: paystackPath,
    filename: paystackPath,
    loaded: true,
    exports: {
      PaystackServiceError: class PaystackStubError extends Error {
        constructor(message, { status = 502, retryable = false } = {}) {
          super(message);
          this.status = status;
          this.retryable = retryable;
        }
      },
      async initializeTransaction({ reference }) {
        initializeCalls += 1;
        if (initializeFailure) throw initializeFailure;
        return { reference, authorizationUrl: "https://checkout.paystack.com/test" };
      },
      async verifyTransaction(reference) {
        if (!verifyResult) throw new Error("Unexpected provider verification call.");
        return { reference, ...verifyResult };
      },
    },
  };
  PaystackServiceError = require(paystackPath).PaystackServiceError;
  inventoryService = require("../services/inventoryService");
  paymentService = require("../services/paymentService");
  orderService = require("../services/orderService");
  prisma = client;
});

beforeEach(seedState);

after(() => {
  delete require.cache[require.resolve("../services/prisma")];
  delete require.cache[require.resolve("../services/paystackService")];
});

test("reserves exact stock and deducts it once", async () => {
  addVariant({ id: 1, stock: 2 });
  addOrder({ items: [{ productVariantId: 1, quantity: 2 }] });
  const result = await prisma.$transaction((tx) => inventoryService.reserveOrderInventory(tx, "order-a"));
  assert.equal(result.status, "reserved");
  assert.equal(db.variants.get(1).stock, 0);
  assert.equal(db.orders.get("order-a").inventoryReservationStatus, "reserved");
});

test("rejects insufficient stock without partial reservation", async () => {
  addVariant({ id: 1, stock: 1 });
  addOrder({ items: [{ productVariantId: 1, quantity: 2 }] });
  await assert.rejects(
    prisma.$transaction((tx) => inventoryService.reserveOrderInventory(tx, "order-a")),
    (error) => error.code === "inventory_unavailable" && error.status === 409,
  );
  assert.equal(db.variants.get(1).stock, 1);
  assert.equal(db.orders.get("order-a").inventoryReservationStatus, "none");
});

test("rejects inactive variants and inactive products", async () => {
  addVariant({ id: 1, stock: 2, active: false });
  addOrder();
  await assert.rejects(prisma.$transaction((tx) => inventoryService.reserveOrderInventory(tx, "order-a")), /available stock/);
  assert.equal(db.variants.get(1).stock, 2);

  seedState();
  addVariant({ id: 1, stock: 2, productActive: false });
  addOrder();
  await assert.rejects(prisma.$transaction((tx) => inventoryService.reserveOrderInventory(tx, "order-a")), /available stock/);
  assert.equal(db.variants.get(1).stock, 2);
});

test("aggregates duplicate variant lines and reserves multiple variants", async () => {
  addVariant({ id: 1, stock: 2 });
  addVariant({ id: 2, stock: 3 });
  addOrder({ items: [
    { productVariantId: 2, quantity: 2 },
    { productVariantId: 1, quantity: 1 },
    { productVariantId: 1, quantity: 1 },
  ] });
  await prisma.$transaction((tx) => inventoryService.reserveOrderInventory(tx, "order-a"));
  assert.equal(db.variants.get(1).stock, 0);
  assert.equal(db.variants.get(2).stock, 1);
});

test("rolls back all variants when a later line cannot reserve", async () => {
  addVariant({ id: 1, stock: 2 });
  addVariant({ id: 2, stock: 0 });
  addOrder({ items: [
    { productVariantId: 1, quantity: 1 },
    { productVariantId: 2, quantity: 1 },
  ] });
  await assert.rejects(prisma.$transaction((tx) => inventoryService.reserveOrderInventory(tx, "order-a")));
  assert.equal(db.variants.get(1).stock, 2);
  assert.equal(db.orders.get("order-a").inventoryReservationStatus, "none");
});

test("only one concurrent order reserves the final unit", async () => {
  addVariant({ id: 1, stock: 1 });
  addOrder({ id: "order-a" });
  addOrder({ id: "order-b", paymentReference: "ref-order-b" });
  const attempts = await Promise.allSettled([
    prisma.$transaction((tx) => inventoryService.reserveOrderInventory(tx, "order-a")),
    prisma.$transaction((tx) => inventoryService.reserveOrderInventory(tx, "order-b")),
  ]);
  assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((result) => result.status === "rejected").length, 1);
  assert.equal(db.variants.get(1).stock, 0);
});

test("payment initialization reserves before calling Paystack", async () => {
  addVariant({ id: 1, stock: 1 });
  addOrder({ paymentReference: null });
  const payment = await paymentService.initializePayment("order-a");
  assert.equal(initializeCalls, 1);
  assert.equal(db.variants.get(1).stock, 0);
  assert.equal(db.orders.get("order-a").inventoryReservationStatus, "reserved");
  assert.equal(payment.paymentStatus, "pending");
});

test("reservation conflict prevents Paystack initialization", async () => {
  addVariant({ id: 1, stock: 0 });
  addOrder({ paymentReference: null });
  await assert.rejects(
    paymentService.initializePayment("order-a"),
    (error) => error.code === "inventory_unavailable" && error.status === 409,
  );
  assert.equal(initializeCalls, 0);
  assert.equal(db.orders.get("order-a").paymentReference, null);
});

test("Paystack initialization failure releases inventory and permits retry", async () => {
  addVariant({ id: 1, stock: 1 });
  addOrder({ paymentReference: null });
  initializeFailure = new PaystackServiceError("provider unavailable", { status: 502 });
  await assert.rejects(paymentService.initializePayment("order-a"), /provider unavailable/);
  assert.equal(db.variants.get(1).stock, 1);
  assert.equal(db.orders.get("order-a").inventoryReservationStatus, "released");
  assert.equal(db.orders.get("order-a").paymentStatus, "failed");

  initializeFailure = null;
  const payment = await paymentService.initializePayment("order-a");
  assert.equal(initializeCalls, 2);
  assert.equal(db.variants.get(1).stock, 0);
  assert.equal(db.orders.get("order-a").inventoryReservationStatus, "reserved");
  assert.equal(payment.paymentStatus, "pending");
});

test("successful provider settlement commits reservation without another deduction", async () => {
  addVariant({ id: 1, stock: 0 });
  addOrder({ inventoryReservationStatus: "reserved", inventoryReservationExpiresAt: new Date(Date.now() + 60_000) });
  const result = await paymentService.settlePayment({ reference: newPaymentRef(), amount: 1000, currency: "NGN", transactionId: 71 });
  assert.equal(result.status, "settled");
  assert.equal(db.orders.get("order-a").inventoryReservationStatus, "committed");
  assert.equal(db.orders.get("order-a").paymentStatus, "success");
  assert.equal(db.orders.get("order-a").orderStatus, "paid");
  assert.equal(db.variants.get(1).stock, 0);
});

test("duplicate settlement and browser/webhook race are idempotent", async () => {
  addVariant({ id: 1, stock: 0 });
  addOrder({ inventoryReservationStatus: "reserved" });
  const settle = () => paymentService.settlePayment({ reference: newPaymentRef(), amount: 1000, currency: "NGN" });
  const results = await Promise.all([settle(), settle()]);
  assert.deepEqual(results.map((result) => result.status).sort(), ["already_settled", "settled"]);
  assert.equal(db.variants.get(1).stock, 0);
  assert.equal(db.orders.get("order-a").inventoryReservationStatus, "committed");
});

test("successful browser verification commits reservation", async () => {
  addVariant({ id: 1, stock: 0 });
  addOrder({ inventoryReservationStatus: "reserved" });
  verifyResult = { amount: 1000, currency: "NGN", status: "success", transactionId: 72 };
  const result = await paymentService.verifyPayment(newPaymentRef());
  assert.equal(result.verified, true);
  assert.equal(db.orders.get("order-a").inventoryReservationStatus, "committed");
  assert.equal(db.variants.get(1).stock, 0);
});

test("failed payment releases stock once and retry reserves it again", async () => {
  addVariant({ id: 1, stock: 0 });
  addOrder({ inventoryReservationStatus: "reserved" });
  verifyResult = { amount: 1000, currency: "NGN", status: "abandoned" };
  await assert.rejects(paymentService.verifyPayment(newPaymentRef()), (error) => error.payment?.paymentStatus === "failed");
  assert.equal(db.variants.get(1).stock, 1);
  const failedReference = newPaymentRef();

  await assert.rejects(paymentService.verifyPayment(failedReference), (error) => error.payment?.paymentStatus === "failed");
  assert.equal(db.variants.get(1).stock, 1);
  verifyResult = null;
  await paymentService.initializePayment("order-a");
  assert.equal(db.variants.get(1).stock, 0);
  assert.equal(db.orders.get("order-a").inventoryReservationStatus, "reserved");
  assert.notEqual(newPaymentRef(), failedReference);
});

test("retry fails before Paystack when another order has taken the stock", async () => {
  addVariant({ id: 1, stock: 0 });
  addOrder({ inventoryReservationStatus: "released", paymentStatus: "failed" });
  addOrder({ id: "order-b", paymentReference: "ref-order-b", inventoryReservationStatus: "reserved" });
  await assert.rejects(paymentService.initializePayment("order-a"), (error) => error.code === "inventory_unavailable");
  assert.equal(initializeCalls, 0);
  assert.equal(db.variants.get(1).stock, 0);
});

test("expired reservations release stock and repeat expiry processing is harmless", async () => {
  addVariant({ id: 1, stock: 0 });
  addOrder({
    inventoryReservationStatus: "reserved",
    inventoryReservationExpiresAt: new Date(Date.now() - 1_000),
  });
  assert.deepEqual(await inventoryService.releaseExpiredReservations(), { scanned: 1, released: 1 });
  assert.equal(db.variants.get(1).stock, 1);
  assert.equal(db.orders.get("order-a").inventoryReservationStatus, "released");
  assert.deepEqual(await inventoryService.releaseExpiredReservations(), { scanned: 0, released: 0 });
  assert.equal(db.variants.get(1).stock, 1);
});

test("late successful payment after release is recorded for reconciliation, not paid", async () => {
  addVariant({ id: 1, stock: 0 });
  addOrder({
    inventoryReservationStatus: "released",
    inventoryReservationExpiresAt: null,
  });
  const result = await paymentService.settlePayment({
    reference: newPaymentRef(),
    amount: 1000,
    currency: "NGN",
    transactionId: 9876,
  });
  assert.equal(result.status, "reservation_released");
  assert.equal(db.orders.get("order-a").paymentReconciliationRequired, true);
  assert.equal(db.orders.get("order-a").paystackTransactionId, "9876");
  assert.equal(db.orders.get("order-a").paymentStatus, "pending");
  assert.notEqual(db.orders.get("order-a").orderStatus, "paid");
  assert.equal(db.variants.get(1).stock, 0);
});

test("committed reservations cannot be released", async () => {
  addVariant({ id: 1, stock: 0 });
  addOrder({ inventoryReservationStatus: "committed", paymentStatus: "success", orderStatus: "paid" });
  const result = await prisma.$transaction((tx) => inventoryService.releaseOrderReservation(tx, "order-a"));
  assert.equal(result.status, "committed");
  assert.equal(db.variants.get(1).stock, 0);
});

test("order creation retains its active and stock validation", async () => {
  addVariant({ id: 1, stock: 1 });
  const created = await orderService.createOrder({
    items: [{ productVariantId: 1, quantity: 2 }],
    customer: { email: "buyer@example.test", firstName: "A", lastName: "B", phone: "+23412345678" },
    shipping: { address: "Street", city: "Lagos", state: "Lagos", country: "Nigeria" },
  }).catch((error) => error);
  assert.equal(created.status, 409);
  assert.equal(db.orders.size, 0);
});

test("order creation still creates a pending order without deducting stock", async () => {
  addVariant({ id: 1, stock: 3 });
  const created = await orderService.createOrder({
    items: [{ productVariantId: 1, quantity: 2 }],
    customer: { email: "buyer@example.test", firstName: "A", lastName: "B", phone: "+23412345678" },
    shipping: { address: "Street", city: "Lagos", state: "Lagos", country: "Nigeria" },
  });
  assert.equal(created.orderStatus, "pending");
  assert.equal(created.paymentStatus, "pending");
  assert.equal(db.variants.get(1).stock, 3);
});
