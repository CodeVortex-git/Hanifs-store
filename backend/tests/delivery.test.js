const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

let db;
let nextId;
let server;
let baseUrl;
let fakePrisma;
let customerCookie;
let adminCookie;
let customerCsrf;
let adminCsrf;
let customerId;
const customerToken = "delivery-customer-session";
const adminToken = "delivery-admin-session";

function resetDatabase() {
  db = {
    users: new Map(),
    admins: new Map(),
    sessions: new Map(),
    adminSessions: new Map(),
    orders: new Map(),
    variants: new Map(),
    deliveries: new Map(),
    history: new Map(),
  };
  nextId = 0;
}

function deliveryView(delivery, includeHistory = false) {
  if (!delivery) return null;
  const result = { ...delivery };
  if (includeHistory) {
    result.statusHistory = [...db.history.values()]
      .filter((entry) => entry.deliveryId === delivery.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((entry) => ({
        ...entry,
        admin: db.admins.get(entry.adminId) || null,
      }));
  }
  return result;
}

function selectDelivery(delivery, select) {
  if (!delivery) return null;
  const result = {};
  for (const key of Object.keys(select || {})) {
    if (key === "statusHistory") result.statusHistory = deliveryView(delivery, true).statusHistory;
    else result[key] = delivery[key];
  }
  return result;
}

function makePrisma() {
  return {
    user: {
      async findUnique({ where }) { return [...db.users.values()].find((user) => user.email === where.email) || null; },
    },
    admin: {
      async findUnique({ where }) { return [...db.admins.values()].find((admin) => admin.email === where.email) || null; },
    },
    session: {
      async findUnique({ where }) {
        const session = [...db.sessions.values()].find((item) => item.tokenHash === where.tokenHash);
        return session ? { ...session, user: db.users.get(session.userId) } : null;
      },
    },
    adminSession: {
      async findUnique({ where }) {
        const session = [...db.adminSessions.values()].find((item) => item.tokenHash === where.tokenHash);
        return session ? { ...session, admin: db.admins.get(session.adminId) } : null;
      },
    },
    order: {
      async findMany() { return []; },
      async findUnique({ where, select }) {
        const order = db.orders.get(where.id);
        if (!order) return null;
        if (!select?.delivery) return order;
        return { id: order.id, delivery: selectDelivery(db.deliveries.get(order.deliveryId), select.delivery.select) };
      },
      async findFirst({ where, select }) {
        const order = db.orders.get(where.id);
        if (!order || order.userId !== where.userId) return null;
        const delivery = db.deliveries.get(order.deliveryId);
        return { delivery: selectDelivery(delivery, select.delivery.select) };
      },
      async create({ data, select }) {
        const id = `order-${++nextId}`;
        const deliveryId = `delivery-${++nextId}`;
        if ([...db.deliveries.values()].some((item) => item.orderId === id)) {
          const error = new Error("Unique constraint failed");
          error.code = "P2002";
          throw error;
        }
        const delivery = {
          id: deliveryId,
          orderId: id,
          deliveryFee: data.delivery.create.deliveryFee,
          status: data.delivery.create.status,
          provider: data.delivery.create.provider,
          trackingNumber: null,
          reference: null,
          estimatedDeliveryDate: null,
          dispatchedAt: null,
          deliveredAt: null,
          failedReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const order = {
          id,
          ...data,
          deliveryId,
          items: data.items.create,
          createdAt: new Date(),
        };
        db.deliveries.set(deliveryId, delivery);
        db.orders.set(id, order);
        const result = {};
        for (const [key, value] of Object.entries(select || {})) {
          if (key === "delivery") result.delivery = selectDelivery(delivery, value.select);
          else if (key === "items") result.items = order.items;
          else result[key] = order[key];
        }
        return result;
      },
    },
    productVariant: {
      async findMany({ where }) {
        return where.id.in.map((id) => db.variants.get(id)).filter(Boolean);
      },
    },
    delivery: {
      async updateMany({ where, data }) {
        const delivery = db.deliveries.get(where.id);
        if (!delivery || delivery.status !== where.status) return { count: 0 };
        Object.assign(delivery, data, { updatedAt: new Date() });
        return { count: 1 };
      },
      async findUnique({ where, select }) {
        return selectDelivery(db.deliveries.get(where.id), select);
      },
    },
    deliveryStatusHistory: {
      async create({ data }) {
        const entry = { id: `delivery-history-${++nextId}`, createdAt: new Date(), ...data };
        db.history.set(entry.id, entry);
        return entry;
      },
    },
    async $transaction(callback) {
      const beforeState = structuredClone(db);
      try {
        return await callback(fakePrisma);
      } catch (error) {
        db = beforeState;
        throw error;
      }
    },
  };
}

function addOrder({ id, userId = null, status = "pending" }) {
  const deliveryId = `delivery-${id}`;
  db.orders.set(id, { id, userId, deliveryId });
  db.deliveries.set(deliveryId, {
    id: deliveryId,
    orderId: id,
    deliveryFee: 150_000,
    status,
    provider: "Local courier",
    trackingNumber: null,
    reference: null,
    estimatedDeliveryDate: null,
    dispatchedAt: null,
    deliveredAt: null,
    failedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function cookie(name, token) {
  return `${name}=${encodeURIComponent(token)}`;
}

async function request(route, { method = "GET", body, cookieHeader, csrf, origin = "http://127.0.0.1:8080" } = {}) {
  const headers = {};
  if (origin) headers.Origin = origin;
  if (cookieHeader) headers.Cookie = cookieHeader;
  if (csrf) headers["X-CSRF-Token"] = csrf;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`${baseUrl}${route}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

before(async () => {
  resetDatabase();
  const prismaPath = require.resolve("../services/prisma");
  fakePrisma = makePrisma();
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };
  const authService = require("../services/authService");
  const adminAuthService = require("../services/adminAuthService");
  const { getAuthCookieConfig } = require("../config/authCookie");
  const { getAdminAuthCookieConfig } = require("../config/adminAuthCookie");
  customerId = "customer-delivery-1";
  const customer = { id: customerId, email: "delivery-customer@example.test", firstName: "Della", lastName: "Customer", phone: "08000000000", isActive: true };
  const admin = { id: "admin-delivery-1", email: "delivery-admin@example.test", displayName: "Delivery Admin", isActive: true };
  db.users.set(customer.id, customer);
  db.admins.set(admin.id, admin);
  customerCsrf = "customer-delivery-csrf-token";
  adminCsrf = "admin-delivery-csrf-token";
  db.sessions.set("customer-session", {
    id: "customer-session", tokenHash: authService.hashSessionToken(customerToken), csrfToken: customerCsrf,
    userId: customer.id, expiresAt: new Date(Date.now() + 60_000), revokedAt: null,
  });
  db.adminSessions.set("admin-session", {
    id: "admin-session", tokenHash: adminAuthService.hashAdminSessionToken(adminToken), csrfToken: adminCsrf,
    adminId: admin.id, expiresAt: new Date(Date.now() + 60_000), revokedAt: null,
  });
  customerCookie = cookie(getAuthCookieConfig().name, customerToken);
  adminCookie = cookie(getAdminAuthCookieConfig().name, adminToken);
  addOrder({ id: "customer-order", userId: customer.id });
  addOrder({ id: "other-customer-order", userId: "another-customer" });
  addOrder({ id: "guest-order" });

  const app = require(path.resolve(__dirname, "../server"));
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  db.variants.set(1, {
    id: 1, size: "M", color: "Black", price: 250_000, stock: 5, active: true,
    product: { name: "Test product", active: true },
  });
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  delete require.cache[require.resolve("../services/prisma")];
});

test("server delivery quote applies Lagos and other Nigerian state fees and rejects invalid destinations", async () => {
  const lagos = await request("/api/orders/delivery-quote?state=Lagos&country=Nigeria");
  const lagosBody = await lagos.json();
  assert.equal(lagos.status, 200);
  assert.equal(lagosBody.deliveryAmount, 150_000);
  const kano = await request("/api/orders/delivery-quote?state=Kano&country=Nigeria");
  assert.equal((await kano.json()).deliveryAmount, 350_000);
  const invalid = await request("/api/orders/delivery-quote?state=Atlantis&country=Nigeria");
  assert.equal(invalid.status, 400);
});

test("order creation rejects client pricing tampering and creates one delivery with an authoritative total", async () => {
  const base = {
    customer: { email: "guest@example.test", firstName: "Guest", lastName: "Buyer", phone: "08000000000" },
    shipping: { address: "1 Main Road", city: "Lagos", state: "Lagos", country: "Nigeria" },
    items: [{ productVariantId: 1, quantity: 1 }],
  };
  const tampered = await request("/api/orders", { method: "POST", body: { ...base, deliveryAmount: 0, subtotal: 1, totalAmount: 1 } });
  assert.equal(tampered.status, 400);
  assert.equal(db.orders.size, 3);
  const response = await request("/api/orders", { method: "POST", body: base });
  const payload = await response.json();
  assert.equal(response.status, 201);
  assert.equal(payload.order.subtotal, 250_000);
  assert.equal(payload.order.deliveryAmount, 150_000);
  assert.equal(payload.order.totalAmount, 400_000);
  assert.equal([...db.deliveries.values()].filter((delivery) => delivery.orderId === payload.order.id).length, 1);
  const nationwide = await request("/api/orders", {
    method: "POST",
    body: {
      ...base,
      customer: { ...base.customer, email: "nationwide@example.test" },
      shipping: { ...base.shipping, state: "Kano" },
    },
  });
  const nationwideOrder = (await nationwide.json()).order;
  assert.equal(nationwideOrder.deliveryAmount, 350_000);
  assert.equal(nationwideOrder.totalAmount, 600_000);
  const schema = fs.readFileSync(path.resolve(__dirname, "../prisma/schema.prisma"), "utf8");
  assert.match(schema, /model Delivery \{[\s\S]*?orderId\s+String\s+@unique/);
});

test("authenticated customers can read only their own delivery; guest and other-customer orders remain private", async () => {
  const own = await request("/api/orders/customer-order/delivery", { cookieHeader: customerCookie });
  assert.equal(own.status, 200);
  assert.equal((await own.json()).delivery.status, "pending");
  const another = await request("/api/orders/other-customer-order/delivery", { cookieHeader: customerCookie });
  assert.equal(another.status, 404);
  const guest = await request("/api/orders/guest-order/delivery", { cookieHeader: customerCookie });
  assert.equal(guest.status, 404);
  const anonymous = await request("/api/orders/customer-order/delivery");
  assert.equal(anonymous.status, 401);
});

test("admin delivery reads and mutations require admin authentication, Origin, and CSRF", async () => {
  const noAuth = await request("/api/admin/orders/customer-order/delivery");
  assert.equal(noAuth.status, 401);
  const read = await request("/api/admin/orders/customer-order/delivery", { cookieHeader: adminCookie });
  assert.equal(read.status, 200);
  const noCsrf = await request("/api/admin/orders/customer-order/delivery", {
    method: "PATCH", cookieHeader: adminCookie, body: { status: "ready_for_dispatch" }, csrf: "",
  });
  assert.equal(noCsrf.status, 403);
  const wrongCsrf = await request("/api/admin/orders/customer-order/delivery", {
    method: "PATCH", cookieHeader: adminCookie, body: { status: "ready_for_dispatch" }, csrf: "wrong-token",
  });
  assert.equal(wrongCsrf.status, 403);
  const wrongOrigin = await request("/api/admin/orders/customer-order/delivery", {
    method: "PATCH", cookieHeader: adminCookie, body: { status: "ready_for_dispatch" }, csrf: adminCsrf, origin: "https://untrusted.example",
  });
  assert.equal(wrongOrigin.status, 403);
  assert.equal(db.deliveries.get("delivery-customer-order").status, "pending");
});

test("legal delivery transitions are atomic with immutable history", async () => {
  const first = await request("/api/admin/orders/customer-order/delivery", {
    method: "PATCH", cookieHeader: adminCookie, csrf: adminCsrf,
    body: { status: "ready_for_dispatch", provider: "Dispatch Co", trackingNumber: "TRACK-1", reference: "REF-1", reason: "Packed" },
  });
  assert.equal(first.status, 200);
  assert.equal((await first.json()).delivery.status, "ready_for_dispatch");
  let history = [...db.history.values()].filter((entry) => entry.deliveryId === "delivery-customer-order");
  assert.equal(history.length, 1);
  assert.equal(history[0].previousStatus, "pending");
  assert.equal(history[0].newStatus, "ready_for_dispatch");
  assert.equal(history[0].adminId, "admin-delivery-1");
  assert.equal(history[0].reason, "Packed");

  const second = await request("/api/admin/orders/customer-order/delivery", {
    method: "PATCH", cookieHeader: adminCookie, csrf: adminCsrf, body: { status: "out_for_delivery" },
  });
  assert.equal(second.status, 200);
  const delivered = await request("/api/admin/orders/customer-order/delivery", {
    method: "PATCH", cookieHeader: adminCookie, csrf: adminCsrf, body: { status: "delivered" },
  });
  assert.equal(delivered.status, 200);
  assert.ok(db.deliveries.get("delivery-customer-order").deliveredAt instanceof Date);
  history = [...db.history.values()].filter((entry) => entry.deliveryId === "delivery-customer-order");
  assert.equal(history.length, 3);
});

test("backward, arbitrary, and no-op transitions are rejected without history", async () => {
  addOrder({ id: "transition-order", status: "ready_for_dispatch" });
  const initialHistoryCount = db.history.size;
  for (const status of ["pending", "delivered", "ready_for_dispatch"]) {
    const response = await request("/api/admin/orders/transition-order/delivery", {
      method: "PATCH", cookieHeader: adminCookie, csrf: adminCsrf, body: { status },
    });
    assert.equal(response.status, 409);
  }
  const arbitrary = await request("/api/admin/orders/transition-order/delivery", {
    method: "PATCH", cookieHeader: adminCookie, csrf: adminCsrf, body: { status: "cancelled" },
  });
  assert.equal(arbitrary.status, 400);
  assert.equal(db.history.size, initialHistoryCount);
});

test("concurrent administrators cannot both advance the same delivery status", async () => {
  addOrder({ id: "concurrent-order" });
  const mutate = () => request("/api/admin/orders/concurrent-order/delivery", {
    method: "PATCH", cookieHeader: adminCookie, csrf: adminCsrf, body: { status: "ready_for_dispatch" },
  });
  const responses = await Promise.all([mutate(), mutate()]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  assert.equal([...db.history.values()].filter((entry) => entry.deliveryId === "delivery-concurrent-order").length, 1);
});

test("delivery field allowlist rejects payment, inventory, totals, ownership, and customer mutation", async () => {
  addOrder({ id: "protected-order" });
  const historyCount = db.history.size;
  const protectedFields = {
    paymentStatus: "success",
    paymentReference: "tampered",
    paystackTransactionId: "tampered",
    inventoryReservationStatus: "released",
    inventoryReservationExpiresAt: new Date().toISOString(),
    stock: 99,
    subtotal: 0,
    deliveryAmount: 0,
    totalAmount: 0,
    userId: "attacker",
    customerEmail: "attacker@example.test",
    shippingAddress: "Changed address",
  };
  const response = await request("/api/admin/orders/protected-order/delivery", {
    method: "PATCH", cookieHeader: adminCookie, csrf: adminCsrf, body: { provider: "Courier", ...protectedFields },
  });
  assert.equal(response.status, 400);
  assert.equal(db.deliveries.get("delivery-protected-order").provider, "Local courier");
  assert.equal(db.history.size, historyCount);
});

test("provider, tracking, reference, failure-reason, and reason inputs are bounded and validated", async () => {
  addOrder({ id: "validation-order", status: "out_for_delivery" });
  const oversized = await request("/api/admin/orders/validation-order/delivery", {
    method: "PATCH", cookieHeader: adminCookie, csrf: adminCsrf, body: { provider: "x".repeat(101) },
  });
  assert.equal(oversized.status, 400);
  const invalidDate = await request("/api/admin/orders/validation-order/delivery", {
    method: "PATCH", cookieHeader: adminCookie, csrf: adminCsrf, body: { estimatedDeliveryDate: "not-a-date" },
  });
  assert.equal(invalidDate.status, 400);
  const noFailureReason = await request("/api/admin/orders/validation-order/delivery", {
    method: "PATCH", cookieHeader: adminCookie, csrf: adminCsrf, body: { status: "delivery_failed" },
  });
  assert.equal(noFailureReason.status, 400);
  const failed = await request("/api/admin/orders/validation-order/delivery", {
    method: "PATCH", cookieHeader: adminCookie, csrf: adminCsrf,
    body: { status: "delivery_failed", failedReason: "Customer unavailable" },
  });
  assert.equal(failed.status, 200);
  assert.equal(db.deliveries.get("delivery-validation-order").failedReason, "Customer unavailable");
});

test("a failed history insert rolls back its delivery status update", async () => {
  addOrder({ id: "rollback-order" });
  const originalCreate = fakePrisma.deliveryStatusHistory.create;
  fakePrisma.deliveryStatusHistory.create = async () => { throw new Error("audit insert failed"); };
  try {
    const response = await request("/api/admin/orders/rollback-order/delivery", {
      method: "PATCH", cookieHeader: adminCookie, csrf: adminCsrf, body: { status: "ready_for_dispatch" },
    });
    assert.equal(response.status, 500);
    assert.equal(db.deliveries.get("delivery-rollback-order").status, "pending");
    assert.equal([...db.history.values()].some((entry) => entry.deliveryId === "delivery-rollback-order"), false);
  } finally {
    fakePrisma.deliveryStatusHistory.create = originalCreate;
  }
});
