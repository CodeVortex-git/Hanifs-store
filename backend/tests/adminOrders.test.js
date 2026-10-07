const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const db = { admins: new Map(), adminSessions: new Map(), orders: new Map(), orderStatusHistory: new Map() };
let nextId = 0;
let server;
let baseUrl;
let adminCookie;
let csrfToken;

const fakePrisma = {
  admin: {
    async findUnique({ where }) {
      return [...db.admins.values()].find((admin) => admin.email === where.email) || null;
    },
    async create({ data }) {
      const admin = { id: `admin-${++nextId}`, isActive: true, createdAt: new Date(), ...data };
      db.admins.set(admin.id, admin);
      return admin;
    },
  },
  adminSession: {
    async create({ data }) {
      const session = { id: `admin-session-${++nextId}`, createdAt: new Date(), revokedAt: null, ...data };
      db.adminSessions.set(session.id, session);
      return session;
    },
    async findUnique({ where }) {
      const session = [...db.adminSessions.values()].find((entry) => entry.tokenHash === where.tokenHash);
      return session ? { ...session, admin: db.admins.get(session.adminId) } : null;
    },
    async updateMany({ where, data }) {
      const session = db.adminSessions.get(where.id);
      if (!session) return { count: 0 };
      Object.assign(session, data);
      return { count: 1 };
    },
  },
  order: {
    async findMany({ where = {}, skip = 0, take = 20, orderBy, select }) {
      const rows = [...db.orders.values()].filter((order) => {
        if (where.orderStatus && where.orderStatus !== order.orderStatus) return false;
        if (where.paymentStatus && where.paymentStatus !== order.paymentStatus) return false;
        if (where.createdAt?.gte && order.createdAt < where.createdAt.gte) return false;
        if (where.createdAt?.lte && order.createdAt > where.createdAt.lte) return false;
        if (where.OR) {
          const match = where.OR.some((clause) => {
            if (clause.id) return order.id.toLowerCase().includes(clause.id.contains.toLowerCase());
            if (clause.customerEmail) return order.customerEmail.toLowerCase().includes(clause.customerEmail.contains.toLowerCase());
            if (clause.firstName) return order.firstName.toLowerCase().includes(clause.firstName.contains.toLowerCase());
            if (clause.lastName) return order.lastName.toLowerCase().includes(clause.lastName.contains.toLowerCase());
            return false;
          });
          if (!match) return false;
        }
        return true;
      });
      rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return rows.slice(skip, skip + take).map((order) => ({
        id: order.id,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        customerEmail: order.customerEmail,
        firstName: order.firstName,
        lastName: order.lastName,
        totalAmount: order.totalAmount,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        inventoryReservationStatus: order.inventoryReservationStatus,
        paymentReconciliationRequired: order.paymentReconciliationRequired,
      }));
    },
    async count({ where = {} }) {
      return [...db.orders.values()].filter((order) => {
        if (where.orderStatus && where.orderStatus !== order.orderStatus) return false;
        if (where.paymentStatus && where.paymentStatus !== order.paymentStatus) return false;
        if (where.createdAt?.gte && order.createdAt < where.createdAt.gte) return false;
        if (where.createdAt?.lte && order.createdAt > where.createdAt.lte) return false;
        if (where.OR) {
          const match = where.OR.some((clause) => {
            if (clause.id) return order.id.toLowerCase().includes(clause.id.contains.toLowerCase());
            if (clause.customerEmail) return order.customerEmail.toLowerCase().includes(clause.customerEmail.contains.toLowerCase());
            if (clause.firstName) return order.firstName.toLowerCase().includes(clause.firstName.contains.toLowerCase());
            if (clause.lastName) return order.lastName.toLowerCase().includes(clause.lastName.contains.toLowerCase());
            return false;
          });
          if (!match) return false;
        }
        return true;
      }).length;
    },
    async findUnique({ where, select }) {
      const order = db.orders.get(where.id);
      if (!order) return null;
      const items = order.items.map((item) => ({
        productName: item.productName,
        selectedSize: item.selectedSize,
        selectedColor: item.selectedColor,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      }));
      const statusHistory = [...db.orderStatusHistory.values()].filter((entry) => entry.orderId === order.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return {
        id: order.id,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        paymentReference: order.paymentReference,
        paymentReconciliationRequired: order.paymentReconciliationRequired,
        inventoryReservationStatus: order.inventoryReservationStatus,
        inventoryReservationExpiresAt: order.inventoryReservationExpiresAt,
        subtotal: order.subtotal,
        deliveryAmount: order.deliveryAmount,
        totalAmount: order.totalAmount,
        firstName: order.firstName,
        lastName: order.lastName,
        customerEmail: order.customerEmail,
        phone: order.phone,
        shippingAddress: order.shippingAddress,
        city: order.city,
        state: order.state,
        country: order.country,
        items,
        statusHistory: statusHistory.map((entry) => ({
          id: entry.id,
          previousStatus: entry.previousStatus,
          newStatus: entry.newStatus,
          reason: entry.reason,
          createdAt: entry.createdAt,
          admin: entry.adminId ? { id: entry.adminId, displayName: "Order Admin", email: "admin@example.test" } : null,
        })),
      };
    },
    async updateMany({ where, data }) {
      const order = db.orders.get(where.id);
      if (!order) return { count: 0 };
      if (where.orderStatus && where.orderStatus !== order.orderStatus) return { count: 0 };
      if (where.paymentStatus && where.paymentStatus !== order.paymentStatus) return { count: 0 };
      if (where.paymentReconciliationRequired !== undefined && where.paymentReconciliationRequired !== order.paymentReconciliationRequired) return { count: 0 };
      Object.assign(order, data, { updatedAt: new Date() });
      return { count: 1 };
    },
  },
  orderStatusHistory: {
    async create({ data, select }) {
      const entry = { id: `history-${++nextId}`, createdAt: new Date(), ...data };
      db.orderStatusHistory.set(entry.id, entry);
      return Object.fromEntries(Object.keys(select).map((key) => [key, entry[key]]));
    },
    async findMany({ where, orderBy, take }) {
      return [...db.orderStatusHistory.values()].filter((entry) => entry.orderId === where.orderId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, take).map((entry) => ({
        id: entry.id,
        previousStatus: entry.previousStatus,
        newStatus: entry.newStatus,
        reason: entry.reason,
        createdAt: entry.createdAt,
        admin: entry.adminId ? { id: entry.adminId, displayName: "Order Admin", email: "admin@example.test" } : null,
      }));
    },
  },
  async $transaction(callback) { return callback(fakePrisma); },
};

function addOrder(order) {
  const normalized = {
    id: order.id,
    userId: null,
    customerEmail: order.customerEmail || "customer@example.test",
    firstName: order.firstName || "Jane",
    lastName: order.lastName || "Doe",
    phone: order.phone || "08000000000",
    shippingAddress: order.shippingAddress || "1 Main Street",
    city: order.city || "Lagos",
    state: order.state || "Lagos",
    country: order.country || "NG",
    subtotal: order.subtotal ?? 1000,
    deliveryAmount: order.deliveryAmount ?? 500,
    totalAmount: order.totalAmount ?? 1500,
    orderStatus: order.orderStatus || "paid",
    paymentStatus: order.paymentStatus || "success",
    paymentReference: order.paymentReference || "ref-abc",
    inventoryReservationStatus: order.inventoryReservationStatus || "committed",
    inventoryReservationExpiresAt: order.inventoryReservationExpiresAt || null,
    paymentReconciliationRequired: !!order.paymentReconciliationRequired,
    paystackTransactionId: order.paystackTransactionId || null,
    createdAt: order.createdAt || new Date(Date.now() - 60_000),
    updatedAt: order.updatedAt || new Date(),
    items: order.items || [{ productName: "Test Item", selectedSize: "M", selectedColor: "Black", quantity: 1, unitPrice: 1000, lineTotal: 1000 }],
  };
  db.orders.set(normalized.id, normalized);
}

function cookieFrom(response) { return response.headers.get("set-cookie")?.split(";")[0] || ""; }
async function request(route, { method = "GET", body, cookie, csrf = csrfToken, origin = "http://127.0.0.1:8080" } = {}) {
  const resolvedCookie = cookie === undefined ? adminCookie : cookie;
  const headers = {};
  if (origin) headers.Origin = origin;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (resolvedCookie) headers.Cookie = resolvedCookie;
  if (csrf) headers["X-CSRF-Token"] = csrf;
  return fetch(`${baseUrl}${route}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}

before(async () => {
  const prismaPath = require.resolve("../services/prisma");
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };
  const authService = require("../services/authService");
  const app = require(path.resolve(__dirname, "../server"));
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const adminHash = await authService.hashPassword("admin order password");
  await fakePrisma.admin.create({ data: { email: "orders-admin@example.test", passwordHash: adminHash, displayName: "Orders Admin" } });
  addOrder({ id: "order-paid", customerEmail: "paid@example.test", firstName: "Pay", lastName: "D", totalAmount: 2500, orderStatus: "paid", paymentStatus: "success", paymentReference: "ref-paid", inventoryReservationStatus: "committed", deliveryAmount: 500, subtotal: 2000, items: [{ productName: "Paid Item", selectedSize: "M", selectedColor: "Black", quantity: 1, unitPrice: 2000, lineTotal: 2000 }] });
  addOrder({ id: "order-processing", customerEmail: "processing@example.test", firstName: "Proc", lastName: "Ess", totalAmount: 1500, orderStatus: "processing", paymentStatus: "success", paymentReference: "ref-process", inventoryReservationStatus: "committed", deliveryAmount: 300, subtotal: 1200, items: [{ productName: "Processing Item", selectedSize: "L", selectedColor: "White", quantity: 1, unitPrice: 1200, lineTotal: 1200 }] });
  addOrder({ id: "order-pending", customerEmail: "pending@example.test", firstName: "Pend", lastName: "Ing", totalAmount: 1800, orderStatus: "pending", paymentStatus: "pending", paymentReference: null, inventoryReservationStatus: "none", deliveryAmount: 300, subtotal: 1500, items: [{ productName: "Pending Item", selectedSize: "S", selectedColor: "Blue", quantity: 1, unitPrice: 1500, lineTotal: 1500 }] });
  addOrder({ id: "order-cancelled", customerEmail: "cancel@example.test", firstName: "Can", lastName: "Cel", totalAmount: 1700, orderStatus: "cancelled", paymentStatus: "refunded", paymentReference: "ref-cancel", inventoryReservationStatus: "none", deliveryAmount: 500, subtotal: 1200, items: [{ productName: "Cancelled Item", selectedSize: "XS", selectedColor: "Red", quantity: 1, unitPrice: 1200, lineTotal: 1200 }] });

  const login = await request("/api/admin/auth/login", { method: "POST", body: { email: "orders-admin@example.test", password: "admin order password" } });
  adminCookie = cookieFrom(login);
  const me = await request("/api/admin/auth/me", { cookie: adminCookie });
  const meBody = await me.json();
  csrfToken = meBody.csrfToken;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  delete require.cache[require.resolve("../services/prisma")];
});

test("admin order list rejects unauthenticated and customer-authenticated requests", async () => {
  const unauthenticated = await request("/api/admin/orders", { cookie: null });
  assert.equal(unauthenticated.status, 401);
  const customer = await request("/api/admin/orders", { cookie: "customerSession=test" });
  assert.equal(customer.status, 401);
});

test("admin order list accepts valid admin and supports filters", async () => {
  const response = await request("/api/admin/orders?page=1&limit=10&status=paid&paymentStatus=success&q=paid@example.test");
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.ok(Array.isArray(payload.orders));
  assert.equal(payload.pagination.total, 1);
  assert.equal(payload.orders[0].customer.email, "paid@example.test");
});

test("admin detail returns safe snapshot and excludes sensitive fields", async () => {
  const response = await request("/api/admin/orders/order-paid");
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.order.customer.email, "paid@example.test");
  assert.equal(payload.order.paymentReference, "ref-paid");
  assert.equal(payload.order.items[0].productName, "Paid Item");
  assert.equal(payload.order.customer.phone, "08000000000");
  assert.ok(!Object.hasOwn(payload.order, "session"));
});

test("paid to processing succeeds and creates exactly one history record", async () => {
  const response = await request("/api/admin/orders/order-paid/status", { method: "PATCH", body: { orderStatus: "processing", reason: "Packing now." } });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.order.orderStatus, "processing");
  assert.equal(payload.history.newStatus, "processing");
  assert.equal([...db.orderStatusHistory.values()].filter((entry) => entry.orderId === "order-paid").length, 1);
});

test("invalid transitions and no-op status updates are rejected without history", async () => {
  addOrder({ id: "order-paid-invalid", customerEmail: "invalid@example.test", firstName: "Inv", lastName: "Alid", totalAmount: 5000, orderStatus: "paid", paymentStatus: "success", paymentReference: "ref-invalid", inventoryReservationStatus: "committed", deliveryAmount: 500, subtotal: 4500, items: [{ productName: "Invalid Item", selectedSize: "XL", selectedColor: "Red", quantity: 1, unitPrice: 4500, lineTotal: 4500 }] });
  const invalid = await request("/api/admin/orders/order-paid-invalid/status", { method: "PATCH", body: { orderStatus: "shipped", reason: "Wrong route" } });
  assert.equal(invalid.status, 409);
  const noOp = await request("/api/admin/orders/order-processing/status", { method: "PATCH", body: { orderStatus: "processing", reason: "Same status" } });
  assert.equal(noOp.status, 409);
  assert.equal([...db.orderStatusHistory.values()].filter((entry) => entry.orderId === "order-processing").length, 0);
});

test("mass assignment is rejected", async () => {
  const response = await request("/api/admin/orders/order-paid/status", { method: "PATCH", body: { orderStatus: "shipped", paymentStatus: "success", userId: "nope" } });
  assert.equal(response.status, 400);
});
