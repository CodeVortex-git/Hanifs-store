const { createHash, randomBytes, scrypt: scryptCallback, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");
const prisma = require("./prisma");

const scrypt = promisify(scryptCallback);
const SCRYPT_OPTIONS = Object.freeze({ N: 16_384, r: 8, p: 5, maxmem: 64 * 1024 * 1024 });
const HASH_BYTES = 64;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Keep explicit legacy profiles readable as stronger profiles are introduced.
const SUPPORTED_SCRYPT_PROFILES = new Map([
  ["16384:8:1", { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }],
  ["16384:8:5", { N: 16_384, r: 8, p: 5, maxmem: 64 * 1024 * 1024 }],
]);

class AuthServiceError extends Error {
  constructor(status, message, code = null) {
    super(message);
    this.name = "AuthServiceError";
    this.status = status;
    this.code = code;
  }
}

function normalizeEmail(value) {
  if (typeof value !== "string") throw new AuthServiceError(400, "Enter a valid email address.");
  const email = value.trim().toLowerCase();
  if (email.length > 255 || !EMAIL_PATTERN.test(email)) {
    throw new AuthServiceError(400, "Enter a valid email address.");
  }
  return email;
}

function requiredName(value, label) {
  if (typeof value !== "string") throw new AuthServiceError(400, `Enter a valid ${label}.`);
  const name = value.trim();
  if (!name || name.length > 100) throw new AuthServiceError(400, `Enter a valid ${label}.`);
  return name;
}

function validatePassword(value) {
  if (typeof value !== "string") throw new AuthServiceError(400, "Password must be between 12 and 128 characters.");
  const length = [...value].length;
  if (length < 12 || length > 128 || Buffer.byteLength(value, "utf8") > 1024) {
    throw new AuthServiceError(400, "Password must be between 12 and 128 characters.");
  }
  return value;
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, HASH_BYTES, SCRYPT_OPTIONS);
  return `$scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

async function verifyPassword(password, encodedHash) {
  if (typeof encodedHash !== "string") return false;
  const match = /^\$scrypt\$(\d+)\$(\d+)\$(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/.exec(encodedHash);
  if (!match) return false;
  const [, nText, rText, pText, saltText, expectedText] = match;
  const N = Number(nText);
  const r = Number(rText);
  const p = Number(pText);
  const salt = Buffer.from(saltText, "base64url");
  const expected = Buffer.from(expectedText, "base64url");
  const profile = SUPPORTED_SCRYPT_PROFILES.get(`${N}:${r}:${p}`);
  if (!profile || salt.length < 16 || expected.length !== HASH_BYTES) {
    return false;
  }
  const actual = await scrypt(password, salt, expected.length, profile);
  return timingSafeEqual(actual, expected);
}

function safeUser(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    createdAt: user.createdAt,
  };
}

function createSessionCredentials() {
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(32).toString("base64url");
  return {
    token,
    csrfToken,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  };
}

async function persistSession(client, userId, credentials) {
  await client.session.create({
    data: {
      userId,
      tokenHash: credentials.tokenHash,
      csrfToken: credentials.csrfToken,
      expiresAt: credentials.expiresAt,
    },
  });
}

function isUniqueViolation(error) {
  return error?.code === "P2002";
}

async function register(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AuthServiceError(400, "Enter valid registration details.");
  }
  const email = normalizeEmail(body.email);
  const password = validatePassword(body.password);
  const firstName = requiredName(body.firstName, "first name");
  const lastName = requiredName(body.lastName, "last name");
  let phone = null;
  if (body.phone !== undefined && body.phone !== null && body.phone !== "") {
    if (typeof body.phone !== "string") throw new AuthServiceError(400, "Enter a valid phone number.");
    phone = body.phone.trim();
    if (!/^[0-9+()\s-]{7,20}$/.test(phone)) throw new AuthServiceError(400, "Enter a valid phone number.");
  }

  const passwordHash = await hashPassword(password);
  const credentials = createSessionCredentials();
  try {
    return await prisma.$transaction(async (transaction) => {
      const existing = await transaction.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) throw new AuthServiceError(409, "An account with this email already exists.", "email_exists");
      const user = await transaction.user.create({
        data: { email, passwordHash, firstName, lastName, phone },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          createdAt: true,
        },
      });
      await persistSession(transaction, user.id, credentials);
      return { user: safeUser(user), ...credentials };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AuthServiceError(409, "An account with this email already exists.", "email_exists");
    }
    throw error;
  }
}

async function login(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AuthServiceError(400, "Enter valid login details.");
  }
  const email = normalizeEmail(body.email);
  const password = validatePassword(body.password);
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordMatches = user
    ? await verifyPassword(password, user.passwordHash)
    : (await hashPassword(password), false);
  if (!user || !user.isActive || !passwordMatches) {
    throw new AuthServiceError(401, "Email or password is incorrect.", "invalid_credentials");
  }

  const credentials = createSessionCredentials();
  await persistSession(prisma, user.id, credentials);
  return { user: safeUser(user), ...credentials };
}

function validateProfileUpdate(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AuthServiceError(400, "Enter valid profile details.");
  }
  if (Object.hasOwn(body, "userId")) {
    throw new AuthServiceError(400, "Account identity cannot be supplied in the request.");
  }
  const allowedFields = new Set(["firstName", "lastName", "phone"]);
  if (Object.keys(body).some((field) => !allowedFields.has(field))) {
    throw new AuthServiceError(400, "Only first name, last name, and phone can be updated.");
  }
  if (Object.keys(body).length === 0) {
    throw new AuthServiceError(400, "Provide at least one profile field to update.");
  }

  const data = {};
  if (Object.hasOwn(body, "firstName")) data.firstName = requiredName(body.firstName, "first name");
  if (Object.hasOwn(body, "lastName")) data.lastName = requiredName(body.lastName, "last name");
  if (Object.hasOwn(body, "phone")) {
    if (body.phone === null || body.phone === "") {
      data.phone = null;
    } else {
      if (typeof body.phone !== "string") throw new AuthServiceError(400, "Enter a valid phone number.");
      const phone = body.phone.trim();
      if (!/^[0-9+()\s-]{7,20}$/.test(phone)) throw new AuthServiceError(400, "Enter a valid phone number.");
      data.phone = phone;
    }
  }
  return data;
}

async function updateProfile(userId, body) {
  if (typeof userId !== "string" || !userId) {
    throw new AuthServiceError(401, "Authentication is required.");
  }
  const data = validateProfileUpdate(body);
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
      },
    });
    return safeUser(user);
  } catch (error) {
    if (error?.code === "P2025") {
      throw new AuthServiceError(404, "The account could not be found.");
    }
    throw error;
  }
}

async function revokeSession(sessionId) {
  if (!sessionId) return;
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

module.exports = {
  AuthServiceError,
  SESSION_TTL_MS,
  hashPassword,
  login,
  normalizeEmail,
  register,
  revokeSession,
  safeUser,
  updateProfile,
  validatePassword,
  verifyPassword,
  hashSessionToken,
};
