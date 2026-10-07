const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const db = { admins: new Map(), adminSessions: new Map(), users: new Map(), sessions: new Map(), orders: [], products: [], variants: [] };
let id = 0;
let server;
let baseUrl;
let dashboardService;
let adminAuthService;
let customerAuthService;
let customerCookie;

function matchesOrder(order, where = {}) {
  const status = where.orderStatus;
  if (typeof status === "string" && order.orderStatus !== status) return false;
  if (status?.in && !status.in.includes(order.orderStatus)) return false;
  if (where.paymentStatus && order.paymentStatus !== where.paymentStatus) return false;
  return true;
}

const fakePrisma = {
  admin: {
    async findUnique({ where }) { return [...db.admins.values()].find((admin) => admin.email === where.email) || null; },
    async create({ data }) {
      const admin = { id: `admin-${++id}`, isActive: true, createdAt: new Date(), ...data };
      db.admins.set(admin.id, admin); return admin;
    },
  },
  adminSession: {
    async create({ data }) { const session = { id: `admin-session-${++id}`, revokedAt: null, createdAt: new Date(), ...data }; db.adminSessions.set(session.id, session); return session; },
    async findUnique({ where }) {
      const session = [...db.adminSessions.values()].find((entry) => entry.tokenHash === where.tokenHash);
      return session ? { ...session, admin: db.admins.get(session.adminId) } : null;
    },
    async updateMany({ where, data }) { const session = db.adminSessions.get(where.id); if (!session) return { count: 0 }; Object.assign(session, data); return { count: 1 }; },
  },
  user: {
    async findUnique({ where }) { return [...db.users.values()].find((user) => user.email === where.email) || null; },
    async create({ data, select }) {
      const user = { id: `user-${++id}`, isActive: true, createdAt: new Date(), ...data };
      db.users.set(user.id, user);
      return select ? Object.fromEntries(Object.keys(select).map((key) => [key, user[key]])) : user;
    },
    async count() { return db.users.size; },
  },
  session: {
    async create({ data }) { const session = { id: `session-${++id}`, revokedAt: null, createdAt: new Date(), ...data }; db.sessions.set(session.id, session); return session; },
    async findUnique({ where }) { const session = [...db.sessions.values()].find((entry) => entry.tokenHash === where.tokenHash); return session ? { ...session, user: db.users.get(session.userId) } : null; },
  },
  order: {
    async count({ where } = {}) { return db.orders.filter((order) => matchesOrder(order, where)).length; },
    async aggregate({ where }) { return { _sum: { totalAmount: db.orders.filter((order) => matchesOrder(order, where)).reduce((sum, order) => sum + order.totalAmount, 0) || null } }; },
  },
  product: { async count({ where }) { return db.products.filter((product) => !where || product.active === where.active).length; } },
  productVariant: { async count({ where }) { return db.variants.filter((variant) => variant.active === where.active && variant.stock <= where.stock.lte && variant.productActive === where.product.is.active).length; } },
  async $transaction(callback) { return callback(fakePrisma); },
};

function cookieFrom(response) { return response.headers.get("set-cookie")?.split(";")[0] || ""; }
async function request(route, { method = "GET", body, cookie, csrfToken } = {}) {
  const headers = { Origin: "http://127.0.0.1:8080" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
  return fetch(`${baseUrl}${route}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}

async function signInAdmin() {
  const response = await request("/api/admin/auth/login", { method: "POST", body: { email: "dashboard-admin@example.test", password: "dashboard admin password" } });
  assert.equal(response.status, 200);
  return cookieFrom(response);
}

before(async () => {
  const prismaPath = require.resolve("../services/prisma");
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };
  dashboardService = require("../services/adminDashboardService");
  adminAuthService = require("../services/adminAuthService");
  customerAuthService = require("../services/authService");

  const app = require(path.resolve(__dirname, "../server"));
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const passwordHash = await customerAuthService.hashPassword("dashboard admin password");
  await fakePrisma.admin.create({ data: { email: "dashboard-admin@example.test", passwordHash, displayName: "Dashboard Admin" } });
  const customerRegistration = await request("/api/auth/register", { method: "POST", body: {
    email: "dashboard-customer@example.test", password: "a customer password", firstName: "Test", lastName: "Customer",
  } });
  assert.equal(customerRegistration.status, 201);
  customerCookie = cookieFrom(customerRegistration);
  db.users.set("extra-user-a", { id: "extra-user-a", email: "private-customer@example.test" });
  db.users.set("extra-user-b", { id: "extra-user-b", email: "another-private@example.test" });
  assert.equal(db.users.size, 3);
  db.products.push({ active: true }, { active: true }, { active: true }, { active: false });
  db.variants.push(
    { active: true, stock: 5, productActive: true },
    { active: true, stock: 0, productActive: true },
    { active: true, stock: 6, productActive: true },
    { active: false, stock: 1, productActive: true },
    { active: true, stock: 3, productActive: false },
  );
  db.orders.push(
    { id: "order-guest-paid", userId: null, customerEmail: "private-customer@example.test", firstName: "PII_NAME", phone: "PII_PHONE", shippingAddress: "PII_ADDRESS", totalAmount: 140_000, orderStatus: "paid", paymentStatus: "success", paymentReference: "PII_PAYMENT_REF", paystackTransactionId: "PII_TRANSACTION" },
    { id: "order-member-paid", userId: "user-1", totalAmount: 4_500_000, orderStatus: "paid", paymentStatus: "success" },
    { id: "order-pending", userId: null, totalAmount: 15_000, orderStatus: "pending", paymentStatus: "pending" },
    { id: "order-payment-pending", userId: "user-2", totalAmount: 24_000, orderStatus: "payment_pending", paymentStatus: "pending" },
    { id: "order-paid-failed", userId: null, totalAmount: 99_000, orderStatus: "paid", paymentStatus: "failed" },
    { id: "order-cancelled-refunded", userId: null, totalAmount: 88_000, orderStatus: "cancelled", paymentStatus: "refunded" },
    { id: "order-processing-success", userId: null, totalAmount: 77_000, orderStatus: "processing", paymentStatus: "success" },
  );
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  delete require.cache[require.resolve("../services/prisma")];
});

test("dashboard rejects unauthenticated and customer-authenticated requests", async () => {
  const unauthenticated = await request("/api/admin/dashboard");
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticated.headers.get("cache-control"), "private, no-store");

  const customer = await request("/api/admin/dashboard", { cookie: customerCookie });
  assert.equal(customer.status, 401);
});

test("valid admin receives the expected aggregate metrics without customer or payment details", async () => {
  const cookie = await signInAdmin();
  const response = await request("/api/admin/dashboard", { cookie });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(payload.success, true);
  assert.deepEqual(payload.dashboard.orders, { total: 7, pending: 2, paid: 2 });
  assert.deepEqual(payload.dashboard.revenue, { successfulKobo: 4_640_000 });
  assert.deepEqual(payload.dashboard.customers, { total: 3 });
  assert.deepEqual(payload.dashboard.products, { active: 3 });
  assert.deepEqual(payload.dashboard.inventory, { lowStockVariants: 2, threshold: 5 });
  assert.equal(payload.dashboard.currency, "NGN");
  assert.ok(Number.isFinite(Date.parse(payload.dashboard.generatedAt)));
  const serialized = JSON.stringify(payload);
  for (const secret of ["PII_NAME", "PII_PHONE", "PII_ADDRESS", "private-customer@example.test", "PII_PAYMENT_REF", "PII_TRANSACTION", "order-guest-paid", "tokenHash", "csrfToken", "admin-session-"]) {
    assert.equal(serialized.includes(secret), false, `response unexpectedly included ${secret}`);
  }
});

test("expired and revoked admin sessions cannot read the dashboard", async () => {
  const expiredCookie = await signInAdmin();
  const expiredToken = decodeURIComponent(expiredCookie.slice(expiredCookie.indexOf("=") + 1));
  const expiredSession = [...db.adminSessions.values()].find((session) => session.tokenHash === adminAuthService.hashAdminSessionToken(expiredToken));
  expiredSession.expiresAt = new Date(Date.now() - 1000);
  assert.equal((await request("/api/admin/dashboard", { cookie: expiredCookie })).status, 401);

  const revokedCookie = await signInAdmin();
  const revokedToken = decodeURIComponent(revokedCookie.slice(revokedCookie.indexOf("=") + 1));
  const revokedSession = [...db.adminSessions.values()].find((session) => session.tokenHash === adminAuthService.hashAdminSessionToken(revokedToken));
  revokedSession.revokedAt = new Date();
  assert.equal((await request("/api/admin/dashboard", { cookie: revokedCookie })).status, 401);
});

test("dashboard service applies the fixed five-unit threshold and does not return raw records", async () => {
  const result = await dashboardService.getDashboardSummary();
  assert.equal(result.inventory.threshold, 5);
  assert.deepEqual(Object.keys(result).sort(), ["currency", "customers", "generatedAt", "inventory", "orders", "products", "revenue"].sort());
});
