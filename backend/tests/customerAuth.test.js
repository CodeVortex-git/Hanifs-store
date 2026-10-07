const { createHash, randomBytes, scrypt: scryptCallback } = require("node:crypto");
const { promisify } = require("node:util");
const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const db = { users: new Map(), sessions: new Map(), orders: new Map(), variants: new Map() };
let idCounter = 0;
let server;
let baseUrl;
let authService;
let ownsResource;
let foreignCookie;
let foreignCsrfToken;
let ownedOrderId;

function selectOrderFields(order, select) {
  if (!select) return order;
  const selected = {};
  for (const [field, include] of Object.entries(select)) {
    if (include === true) selected[field] = order[field];
    else if (field === "items" && include?.select) {
      selected.items = (order.items || []).map((item) => selectOrderFields(item, include.select));
    }
  }
  return selected;
}

const fakePrisma = {
  user: {
    async findUnique({ where }) {
      return [...db.users.values()].find((user) => user.email === where.email) || null;
    },
    async create({ data, select }) {
      if ([...db.users.values()].some((user) => user.email === data.email)) {
        const error = new Error("Unique constraint failed");
        error.code = "P2002";
        throw error;
      }
      const user = { id: `user-${++idCounter}`, isActive: true, createdAt: new Date(), updatedAt: new Date(), ...data };
      db.users.set(user.id, user);
      return select ? Object.fromEntries(Object.keys(select).map((key) => [key, user[key]])) : user;
    },
    async update({ where, data, select }) {
      const user = db.users.get(where.id);
      if (!user) {
        const error = new Error("Record not found");
        error.code = "P2025";
        throw error;
      }
      Object.assign(user, data, { updatedAt: new Date() });
      return select ? Object.fromEntries(Object.keys(select).map((key) => [key, user[key]])) : user;
    },
  },
  session: {
    async create({ data }) {
      const session = { id: `session-${++idCounter}`, createdAt: new Date(), revokedAt: null, ...data };
      db.sessions.set(session.id, session);
      return session;
    },
    async findUnique({ where }) {
      const session = [...db.sessions.values()].find((candidate) => candidate.tokenHash === where.tokenHash);
      if (!session) return null;
      return { ...session, user: db.users.get(session.userId) };
    },
    async updateMany({ where, data }) {
      const session = db.sessions.get(where.id);
      if (!session || (where.revokedAt === null && session.revokedAt !== null)) return { count: 0 };
      Object.assign(session, data);
      return { count: 1 };
    },
  },
  order: {
    async findMany({ where = {}, orderBy, skip = 0, take = Number.MAX_SAFE_INTEGER, select }) {
      let orders = [...db.orders.values()].filter((order) =>
        where.userId === undefined || order.userId === where.userId,
      );
      if (orderBy?.createdAt === "desc") {
        orders.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
      }
      return orders.slice(skip, skip + take).map((order) => selectOrderFields(order, select));
    },
    async count({ where = {} }) {
      return [...db.orders.values()].filter((order) =>
        where.userId === undefined || order.userId === where.userId,
      ).length;
    },
    async findUnique({ where }) {
      return [...db.orders.values()].find((order) =>
        (where.id === undefined || order.id === where.id) &&
        (where.userId === undefined || order.userId === where.userId) &&
        (where.paymentReference === undefined || order.paymentReference === where.paymentReference),
      ) || null;
    },
    async findFirst({ where, select }) {
      const order = [...db.orders.values()].find((candidate) =>
        candidate.id === where.id && candidate.userId === where.userId,
      );
      return order ? selectOrderFields(order, select) : null;
    },
    async create({ data }) {
      const { items, ...fields } = data;
      const order = {
        id: `order-${++idCounter}`,
        ...fields,
        paymentReference: null,
        inventoryReservationStatus: "none",
        inventoryReservationExpiresAt: null,
        paymentReconciliationRequired: false,
        paystackTransactionId: null,
        createdAt: new Date(),
        items: items.create,
      };
      db.orders.set(order.id, order);
      return order;
    },
  },
  productVariant: {
    async findMany({ where }) {
      return where.id.in.map((id) => db.variants.get(id)).filter(Boolean);
    },
  },
  async $transaction(callback) { return callback(fakePrisma); },
};

function responseCookie(response) {
  const cookie = response.headers.get("set-cookie");
  return cookie?.split(";")[0] || "";
}

function sessionToken(cookie) {
  return cookie.slice(cookie.indexOf("=") + 1);
}

async function request(route, { method = "GET", body, cookie, csrfToken, origin = "http://127.0.0.1:8080" } = {}) {
  const headers = { Origin: origin };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
  return fetch(`${baseUrl}${route}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const validRegistration = {
  email: "  Customer@Example.Test ",
  password: "correct horse battery staple",
  firstName: "Ada",
  lastName: "Shopper",
  phone: "+234 801 234 5678",
};

const validOrder = {
  customer: { email: "buyer@example.test", firstName: "Buyer", lastName: "Name", phone: "+234 801 234 5678" },
  shipping: { address: "1 Market Road", city: "Lagos", state: "Lagos", country: "Nigeria" },
  items: [{ productVariantId: 1, quantity: 1 }],
};

async function createTestCustomer(email) {
  const result = await authService.register({ ...validRegistration, email });
  return {
    user: [...db.users.values()].find((candidate) => candidate.email === email),
    cookie: `hanifs_session=${result.token}`,
  };
}

function createHistoryOrder({ userId, email, createdAt }) {
  const id = `history-order-${++idCounter}`;
  const order = {
    id,
    userId,
    customerEmail: email,
    firstName: "History",
    lastName: "Customer",
    phone: "+234 801 234 5678",
    shippingAddress: "1 History Road",
    city: "Lagos",
    state: "Lagos",
    country: "Nigeria",
    subtotal: 24_000,
    deliveryAmount: 1_500,
    totalAmount: 25_500,
    orderStatus: "paid",
    paymentStatus: "success",
    paymentReference: `private-reference-${id}`,
    paystackTransactionId: `private-transaction-${id}`,
    inventoryReservationStatus: "committed",
    inventoryReservationExpiresAt: new Date(Date.now() + 60_000),
    paymentReconciliationRequired: true,
    createdAt,
    updatedAt: createdAt,
    items: [{
      productName: "Snapshot shirt",
      selectedSize: "M",
      selectedColor: "Navy",
      quantity: 2,
      unitPrice: 12_000,
      lineTotal: 24_000,
      productVariantId: 42,
      id: `private-item-${id}`,
    }],
  };
  db.orders.set(id, order);
  return order;
}

before(async () => {
  const prismaPath = require.resolve("../services/prisma");
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };
  authService = require("../services/authService");
  ownsResource = require("../middleware/auth").ownsResource;
  const app = require(path.resolve(__dirname, "../server"));
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  db.variants.set(1, {
    id: 1,
    size: "M",
    color: "Black",
    price: 12_500,
    stock: 10,
    active: true,
    product: { name: "Test garment", active: true },
  });
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  delete require.cache[require.resolve("../services/prisma")];
});

test("registration normalizes email, hashes password, creates a session, and returns no secrets", async () => {
  const response = await request("/api/auth/register", { method: "POST", body: validRegistration });
  const payload = await response.json();
  assert.equal(response.status, 201);
  assert.equal(payload.user.email, "customer@example.test");
  assert.equal("passwordHash" in payload.user, false);
  assert.equal("password" in payload, false);
  assert.equal("token" in payload, false);
  assert.ok(payload.csrfToken);
  const user = [...db.users.values()][0];
  assert.equal(user.email, "customer@example.test");
  assert.notEqual(user.passwordHash, validRegistration.password);
  assert.match(user.passwordHash, /^\$scrypt\$/);
  const cookie = responseCookie(response);
  assert.match(cookie, /^hanifs_session=/);
  assert.match(response.headers.get("set-cookie"), /HttpOnly/i);
  assert.match(response.headers.get("set-cookie"), /SameSite=Lax/i);
  const session = [...db.sessions.values()][0];
  assert.equal(session.tokenHash, createHash("sha256").update(sessionToken(cookie)).digest("hex"));
  assert.notEqual(session.tokenHash, sessionToken(cookie));
});

test("duplicate email is rejected after normalization", async () => {
  const response = await request("/api/auth/register", {
    method: "POST",
    body: { ...validRegistration, email: "CUSTOMER@example.test" },
  });
  assert.equal(response.status, 409);
});

test("invalid email and weak password are rejected", async () => {
  const emailResponse = await request("/api/auth/register", {
    method: "POST",
    body: { ...validRegistration, email: "not-an-email" },
  });
  assert.equal(emailResponse.status, 400);
  const passwordResponse = await request("/api/auth/register", {
    method: "POST",
    body: { ...validRegistration, email: "another@example.test", password: "short" },
  });
  assert.equal(passwordResponse.status, 400);
});

test("login creates a fresh session and unknown and incorrect credentials have the same response", async () => {
  const loginResponse = await request("/api/auth/login", {
    method: "POST",
    body: { email: " CUSTOMER@example.test ", password: validRegistration.password },
  });
  const login = await loginResponse.json();
  assert.equal(loginResponse.status, 200);
  assert.equal(login.user.email, "customer@example.test");
  assert.equal("passwordHash" in login.user, false);
  assert.equal(db.sessions.size, 2);
  const badPassword = await request("/api/auth/login", {
    method: "POST",
    body: { email: "customer@example.test", password: "incorrect password is long" },
  });
  const unknownEmail = await request("/api/auth/login", {
    method: "POST",
    body: { email: "unknown@example.test", password: "incorrect password is long" },
  });
  assert.equal(badPassword.status, 401);
  assert.equal(unknownEmail.status, 401);
  assert.deepEqual(await badPassword.json(), await unknownEmail.json());
});

test("session persists across requests, while expired or revoked sessions are rejected", async () => {
  // Use the actual raw credential returned only through the cookie on a new registration.
  const newResponse = await request("/api/auth/register", {
    method: "POST",
    body: { ...validRegistration, email: "persist@example.test" },
  });
  const newCookie = responseCookie(newResponse);
  const current = await request("/api/auth/me", { cookie: newCookie });
  const currentBody = await current.json();
  assert.equal(current.status, 200);
  assert.equal(currentBody.user.email, "persist@example.test");
  assert.ok(currentBody.csrfToken);
  const rawToken = sessionToken(newCookie);
  const tokenHash = authService.hashSessionToken(rawToken);
  const session = [...db.sessions.values()].find((candidate) => candidate.tokenHash === tokenHash);
  session.expiresAt = new Date(Date.now() - 1000);
  const expired = await request("/api/auth/me", { cookie: newCookie });
  assert.equal(expired.status, 401);
  session.expiresAt = new Date(Date.now() + 60_000);
  session.revokedAt = new Date();
  const revoked = await request("/api/auth/me", { cookie: newCookie });
  assert.equal(revoked.status, 401);
});

test("logout revokes the current session and clears its cookie", async () => {
  const registered = await request("/api/auth/register", {
    method: "POST",
    body: { ...validRegistration, email: "logout@example.test" },
  });
  const cookie = responseCookie(registered);
  const session = [...db.sessions.values()].find((candidate) => candidate.tokenHash === authService.hashSessionToken(sessionToken(cookie)));
  const me = await request("/api/auth/me", { cookie });
  const csrfToken = (await me.json()).csrfToken;
  const logout = await request("/api/auth/logout", { method: "POST", cookie, csrfToken, body: {} });
  assert.equal(logout.status, 200);
  assert.ok(session.revokedAt);
  assert.match(logout.headers.get("set-cookie"), /Expires=/i);
  const afterLogout = await request("/api/auth/me", { cookie });
  assert.equal(afterLogout.status, 401);
});

test("me requires authentication and authenticated mutations require valid CSRF and origin", async () => {
  const anonymous = await request("/api/auth/me");
  assert.equal(anonymous.status, 401);
  const registered = await request("/api/auth/register", {
    method: "POST",
    body: { ...validRegistration, email: "csrf@example.test" },
  });
  const cookie = responseCookie(registered);
  const me = await request("/api/auth/me", { cookie });
  const csrfToken = (await me.json()).csrfToken;
  foreignCookie = cookie;
  foreignCsrfToken = csrfToken;
  const absent = await request("/api/orders", { method: "POST", cookie, body: validOrder });
  assert.equal(absent.status, 403);
  const incorrect = await request("/api/orders", {
    method: "POST", cookie, csrfToken: "wrong-length-token", body: validOrder,
  });
  assert.equal(incorrect.status, 403);
  const wrongOrigin = await request("/api/orders", {
    method: "POST", cookie, csrfToken, origin: "https://attacker.example", body: validOrder,
  });
  assert.equal(wrongOrigin.status, 403);
  const valid = await request("/api/orders", { method: "POST", cookie, csrfToken, body: validOrder });
  assert.equal(valid.status, 201);
});

test("profile endpoint requires authentication and CSRF, updates only the session customer, and rejects invalid fields", async () => {
  const unauthenticated = await request("/api/auth/me", { method: "PATCH", body: { firstName: "Guest" } });
  assert.equal(unauthenticated.status, 401);

  const first = await authService.register({ ...validRegistration, email: "profile-one@example.test" });
  const firstCookie = `hanifs_session=${first.token}`;
  const firstMe = await (await request("/api/auth/me", { cookie: firstCookie })).json();
  const second = await authService.register({ ...validRegistration, email: "profile-two@example.test" });
  const secondCookie = `hanifs_session=${second.token}`;
  const firstUser = [...db.users.values()].find((user) => user.email === "profile-one@example.test");
  const secondUser = [...db.users.values()].find((user) => user.email === "profile-two@example.test");

  const missingCsrf = await request("/api/auth/me", {
    method: "PATCH", cookie: firstCookie, body: { firstName: "Updated" },
  });
  assert.equal(missingCsrf.status, 403);
  const invalidCsrf = await request("/api/auth/me", {
    method: "PATCH", cookie: firstCookie, csrfToken: "not-the-session-token",
    body: { firstName: "Updated" },
  });
  assert.equal(invalidCsrf.status, 403);
  const wrongOrigin = await request("/api/auth/me", {
    method: "PATCH", cookie: firstCookie, csrfToken: firstMe.csrfToken,
    origin: "https://attacker.example", body: { firstName: "Updated" },
  });
  assert.equal(wrongOrigin.status, 403);

  const forgedIdentity = await request("/api/auth/me", {
    method: "PATCH", cookie: firstCookie, csrfToken: firstMe.csrfToken,
    body: { firstName: "Updated", userId: secondUser.id },
  });
  assert.equal(forgedIdentity.status, 400);
  const invalidEmailChange = await request("/api/auth/me", {
    method: "PATCH", cookie: firstCookie, csrfToken: firstMe.csrfToken,
    body: { email: "takeover@example.test" },
  });
  assert.equal(invalidEmailChange.status, 400);
  const invalidPhone = await request("/api/auth/me", {
    method: "PATCH", cookie: firstCookie, csrfToken: firstMe.csrfToken,
    body: { phone: "not a phone" },
  });
  assert.equal(invalidPhone.status, 400);
  const invalidName = await request("/api/auth/me", {
    method: "PATCH", cookie: firstCookie, csrfToken: firstMe.csrfToken,
    body: { firstName: "   " },
  });
  assert.equal(invalidName.status, 400);

  const updated = await request("/api/auth/me", {
    method: "PATCH", cookie: firstCookie, csrfToken: firstMe.csrfToken,
    body: { firstName: "  Grace ", lastName: "Hopper", phone: "" },
  });
  assert.equal(updated.status, 200);
  const payload = await updated.json();
  assert.equal(payload.user.firstName, "Grace");
  assert.equal(payload.user.lastName, "Hopper");
  assert.equal(payload.user.phone, null);
  assert.equal("passwordHash" in payload.user, false);
  assert.equal("csrfToken" in payload, false);
  assert.equal(firstUser.firstName, "Grace");
  assert.equal(secondUser.firstName, validRegistration.firstName);
  assert.equal(firstUser.email, "profile-one@example.test");
  assert.equal((await (await request("/api/auth/me", { cookie: secondCookie })).json()).user.firstName, validRegistration.firstName);
});

test("guest orders remain unowned and authenticated orders use session identity, never body userId", async () => {
  const guest = await request("/api/orders", { method: "POST", body: validOrder });
  assert.equal(guest.status, 201);
  const guestOrder = (await guest.json()).order;
  assert.equal(db.orders.get(guestOrder.id).userId, null);

  const registered = await request("/api/auth/register", {
    method: "POST",
    body: { ...validRegistration, email: "owner@example.test" },
  });
  const cookie = responseCookie(registered);
  const owner = [...db.users.values()].find((user) => user.email === "owner@example.test");
  const csrfToken = (await (await request("/api/auth/me", { cookie })).json()).csrfToken;
  const authenticated = await request("/api/orders", {
    method: "POST", cookie, csrfToken, body: { ...validOrder, userId: "attacker-user" },
  });
  assert.equal(authenticated.status, 400);
  const order = await request("/api/orders", { method: "POST", cookie, csrfToken, body: validOrder });
  assert.equal(order.status, 201);
  const orderPayload = (await order.json()).order;
  assert.equal(db.orders.get(orderPayload.id).userId, owner.id);
  ownedOrderId = orderPayload.id;
});

test("authenticated order history is paginated, newest first, and excludes other customers and matching-email guest orders", async () => {
  const customer = await createTestCustomer("history-owner@example.test");
  const otherCustomer = await createTestCustomer("history-other@example.test");
  const baseTime = Date.now();
  const oldest = createHistoryOrder({ userId: customer.user.id, email: customer.user.email, createdAt: new Date(baseTime - 3_000) });
  const other = createHistoryOrder({ userId: otherCustomer.user.id, email: customer.user.email, createdAt: new Date(baseTime - 2_000) });
  const newest = createHistoryOrder({ userId: customer.user.id, email: customer.user.email, createdAt: new Date(baseTime - 1_000) });
  const guest = createHistoryOrder({ userId: null, email: customer.user.email, createdAt: new Date(baseTime) });

  const firstPage = await request("/api/orders?page=1&limit=1", { cookie: customer.cookie });
  assert.equal(firstPage.status, 200);
  const firstPayload = await firstPage.json();
  assert.deepEqual(firstPayload.orders.map((order) => order.id), [newest.id]);
  assert.deepEqual(firstPayload.pagination, { page: 1, limit: 1, total: 2, totalPages: 2 });

  const secondPage = await request("/api/orders?page=2&limit=1", { cookie: customer.cookie });
  const secondPayload = await secondPage.json();
  assert.equal(secondPage.status, 200);
  assert.deepEqual(secondPayload.orders.map((order) => order.id), [oldest.id]);
  assert.equal(firstPayload.orders.some((order) => [other.id, guest.id].includes(order.id)), false);
});

test("customer with no orders receives an empty history and supplied userId is rejected", async () => {
  const customer = await createTestCustomer("empty-history@example.test");
  const empty = await request("/api/orders", { cookie: customer.cookie });
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), {
    success: true,
    orders: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  });

  const anotherCustomer = await createTestCustomer("history-injection@example.test");
  createHistoryOrder({ userId: anotherCustomer.user.id, email: anotherCustomer.user.email, createdAt: new Date() });
  const injected = await request(`/api/orders?userId=${encodeURIComponent(anotherCustomer.user.id)}`, { cookie: customer.cookie });
  assert.equal(injected.status, 400);
  assert.deepEqual((await injected.json()).orders, undefined);
  assert.equal((await request("/api/orders?page=0", { cookie: customer.cookie })).status, 400);
  assert.equal((await request("/api/orders?limit=51", { cookie: customer.cookie })).status, 400);
});

test("order details are session-scoped and return the same 404 for another customer's order and a missing order", async () => {
  const customer = await createTestCustomer("detail-owner@example.test");
  const otherCustomer = await createTestCustomer("detail-other@example.test");
  const ownOrder = createHistoryOrder({ userId: customer.user.id, email: customer.user.email, createdAt: new Date() });
  const otherOrder = createHistoryOrder({ userId: otherCustomer.user.id, email: customer.user.email, createdAt: new Date() });

  const unauthenticatedList = await request("/api/orders");
  const unauthenticatedDetail = await request(`/api/orders/${ownOrder.id}`);
  assert.equal(unauthenticatedList.status, 401);
  assert.equal(unauthenticatedDetail.status, 401);

  const detail = await request(`/api/orders/${ownOrder.id}`, { cookie: customer.cookie });
  assert.equal(detail.status, 200);
  const payload = await detail.json();
  assert.equal(payload.order.id, ownOrder.id);
  assert.equal(payload.order.customerEmail, customer.user.email);
  assert.equal(payload.order.items[0].productName, "Snapshot shirt");
  assert.deepEqual(Object.keys(payload.order).sort(), [
    "city", "country", "createdAt", "customerEmail", "deliveryAmount", "firstName", "id",
    "items", "lastName", "orderStatus", "paymentStatus", "phone", "shippingAddress",
    "state", "subtotal", "totalAmount",
  ].sort());
  assert.deepEqual(Object.keys(payload.order.items[0]).sort(), [
    "lineTotal", "productName", "quantity", "selectedColor", "selectedSize", "unitPrice",
  ].sort());
  for (const forbidden of [
    "userId", "paymentReference", "paystackTransactionId", "inventoryReservationStatus",
    "inventoryReservationExpiresAt", "paymentReconciliationRequired", "sessions", "passwordHash",
  ]) assert.equal(Object.hasOwn(payload.order, forbidden), false);

  const forbiddenOrder = await request(`/api/orders/${otherOrder.id}`, { cookie: customer.cookie });
  const missingOrder = await request("/api/orders/nonexistent-order-id", { cookie: customer.cookie });
  assert.equal(forbiddenOrder.status, 404);
  assert.equal(missingOrder.status, 404);
  assert.deepEqual(await forbiddenOrder.json(), await missingOrder.json());
});

test("a different customer cannot initialize or verify another customer's order", async () => {
  const order = db.orders.get(ownedOrderId);
  order.paymentReference = "owned-payment-reference";
  const initialize = await request("/api/payments/initialize", {
    method: "POST",
    cookie: foreignCookie,
    csrfToken: foreignCsrfToken,
    body: { orderId: ownedOrderId },
  });
  assert.equal(initialize.status, 404);
  const verify = await request("/api/payments/verify", {
    method: "POST",
    cookie: foreignCookie,
    csrfToken: foreignCsrfToken,
    body: { reference: order.paymentReference },
  });
  assert.equal(verify.status, 404);
});

test("ownership helper permits guests but rejects another account's resource", () => {
  assert.equal(ownsResource(null, null), true);
  assert.equal(ownsResource("user-a", null), true);
  assert.equal(ownsResource("user-a", "user-a"), true);
  assert.equal(ownsResource("user-a", "user-b"), false);
});

test("authentication rate limiter returns 429 after its configured limit", () => {
  const { createRateLimiter } = require("../middleware/authRateLimit");
  const limit = createRateLimiter({ windowMs: 60_000, max: 1 });
  const run = () => {
    let nextCalled = false;
    let statusCode = null;
    let body = null;
    const res = {
      set() { return this; },
      status(code) { statusCode = code; return this; },
      json(value) { body = value; return this; },
    };
    limit({ ip: "test-ip" }, res, () => { nextCalled = true; });
    return { nextCalled, statusCode, body };
  };
  assert.equal(run().nextCalled, true);
  const limited = run();
  assert.equal(limited.statusCode, 429);
  assert.match(limited.body.message, /too many/i);
});

test("scrypt writes the accepted p=5 profile and still verifies legacy p=1 hashes", async () => {
  const { hashPassword, verifyPassword } = authService;
  const password = "valid test password phrase";
  const currentHash = await hashPassword(password);
  assert.match(currentHash, /^\$scrypt\$16384\$8\$5\$/);
  assert.equal(await verifyPassword(password, currentHash), true);

  const salt = randomBytes(16);
  const legacyDerived = await promisify(scryptCallback)(password, salt, 64, {
    N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024,
  });
  const legacyHash = `$scrypt$16384$8$1$${salt.toString("base64url")}$${legacyDerived.toString("base64url")}`;
  assert.equal(await verifyPassword(password, legacyHash), true);
});

test("inactive customers cannot log in and existing sessions are rejected", async () => {
  const registered = await authService.register({
    ...validRegistration,
    email: "inactive@example.test",
  });
  const user = [...db.users.values()].find((candidate) => candidate.email === "inactive@example.test");
  user.isActive = false;

  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email: "inactive@example.test", password: validRegistration.password },
  });
  assert.equal(login.status, 401);
  assert.deepEqual(await login.json(), {
    success: false,
    message: "Email or password is incorrect.",
    code: "invalid_credentials",
  });

  const cookie = `hanifs_session=${registered.token}`;
  assert.equal((await request("/api/auth/me", { cookie })).status, 401);
});

test("logging out one device leaves another session active", async () => {
  const first = await authService.register({
    ...validRegistration,
    email: "devices@example.test",
  });
  const cookieA = `hanifs_session=${first.token}`;
  const loginB = await request("/api/auth/login", {
    method: "POST",
    body: { email: "devices@example.test", password: validRegistration.password },
  });
  assert.equal(loginB.status, 200);
  const cookieB = responseCookie(loginB);
  assert.notEqual(cookieA, cookieB);

  assert.equal((await request("/api/auth/me", { cookie: cookieA })).status, 200);
  assert.equal((await request("/api/auth/me", { cookie: cookieB })).status, 200);
  const logoutA = await request("/api/auth/logout", {
    method: "POST", cookie: cookieA, csrfToken: first.csrfToken, body: {},
  });
  assert.equal(logoutA.status, 200);
  assert.equal((await request("/api/auth/me", { cookie: cookieA })).status, 401);
  assert.equal((await request("/api/auth/me", { cookie: cookieB })).status, 200);
});

test("production session cookie has secure host-only attributes and finite expiration", () => {
  const { setSessionCookie } = require("../controllers/authController");
  let cookieArgs;
  const response = {
    cookie(...args) { cookieArgs = args; return this; },
  };
  const expiresAt = new Date(Date.now() + 60_000);
  setSessionCookie(response, "opaque-test-token", expiresAt, { NODE_ENV: "production" });
  const [name, , options] = cookieArgs;
  assert.equal(name, "__Host-hanifs_session");
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.path, "/");
  assert.equal(options.expires, expiresAt);
  assert.ok(Number.isFinite(options.expires.getTime()));
});

test("actual registration and login routes throttle after configured thresholds and reset cleanly", async () => {
  const { resetAuthRateLimits } = require("../middleware/authRateLimit");
  resetAuthRateLimits();
  try {
    for (let attempt = 1; attempt <= 9; attempt += 1) {
      const response = await request("/api/auth/register", { method: "POST", body: {} });
      assert.equal(response.status, attempt <= 8 ? 400 : 429);
    }
    for (let attempt = 1; attempt <= 11; attempt += 1) {
      const response = await request("/api/auth/login", { method: "POST", body: {} });
      assert.equal(response.status, attempt <= 10 ? 400 : 429);
    }
  } finally {
    resetAuthRateLimits();
  }
});
