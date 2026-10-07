const { createHash } = require("node:crypto");
const { after, afterEach, before, test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const db = { admins: new Map(), adminSessions: new Map(), users: new Map(), sessions: new Map() };
let id = 0;
let server;
let baseUrl;
let service;
let customerAuth;

const fakePrisma = {
  admin: {
    async findUnique({ where }) { return [...db.admins.values()].find((entry) => entry.email === where.email) || null; },
    async create({ data }) {
      if ([...db.admins.values()].some((entry) => entry.email === data.email)) {
        const error = new Error("Unique constraint failed"); error.code = "P2002"; throw error;
      }
      const admin = { id: `admin-${++id}`, isActive: true, createdAt: new Date(), ...data };
      db.admins.set(admin.id, admin);
      return admin;
    },
  },
  adminSession: {
    async create({ data }) {
      const session = { id: `admin-session-${++id}`, revokedAt: null, createdAt: new Date(), ...data };
      db.adminSessions.set(session.id, session);
      return session;
    },
    async findUnique({ where }) {
      const session = [...db.adminSessions.values()].find((entry) => entry.tokenHash === where.tokenHash);
      return session ? { ...session, admin: db.admins.get(session.adminId) } : null;
    },
    async updateMany({ where, data }) {
      const session = db.adminSessions.get(where.id);
      if (!session || (where.revokedAt === null && session.revokedAt !== null)) return { count: 0 };
      Object.assign(session, data); return { count: 1 };
    },
  },
  user: {
    async findUnique({ where }) { return [...db.users.values()].find((entry) => entry.email === where.email) || null; },
    async create({ data }) {
      if ([...db.users.values()].some((entry) => entry.email === data.email)) { const error = new Error(); error.code = "P2002"; throw error; }
      const user = { id: `user-${++id}`, isActive: true, createdAt: new Date(), ...data }; db.users.set(user.id, user); return user;
    },
  },
  session: {
    async create({ data }) { const session = { id: `session-${++id}`, revokedAt: null, createdAt: new Date(), ...data }; db.sessions.set(session.id, session); return session; },
  },
  async $transaction(callback) { return callback(fakePrisma); },
};

function cookieFrom(response) { return response.headers.get("set-cookie")?.split(";")[0] || ""; }
function tokenFrom(cookie) { return decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1)); }
async function request(route, { method = "GET", body, cookie, csrfToken, origin = "http://127.0.0.1:8080" } = {}) {
  const headers = {};
  if (origin) headers.Origin = origin;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
  return fetch(`${baseUrl}${route}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}

before(async () => {
  const prismaPath = require.resolve("../services/prisma");
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };
  service = require("../services/adminAuthService");
  customerAuth = require("../services/authService");
  const { adminLoginRateLimit } = require("../middleware/adminRateLimit");
  adminLoginRateLimit.reset();
  const app = require(path.resolve(__dirname, "../server"));
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const passwordHash = await customerAuth.hashPassword("a secure administrator password");
  await fakePrisma.admin.create({ data: { email: "admin@example.test", passwordHash, displayName: "Store Admin" } });
});

after(async () => {
  require("../middleware/adminRateLimit").adminLoginRateLimit.reset();
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  delete require.cache[require.resolve("../services/prisma")];
});

afterEach(() => require("../middleware/adminRateLimit").adminLoginRateLimit.reset());

test("admin login creates a separate hashed-token session and returns a safe identity", async () => {
  const response = await request("/api/admin/auth/login", { method: "POST", body: { email: " ADMIN@example.test ", password: "a secure administrator password" } });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(payload.admin, { id: "admin-1", email: "admin@example.test", displayName: "Store Admin" });
  assert.equal("passwordHash" in payload.admin, false);
  assert.equal("token" in payload, false);
  assert.ok(payload.csrfToken);
  const cookie = cookieFrom(response);
  assert.match(cookie, /^hanifs_admin_session=/);
  const token = tokenFrom(cookie);
  const session = [...db.adminSessions.values()][0];
  assert.equal(session.tokenHash, createHash("sha256").update(token).digest("hex"));
  assert.notEqual(session.tokenHash, token);
  assert.ok(session.expiresAt - session.createdAt <= service.ADMIN_SESSION_TTL_MS + 1000);
  assert.match(response.headers.get("set-cookie"), /HttpOnly/i);
  assert.equal((await request("/api/auth/me", { cookie })).status, 401);
});

test("customer registration cannot provision or authenticate as an administrator", async () => {
  const response = await request("/api/auth/register", { method: "POST", body: {
    email: "customer-admin@example.test", password: "customer password long enough", firstName: "A", lastName: "B", role: "admin",
  } });
  assert.equal(response.status, 201);
  assert.equal(db.admins.size, 1);
  const login = await request("/api/admin/auth/login", { method: "POST", body: { email: "customer-admin@example.test", password: "customer password long enough" } });
  assert.equal(login.status, 401);
  assert.equal((await login.json()).message, service.ADMIN_FAILURE_MESSAGE);
  const adminMe = await request("/api/admin/auth/me", { cookie: cookieFrom(response) });
  assert.equal(adminMe.status, 401);
  assert.equal((await request("/api/admin/auth/register", { method: "POST", body: {} })).status, 404);
});

test("admin login failures are generic and inactive admins cannot sign in", async () => {
  const admin = [...db.admins.values()][0];
  const wrong = await request("/api/admin/auth/login", { method: "POST", body: { email: admin.email, password: "wrong password long enough" } });
  const unknown = await request("/api/admin/auth/login", { method: "POST", body: { email: "missing@example.test", password: "wrong password long enough" } });
  assert.equal(wrong.status, 401);
  const unknownPayload = await unknown.json();
  assert.deepEqual(await wrong.json(), unknownPayload);
  admin.isActive = false;
  const inactive = await request("/api/admin/auth/login", { method: "POST", body: { email: admin.email, password: "a secure administrator password" } });
  assert.deepEqual(await inactive.json(), unknownPayload);
  admin.isActive = true;
});

test("admin identity survives requests; expiry and revocation reject the session", async () => {
  const login = await request("/api/admin/auth/login", { method: "POST", body: { email: "admin@example.test", password: "a secure administrator password" } });
  const cookie = cookieFrom(login);
  const me = await request("/api/admin/auth/me", { cookie });
  assert.equal(me.status, 200);
  const payload = await me.json();
  assert.equal(payload.admin.email, "admin@example.test");
  assert.ok(payload.csrfToken);
  const session = [...db.adminSessions.values()].find((entry) => entry.tokenHash === service.hashAdminSessionToken(tokenFrom(cookie)));
  const admin = db.admins.get(session.adminId);
  admin.isActive = false;
  assert.equal((await request("/api/admin/auth/me", { cookie })).status, 401);
  admin.isActive = true;
  session.expiresAt = new Date(Date.now() - 1000);
  assert.equal((await request("/api/admin/auth/me", { cookie })).status, 401);
  session.expiresAt = new Date(Date.now() + 60_000);
  session.revokedAt = new Date();
  assert.equal((await request("/api/admin/auth/me", { cookie })).status, 401);
});

test("admin logout revokes only the current admin session and requires CSRF", async () => {
  const first = await request("/api/admin/auth/login", { method: "POST", body: { email: "admin@example.test", password: "a secure administrator password" } });
  const firstCookie = cookieFrom(first);
  const firstMe = await (await request("/api/admin/auth/me", { cookie: firstCookie })).json();
  const second = await request("/api/admin/auth/login", { method: "POST", body: { email: "admin@example.test", password: "a secure administrator password" } });
  const secondCookie = cookieFrom(second);
  const denied = await request("/api/admin/auth/logout", { method: "POST", cookie: firstCookie, body: {} });
  assert.equal(denied.status, 403);
  const logout = await request("/api/admin/auth/logout", { method: "POST", cookie: firstCookie, csrfToken: firstMe.csrfToken, body: {} });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie"), /Expires=/i);
  assert.equal((await request("/api/admin/auth/me", { cookie: firstCookie })).status, 401);
  assert.equal((await request("/api/admin/auth/me", { cookie: secondCookie })).status, 200);
});

test("admin login requires an allowed Origin and production cookie has host-only secure attributes", async () => {
  const blocked = await request("/api/admin/auth/login", { method: "POST", body: {}, origin: "https://evil.example" });
  assert.equal(blocked.status, 403);
  const { getAdminAuthCookieConfig } = require("../config/adminAuthCookie");
  const cookie = getAdminAuthCookieConfig({ NODE_ENV: "production" });
  assert.equal(cookie.name, "__Host-hanifs_admin_session");
  assert.equal(cookie.options.httpOnly, true);
  assert.equal(cookie.options.secure, true);
  assert.equal(cookie.options.sameSite, "lax");
  assert.equal(cookie.options.path, "/");
});

test("actual admin login route is throttled at the configured limit", async () => {
  const limiter = require("../middleware/adminRateLimit").adminLoginRateLimit;
  limiter.reset();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await request("/api/admin/auth/login", { method: "POST", body: { email: "missing@example.test", password: "wrong password long enough" } });
    assert.equal(response.status, 401);
  }
  const limited = await request("/api/admin/auth/login", { method: "POST", body: { email: "missing@example.test", password: "wrong password long enough" } });
  assert.equal(limited.status, 429);
  limiter.reset();
});
