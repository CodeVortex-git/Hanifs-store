const { createHash, randomBytes } = require("node:crypto");
const prisma = require("./prisma");
const { hashPassword, normalizeEmail, validatePassword, verifyPassword } = require("./authService");

const ADMIN_SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const ADMIN_FAILURE_MESSAGE = "Email or password is incorrect.";

class AdminAuthError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
  }
}

function safeAdmin(admin) {
  return { id: admin.id, email: admin.email, displayName: admin.displayName };
}

function createAdminSessionCredentials() {
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(32).toString("base64url");
  return {
    token,
    csrfToken,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + ADMIN_SESSION_TTL_MS),
  };
}

async function persistAdminSession(client, adminId, credentials) {
  await client.adminSession.create({
    data: {
      adminId,
      tokenHash: credentials.tokenHash,
      csrfToken: credentials.csrfToken,
      expiresAt: credentials.expiresAt,
    },
  });
}

async function login(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AdminAuthError(400, "Enter valid login details.");
  }
  let email;
  try {
    email = normalizeEmail(body.email);
    validatePassword(body.password);
  } catch {
    // Keep credential failures indistinguishable, including malformed inputs.
    throw new AdminAuthError(401, ADMIN_FAILURE_MESSAGE);
  }

  const admin = await prisma.admin.findUnique({ where: { email } });
  const passwordMatches = admin
    ? await verifyPassword(body.password, admin.passwordHash)
    : (await hashPassword(body.password), false);
  if (!admin || !admin.isActive || !passwordMatches) {
    throw new AdminAuthError(401, ADMIN_FAILURE_MESSAGE);
  }

  const credentials = createAdminSessionCredentials();
  await persistAdminSession(prisma, admin.id, credentials);
  return { admin: safeAdmin(admin), ...credentials };
}

async function revokeAdminSession(sessionId) {
  if (!sessionId) return;
  await prisma.adminSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

function hashAdminSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

module.exports = {
  ADMIN_FAILURE_MESSAGE,
  ADMIN_SESSION_TTL_MS,
  AdminAuthError,
  hashAdminSessionToken,
  login,
  revokeAdminSession,
  safeAdmin,
};
