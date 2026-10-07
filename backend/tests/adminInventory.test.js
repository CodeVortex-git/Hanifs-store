const { after, afterEach, before, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const db = {
  admins: new Map(), adminSessions: new Map(), variants: new Map(),
  orders: new Map(), adjustments: new Map(),
};
let server;
let baseUrl;
let adminCookie;
let csrfToken;
let failAuditInsert = false;
let nextId = 0;
let transactionTail = Promise.resolve();
let authService;

function productFor(variant) { return { id: variant.productId, name: variant.productName, category: variant.category, active: variant.productActive }; }

function matches(value, where) {
  if (!where || Object.keys(where).length === 0) return true;
  if (where.AND && !where.AND.every((part) => matches(value, part))) return false;
  if (where.OR && !where.OR.some((part) => matches(value, part))) return false;
  if (where.productId !== undefined && value.productId !== where.productId) return false;
  if (where.active !== undefined && value.active !== where.active) return false;
  if (where.stock?.lte !== undefined && value.stock > where.stock.lte) return false;
  if (where.stock?.gt !== undefined && value.stock <= where.stock.gt) return false;
  if (where.size?.contains && !value.size.toLowerCase().includes(where.size.contains.toLowerCase())) return false;
  if (where.color?.contains && !value.color.toLowerCase().includes(where.color.contains.toLowerCase())) return false;
  if (where.product?.is) {
    const product = productFor(value);
    for (const [field, condition] of Object.entries(where.product.is)) {
      if (condition?.contains && !String(product[field]).toLowerCase().includes(condition.contains.toLowerCase())) return false;
      if (typeof condition === "boolean" && product[field] !== condition) return false;
    }
  }
  return true;
}

function safeVariant(variant) { return { ...variant, product: productFor(variant) }; }

const fakePrisma = {
  admin: {
    async findUnique({ where }) { return [...db.admins.values()].find((admin) => admin.email === where.email) || null; },
    async create({ data }) { const admin = { id: `admin-${++nextId}`, isActive: true, createdAt: new Date(), ...data }; db.admins.set(admin.id, admin); return admin; },
  },
  adminSession: {
    async create({ data }) { const session = { id: `admin-session-${++nextId}`, createdAt: new Date(), revokedAt: null, ...data }; db.adminSessions.set(session.id, session); return session; },
    async findUnique({ where }) { const session = [...db.adminSessions.values()].find((entry) => entry.tokenHash === where.tokenHash); return session ? { ...session, admin: db.admins.get(session.adminId) } : null; },
    async updateMany({ where, data }) { const session = db.adminSessions.get(where.id); if (!session) return { count: 0 }; Object.assign(session, data); return { count: 1 }; },
  },
  productVariant: {
    async findMany({ where = {}, skip = 0, take = 50 }) {
      return [...db.variants.values()].filter((variant) => matches(variant, where))
        .sort((a, b) => a.productName.localeCompare(b.productName) || a.size.localeCompare(b.size) || a.color.localeCompare(b.color))
        .slice(skip, skip + take).map(safeVariant);
    },
    async count({ where = {} }) { return [...db.variants.values()].filter((variant) => matches(variant, where)).length; },
    async findUnique({ where }) { const variant = db.variants.get(where.id); return variant ? safeVariant(variant) : null; },
    async updateMany({ where, data }) {
      const variant = db.variants.get(where.id);
      if (!variant || (where.stock !== undefined && variant.stock !== where.stock)) return { count: 0 };
      Object.assign(variant, data);
      return { count: 1 };
    },
  },
  order: {
    async findMany({ where, select }) {
      return [...db.orders.values()].filter((order) => {
        const selectedVariantIds = where.items.some.productVariantId.in;
        return (order.inventoryReservationStatus === "reserved" || order.paymentReconciliationRequired) &&
          order.items.some((item) => selectedVariantIds.includes(item.productVariantId));
      }).map((order) => ({
        inventoryReservationStatus: order.inventoryReservationStatus,
        inventoryReservationExpiresAt: order.inventoryReservationExpiresAt,
        paymentReconciliationRequired: order.paymentReconciliationRequired,
        items: order.items.filter((item) => where.items.some.productVariantId.in.includes(item.productVariantId))
          .map(({ productVariantId, quantity }) => ({ productVariantId, quantity })),
      }));
    },
  },
  inventoryAdjustment: {
    async create({ data, select }) {
      if (failAuditInsert) throw new Error("simulated audit failure");
      const row = { id: `adjustment-${++nextId}`, createdAt: new Date(), ...data };
      db.adjustments.set(row.id, row);
      return Object.fromEntries(Object.keys(select).map((key) => [key, row[key]]));
    },
    async findMany({ where, take }) {
      return [...db.adjustments.values()].filter((entry) => entry.productVariantId === where.productVariantId)
        .sort((a, b) => b.createdAt - a.createdAt).slice(0, take)
        .map((entry) => ({ ...entry, admin: { id: entry.adminId, displayName: db.admins.get(entry.adminId).displayName } }));
    },
  },
  async $transaction(callback) {
    let release;
    const previous = transactionTail;
    transactionTail = new Promise((resolve) => { release = resolve; });
    await previous;
    const variantsBefore = structuredClone([...db.variants.entries()]);
    const adjustmentsBefore = structuredClone([...db.adjustments.entries()]);
    try { return await callback(fakePrisma); }
    catch (error) {
      db.variants = new Map(variantsBefore);
      db.adjustments = new Map(adjustmentsBefore);
      throw error;
    } finally { release(); }
  },
};

function addVariant({ id, productId = 1, productName = `Product ${productId}`, category = "Clothing", productActive = true, size = "M", color = "Navy", stock = 5, active = true }) {
  db.variants.set(id, { id, productId, productName, category, productActive, size, color, price: 10000, stock, active, createdAt: new Date(), updatedAt: new Date() });
}

function cookieFrom(response) { return response.headers.get("set-cookie")?.split(";")[0] || ""; }
async function request(route, { method = "GET", body, cookie = adminCookie, csrf = csrfToken, origin = "http://127.0.0.1:8080" } = {}) {
  const headers = {};
  if (origin) headers.Origin = origin;
  if (cookie) headers.Cookie = cookie;
  if (csrf) headers["X-CSRF-Token"] = csrf;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`${baseUrl}${route}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}

describe("admin inventory management", { concurrency: false }, () => {
  before(async () => {
    const prismaPath = require.resolve("../services/prisma");
    require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };
    authService = require("../services/authService");
    const app = require(path.resolve(__dirname, "../server"));
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    const hash = await authService.hashPassword("inventory administrator password");
    const admin = await fakePrisma.admin.create({ data: { email: "inventory-admin@example.test", passwordHash: hash, displayName: "Inventory Admin" } });
    addVariant({ id: 1, stock: 5 });
    addVariant({ id: 2, productId: 2, productName: "Inactive Coat", productActive: false, active: true, stock: 2, size: "L", color: "Tan" });
    addVariant({ id: 3, productId: 3, productName: "Inactive Variant", active: false, stock: 4, size: "S", color: "Black" });
    addVariant({ id: 4, productId: 4, productName: "Out of stock shirt", stock: 0, size: "S", color: "White" });
    const now = Date.now();
    db.orders.set("reserved-a", { inventoryReservationStatus: "reserved", inventoryReservationExpiresAt: new Date(now + 60_000), paymentReconciliationRequired: false, customerEmail: "private@example.test", paymentReference: "private-reference", items: [{ productVariantId: 1, quantity: 2 }] });
    db.orders.set("reserved-expired", { inventoryReservationStatus: "reserved", inventoryReservationExpiresAt: new Date(now - 60_000), paymentReconciliationRequired: false, items: [{ productVariantId: 1, quantity: 1 }] });
    db.orders.set("reconciliation", { inventoryReservationStatus: "released", inventoryReservationExpiresAt: null, paymentReconciliationRequired: true, paystackTransactionId: "private-transaction", items: [{ productVariantId: 1, quantity: 1 }] });
    const login = await request("/api/admin/auth/login", { method: "POST", cookie: "", csrf: "", body: { email: admin.email, password: "inventory administrator password" } });
    assert.equal(login.status, 200);
    adminCookie = cookieFrom(login);
    csrfToken = (await login.json()).csrfToken;
  });

  after(async () => {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    delete require.cache[require.resolve("../services/prisma")];
  });

  afterEach(() => require("../middleware/adminRateLimit").adminLoginRateLimit.reset());

  test("inventory reads require the separate admin session and summarize available, reserved, expired, and reconciliation state safely", async () => {
    assert.equal((await request("/api/admin/inventory", { cookie: "", csrf: "" })).status, 401);
    assert.equal((await request("/api/admin/inventory", { cookie: "hanifs_session=customer-session", csrf: "" })).status, 401);
    const response = await request("/api/admin/inventory");
    assert.equal(response.status, 200);
    const payload = await response.json();
    const item = payload.inventory.find((entry) => entry.id === 1);
    assert.equal(item.stock, 5);
    assert.equal(item.availableStock, 5);
    assert.equal(item.reservedStock, 3);
    assert.equal(item.activeReservedStock, 2);
    assert.equal(item.expiredReservationStock, 1);
    assert.equal(item.reconciliationRequired, true);
    assert.equal(item.isLowStock, true);
    assert.equal(payload.lowStockThreshold, 5);
    const serialized = JSON.stringify(payload);
    assert.equal(serialized.includes("private@example.test"), false);
    assert.equal(serialized.includes("private-reference"), false);
    assert.equal(serialized.includes("private-transaction"), false);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  });

  test("inventory filters and pagination are bounded and include inactive stock without treating it as available", async () => {
    const inactive = await (await request("/api/admin/inventory?status=inactive")).json();
    assert.equal(inactive.inventory.length, 2);
    assert.equal(inactive.inventory.find((item) => item.id === 2).availableStock, 0);
    assert.equal(inactive.inventory.find((item) => item.id === 3).availableStock, 0);
    const low = await (await request("/api/admin/inventory?lowStock=true")).json();
    assert.deepEqual(low.inventory.map((item) => item.id).sort((a, b) => a - b), [1, 4]);
    const search = await (await request("/api/admin/inventory?q=navy")).json();
    assert.equal(search.inventory.length, 1);
    const page = await (await request("/api/admin/inventory?limit=1&page=2")).json();
    assert.equal(page.inventory.length, 1);
    for (const query of ["limit=51", "page=0", "status=unknown", "lowStock=maybe", "wat=yes", "productId=0"]) {
      assert.equal((await request(`/api/admin/inventory?${query}`)).status, 400);
    }
  });

  test("variant detail includes recent adjustment history and rejects invalid IDs", async () => {
    const response = await request("/api/admin/inventory/1");
    assert.equal(response.status, 200);
    const detail = await response.json();
    assert.equal(detail.inventory.id, 1);
    assert.deepEqual(detail.adjustments, []);
    assert.equal((await request("/api/admin/inventory/nope")).status, 400);
    assert.equal((await request("/api/admin/inventory/999")).status, 404);
  });

  test("valid delta changes stock and writes an attributable adjustment history record", async () => {
    const response = await request("/api/admin/inventory/1/adjust", { method: "POST", body: { delta: 4, reason: "Received supplier delivery" } });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.inventory.stock, 9);
    assert.equal(payload.adjustment.delta, 4);
    assert.equal(payload.adjustment.previousStock, 5);
    assert.equal(payload.adjustment.resultingStock, 9);
    assert.equal(payload.adjustment.adminId, "admin-1");
    assert.equal(payload.adjustments[0].admin.displayName, "Inventory Admin");
  });

  test("negative adjustment respects available stock and rejects invalid values and IDs", async () => {
    const valid = await request("/api/admin/inventory/1/adjust", { method: "POST", body: { delta: -3, reason: "Damaged units removed" } });
    assert.equal(valid.status, 200);
    assert.equal((await valid.json()).inventory.stock, 6);
    const before = db.variants.get(1).stock;
    for (const body of [
      { delta: 0, reason: "No change" }, { delta: 1.5, reason: "Bad quantity" },
      { delta: 2_147_483_648, reason: "Overflow" },
      { delta: 1, reason: "  " }, { delta: 1, reason: "valid reason", stock: 100 },
    ]) assert.equal((await request("/api/admin/inventory/1/adjust", { method: "POST", body })).status, 400);
    assert.equal((await request("/api/admin/inventory/1/adjust", { method: "POST", body: { delta: -10, reason: "Too many" } })).status, 409);
    assert.equal(db.variants.get(1).stock, before);
    assert.equal((await request("/api/admin/inventory/999/adjust", { method: "POST", body: { delta: 1, reason: "Found stock" } })).status, 404);
  });

  test("adjustments require Origin and CSRF and cannot mass-assign stock or audit identity", async () => {
    const body = { delta: 1, reason: "Stock correction" };
    assert.equal((await request("/api/admin/inventory/1/adjust", { method: "POST", csrf: "", body })).status, 403);
    assert.equal((await request("/api/admin/inventory/1/adjust", { method: "POST", origin: "https://attacker.example", body })).status, 403);
    assert.equal((await request("/api/admin/inventory/1/adjust", { method: "POST", body: { ...body, adminId: "other-admin" } })).status, 400);
  });

  test("inactive variants remain adjustable for physical corrections but are not sellable", async () => {
    const response = await request("/api/admin/inventory/2/adjust", { method: "POST", body: { delta: 3, reason: "Counted inactive item" } });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.inventory.stock, 5);
    assert.equal(payload.inventory.availableStock, 0);
  });

  test("audit failure rolls the stock change back", async () => {
    const beforeStock = db.variants.get(3).stock;
    failAuditInsert = true;
    const response = await request("/api/admin/inventory/3/adjust", { method: "POST", body: { delta: 1, reason: "Test transaction rollback" } });
    failAuditInsert = false;
    assert.equal(response.status, 500);
    assert.equal(db.variants.get(3).stock, beforeStock);
  });

  test("concurrent adjustments cannot lose updates or reduce stock below zero", async () => {
    const service = require("../services/adminInventoryService");
    const additions = await Promise.all([
      service.adjustInventory("3", { delta: 2, reason: "Cycle count increase A" }, "admin-1"),
      service.adjustInventory("3", { delta: 4, reason: "Cycle count increase B" }, "admin-1"),
    ]);
    assert.equal(additions.length, 2);
    assert.equal(db.variants.get(3).stock, 10);
    const before = db.variants.get(3).stock;
    const removals = await Promise.allSettled([
      service.adjustInventory("3", { delta: -7, reason: "Remove damaged stock A" }, "admin-1"),
      service.adjustInventory("3", { delta: -6, reason: "Remove damaged stock B" }, "admin-1"),
    ]);
    assert.equal(removals.filter((entry) => entry.status === "fulfilled").length, 1);
    assert.equal(removals.filter((entry) => entry.status === "rejected" && entry.reason.status === 409).length, 1);
    assert.equal(db.variants.get(3).stock >= 0, true);
    assert.equal(db.variants.get(3).stock, before - 7);
  });
});
