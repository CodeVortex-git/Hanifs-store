const { createHash } = require("node:crypto");
const { after, afterEach, before, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const db = { admins: new Map(), adminSessions: new Map(), users: new Map(), sessions: new Map(), products: new Map(), variants: new Map(), orders: [] };
let nextId = 0;
let nextProductId = 0;
let nextVariantId = 0;
let server;
let baseUrl;
let customerCookie;
let adminService;
let customerService;
let failList = false;

function uniqueError() { const error = new Error("private database constraint detail"); error.code = "P2002"; return error; }
function filteredProducts(where = {}) {
  return [...db.products.values()].filter((product) => {
    if (where.active !== undefined && product.active !== where.active) return false;
    if (where.OR && !where.OR.some((condition) => String(product[Object.keys(condition)[0]]).toLocaleLowerCase("en").includes(Object.values(condition)[0].contains.toLocaleLowerCase("en")))) return false;
    return true;
  });
}
function withVariants(product) {
  if (!product) return null;
  return { ...product, variants: [...db.variants.values()].filter((variant) => variant.productId === product.id).sort((a,b) => a.size.localeCompare(b.size) || a.color.localeCompare(b.color) || a.id-b.id) };
}
function variantUnique(productId, size, color, exceptId) {
  return [...db.variants.values()].some((entry) => entry.productId === productId && entry.id !== exceptId && entry.size === size && entry.color === color);
}

const fakePrisma = {
  admin: {
    async findUnique({ where }) { return [...db.admins.values()].find((admin) => admin.email === where.email) || null; },
    async create({ data }) { const admin = { id: `admin-${++nextId}`, isActive: true, createdAt: new Date(), ...data }; db.admins.set(admin.id, admin); return admin; },
  },
  adminSession: {
    async create({ data }) { const session = { id: `admin-session-${++nextId}`, revokedAt: null, createdAt: new Date(), ...data }; db.adminSessions.set(session.id, session); return session; },
    async findUnique({ where }) { const session = [...db.adminSessions.values()].find((entry) => entry.tokenHash === where.tokenHash); return session ? { ...session, admin: db.admins.get(session.adminId) } : null; },
    async updateMany({ where, data }) { const session = db.adminSessions.get(where.id); if (!session) return { count: 0 }; Object.assign(session, data); return { count: 1 }; },
  },
  user: {
    async findUnique({ where }) { return [...db.users.values()].find((user) => user.email === where.email) || null; },
    async create({ data, select }) { const user = { id: `user-${++nextId}`, isActive: true, createdAt: new Date(), ...data }; db.users.set(user.id, user); return select ? Object.fromEntries(Object.keys(select).map((key) => [key, user[key]])) : user; },
  },
  session: {
    async create({ data }) { const session = { id: `session-${++nextId}`, revokedAt: null, createdAt: new Date(), ...data }; db.sessions.set(session.id, session); return session; },
    async findUnique({ where }) { const session = [...db.sessions.values()].find((entry) => entry.tokenHash === where.tokenHash); return session ? { ...session, user: db.users.get(session.userId) } : null; },
  },
  product: {
    async findMany({ where, skip, take }) { if (failList) throw new Error("private database failure detail"); return filteredProducts(where).sort((a,b) => b.updatedAt-a.updatedAt || a.id-b.id).slice(skip, skip+take).map(withVariants); },
    async count({ where }) { return filteredProducts(where).length; },
    async findUnique({ where }) { return withVariants(db.products.get(where.id)); },
    async create({ data }) {
      const variants = data.variants?.create || [];
      const seen = new Set();
      for (const variant of variants) {
        const key = `${variant.size}\u0000${variant.color}`;
        if (seen.has(key)) throw uniqueError();
        seen.add(key);
      }
      const { variants: _nested, ...fields } = data;
      const product = { id: ++nextProductId, createdAt: new Date(), updatedAt: new Date(), ...fields };
      db.products.set(product.id, product);
      for (const variant of variants) {
        const id = ++nextVariantId;
        db.variants.set(id, { id, productId: product.id, createdAt: new Date(), updatedAt: new Date(), ...variant });
      }
      return withVariants(product);
    },
    async update({ where, data }) { const product = db.products.get(where.id); if (!product) { const error = new Error(); error.code = "P2025"; throw error; } Object.assign(product, data, { updatedAt: new Date() }); return withVariants(product); },
  },
  productVariant: {
    async create({ data }) { if (variantUnique(data.productId, data.size, data.color)) throw uniqueError(); const variant = { id: ++nextVariantId, createdAt: new Date(), updatedAt: new Date(), ...data }; db.variants.set(variant.id, variant); return variant; },
    async findFirst({ where }) { const variant = db.variants.get(where.id); return variant?.productId === where.productId ? variant : null; },
    async update({ where, data }) { const variant = db.variants.get(where.id); if (!variant) { const error = new Error(); error.code = "P2025"; throw error; } if (variantUnique(variant.productId, data.size ?? variant.size, data.color ?? variant.color, variant.id)) throw uniqueError(); Object.assign(variant, data, { updatedAt: new Date() }); return variant; },
  },
  async $transaction(callback) { return callback(fakePrisma); },
};

function cookieFrom(response) { return response.headers.get("set-cookie")?.split(";")[0] || ""; }
async function request(route, { method = "GET", body, cookie, csrfToken, origin = "http://127.0.0.1:8080" } = {}) {
  const headers = {};
  if (origin) headers.Origin = origin;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
  return fetch(`${baseUrl}${route}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
async function getAdminSession() {
  const login = await request("/api/admin/auth/login", { method: "POST", body: { email: "products-admin@example.test", password: "product manager password" } });
  assert.equal(login.status, 200);
  const cookie = cookieFrom(login);
  const me = await request("/api/admin/auth/me", { cookie });
  return { cookie, csrfToken: (await me.json()).csrfToken };
}
const validProduct = {
  name: "Test Jacket", description: "A tailored test jacket.", category: "Clothing", gender: "Unisex",
  basePrice: 12_500_00, image: "https://images.example.test/jacket.jpg", imageAlt: "A test jacket", featured: true, newArrival: false, active: true,
};
const validVariant = { size: "M", color: "Navy", price: 13_000_00 };

describe("admin product management", { concurrency: false }, () => {
before(async () => {
  const prismaPath = require.resolve("../services/prisma");
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };
  adminService = require("../services/adminAuthService");
  customerService = require("../services/authService");
  const app = require(path.resolve(__dirname, "../server"));
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const adminHash = await customerService.hashPassword("product manager password");
  await fakePrisma.admin.create({ data: { email: "products-admin@example.test", passwordHash: adminHash, displayName: "Product Manager" } });
  const customer = await request("/api/auth/register", { method: "POST", body: { email: "product-customer@example.test", password: "customer pass phrase", firstName: "Shop", lastName: "Customer" } });
  customerCookie = cookieFrom(customer);
  await fakePrisma.product.create({ data: { name: "Active Coat", description: "Coat description", category: "Outerwear", gender: "Unisex", basePrice: 45_000_00, imageUrl: "https://images.example.test/coat.jpg", imageAlt: "A blue coat", featured: false, newArrival: true, active: true, variants: { create: [{ size: "L", color: "Blue", price: 50_000_00, stock: 4, active: true }] } } });
  await fakePrisma.product.create({ data: { name: "Inactive Coat", description: "Inactive description", category: "Outerwear", gender: "Women", basePrice: 35_000_00, imageUrl: "https://images.example.test/old.jpg", imageAlt: "An older coat", featured: false, newArrival: false, active: false } });
  db.orders.push({ id: "historical-order", items: [{ productName: "Active Coat", selectedSize: "L", selectedColor: "Blue", unitPrice: 50_000_00, lineTotal: 50_000_00 }] });
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  delete require.cache[require.resolve("../services/prisma")];
});

afterEach(() => require("../middleware/adminRateLimit").adminLoginRateLimit.reset());

test("product routes reject unauthenticated and customer sessions, while an admin can read", async () => {
  assert.equal((await request("/api/admin/products")).status, 401);
  assert.equal((await request("/api/admin/products", { cookie: customerCookie })).status, 401);
  const { cookie } = await getAdminSession();
  const response = await request("/api/admin/products", { cookie });
  assert.equal(response.status, 200);
});

test("admin list includes active and inactive records, supports search/filter, and bounds pagination", async () => {
  const { cookie } = await getAdminSession();
  const all = await (await request("/api/admin/products?limit=1&page=1", { cookie })).json();
  assert.equal(all.products.length, 1);
  assert.equal(all.pagination.total, 2);
  const inactive = await (await request("/api/admin/products?active=false", { cookie })).json();
  assert.equal(inactive.products.length, 1);
  assert.equal(inactive.products[0].active, false);
  const search = await (await request("/api/admin/products?q=women", { cookie })).json();
  assert.equal(search.products.length, 1);
  for (const query of ["page=0", "limit=51", "active=maybe", "wat=true"]) {
    assert.equal((await request(`/api/admin/products?${query}`, { cookie })).status, 400);
  }
});

test("admin retrieves a product including inactive variants and unknown products return 404", async () => {
  const { cookie } = await getAdminSession();
  const detail = await request("/api/admin/products/1", { cookie });
  const payload = await detail.json();
  assert.equal(detail.status, 200);
  assert.equal(payload.product.variants.length, 1);
  assert.equal(payload.product.variants[0].stock, 4);
  assert.equal((await request("/api/admin/products/999", { cookie })).status, 404);
  assert.equal((await request("/api/admin/products/nope", { cookie })).status, 400);
});

test("admin product mutations require a session, customer sessions are rejected, and valid writes work", async () => {
  assert.equal((await request("/api/admin/products", { method: "POST", body: validProduct })).status, 401);
  assert.equal((await request("/api/admin/products", { method: "POST", cookie: customerCookie, body: validProduct })).status, 401);
  const { cookie, csrfToken } = await getAdminSession();
  const denied = await request("/api/admin/products", { method: "POST", cookie, body: validProduct });
  assert.equal(denied.status, 403);
  const created = await request("/api/admin/products", { method: "POST", cookie, csrfToken, body: { ...validProduct, variants: [validVariant] } });
  assert.equal(created.status, 201);
  const body = await created.json();
  assert.equal(body.product.variants[0].stock, 0);
});

test("product validation rejects whitespace, invalid prices, unsafe URLs, stock, and unknown fields", async () => {
  const { cookie, csrfToken } = await getAdminSession();
  const invalid = [
    { ...validProduct, name: "   " }, { ...validProduct, basePrice: -1 },
    { ...validProduct, basePrice: 10.5 }, { ...validProduct, basePrice: 0 },
    { ...validProduct, basePrice: 2_147_483_648 }, { ...validProduct, image: "javascript:alert(1)" },
    { ...validProduct, stock: 10 }, { ...validProduct, createdAt: "today" },
  ];
  for (const body of invalid) assert.equal((await request("/api/admin/products", { method: "POST", cookie, csrfToken, body })).status, 400);
  assert.equal((await request("/api/admin/products", { method: "POST", cookie, csrfToken, body: { ...validProduct, variants: [{ ...validVariant, stock: 25 }] } })).status, 400);
});

test("initial product variants are atomic and duplicate size/color entries are rejected", async () => {
  const { cookie, csrfToken } = await getAdminSession();
  const beforeCount = db.products.size;
  const response = await request("/api/admin/products", { method: "POST", cookie, csrfToken, body: {
    ...validProduct, name: "Atomic Duplicate", variants: [validVariant, { ...validVariant, price: 14_000_00 }],
  } });
  assert.equal(response.status, 409);
  assert.equal(db.products.size, beforeCount);
});

test("product updates reject mass assignment and do not modify historical order snapshots", async () => {
  const { cookie, csrfToken } = await getAdminSession();
  const before = structuredClone(db.orders[0].items[0]);
  const updated = await request("/api/admin/products/1", { method: "PATCH", cookie, csrfToken, body: { basePrice: 55_000_00, featured: true, newArrival: true } });
  assert.equal(updated.status, 200);
  const product = (await updated.json()).product;
  assert.equal(product.basePrice, 55_000_00);
  assert.equal(product.featured, true);
  assert.equal(product.newArrival, true);
  assert.deepEqual(db.orders[0].items[0], before);
  for (const body of [{ id: 6 }, { stock: 20 }, { inventoryReservationStatus: "committed" }, { userId: "someone" }]) {
    assert.equal((await request("/api/admin/products/1", { method: "PATCH", cookie, csrfToken, body })).status, 400);
  }
});

test("variant creation starts at zero stock, duplicate is 409, and updates enforce ownership and allowlist", async () => {
  const { cookie, csrfToken } = await getAdminSession();
  const created = await request("/api/admin/products/1/variants", { method: "POST", cookie, csrfToken, body: { ...validVariant, size: "S" } });
  assert.equal(created.status, 201);
  const variant = (await created.json()).variant;
  assert.equal(variant.stock, 0);
  assert.equal((await request("/api/admin/products/1/variants", { method: "POST", cookie, csrfToken, body: { ...validVariant, size: "S" } })).status, 409);
  assert.equal((await request(`/api/admin/products/2/variants/${variant.id}`, { method: "PATCH", cookie, csrfToken, body: { active: false } })).status, 404);
  const update = await request(`/api/admin/products/1/variants/${variant.id}`, { method: "PATCH", cookie, csrfToken, body: { price: 15_000_00, active: false } });
  assert.equal(update.status, 200);
  assert.equal((await update.json()).variant.stock, 0);
  for (const body of [{ stock: 5 }, { productId: 2 }, { id: 3 }, { updatedAt: "today" }, { size: " " }]) {
    assert.equal((await request(`/api/admin/products/1/variants/${variant.id}`, { method: "PATCH", cookie, csrfToken, body })).status, 400);
  }
});

test("product deactivation preserves variant active flags and hard deletion is unavailable", async () => {
  const { cookie, csrfToken } = await getAdminSession();
  const variantBefore = [...db.variants.values()].find((variant) => variant.productId === 1);
  assert.equal(variantBefore.active, true);
  const deactivated = await request("/api/admin/products/1", { method: "PATCH", cookie, csrfToken, body: { active: false } });
  assert.equal(deactivated.status, 200);
  assert.equal([...db.variants.values()].find((variant) => variant.id === variantBefore.id).active, true);
  assert.equal((await request("/api/admin/products/1", { method: "DELETE", cookie, csrfToken })).status, 404);
});

test("variant duplicate errors are mapped safely and unsafe Origins are blocked", async () => {
  const { cookie, csrfToken } = await getAdminSession();
  const invalidOrigin = await request("/api/admin/products/1", { method: "PATCH", cookie, csrfToken, origin: "https://attacker.example", body: { active: true } });
  assert.equal(invalidOrigin.status, 403);
  const duplicate = await request("/api/admin/products/1/variants", { method: "POST", cookie, csrfToken, body: { size: "L", color: "Blue", price: 10_000 } });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.text()).includes("private database"), false);
});

test("raw Prisma failures are hidden and API responses omit customer and reservation data", async () => {
  const { cookie } = await getAdminSession();
  failList = true;
  const failed = await request("/api/admin/products", { cookie });
  failList = false;
  assert.equal(failed.status, 500);
  assert.equal((await failed.text()).includes("private database failure detail"), false);
  const list = await request("/api/admin/products", { cookie });
  const text = await list.text();
  assert.equal(text.includes("product-customer@example.test"), false);
  assert.equal(text.includes("inventoryReservationStatus"), false);
  assert.equal(text.includes("paymentReference"), false);
});

test("expired and revoked admin sessions reject product management", async () => {
  for (const state of ["expired", "revoked"]) {
    const { cookie } = await getAdminSession();
    const token = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
    const session = [...db.adminSessions.values()].find((entry) => entry.tokenHash === adminService.hashAdminSessionToken(token));
    if (state === "expired") session.expiresAt = new Date(Date.now() - 1000);
    else session.revokedAt = new Date();
    assert.equal((await request("/api/admin/products", { cookie })).status, 401);
  }
});
});
