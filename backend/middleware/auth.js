const { timingSafeEqual } = require("node:crypto");
const { getAuthCookieConfig } = require("../config/authCookie");
const { hashSessionToken, safeUser } = require("../services/authService");
const prisma = require("../services/prisma");
const SESSION_COOKIE_NAME = getAuthCookieConfig().name;

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (typeof header !== "string") return null;
  for (const entry of header.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0 || entry.slice(0, separator).trim() !== name) continue;
    const value = entry.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  return null;
}

async function authenticateSession(req, _res, next) {
  try {
    req.auth = null;
    const token = readCookie(req, SESSION_COOKIE_NAME);
    if (!token || token.length > 128) return next();
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            createdAt: true,
            isActive: true,
          },
        },
      },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user?.isActive) {
      return next();
    }
    req.auth = {
      user: safeUser(session.user),
      sessionId: session.id,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireAuthentication(req, res, next) {
  if (!req.auth) {
    res.status(401).json({ success: false, message: "Authentication is required." });
    return;
  }
  next();
}

function tokensMatchConstantTime(supplied, expected) {
  if (typeof supplied !== "string" || typeof expected !== "string") return false;
  const suppliedBytes = Buffer.from(supplied, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  const sameLength = suppliedBytes.length === expectedBytes.length;
  const comparableBytes = Buffer.alloc(expectedBytes.length);
  suppliedBytes.copy(comparableBytes, 0, 0, Math.min(suppliedBytes.length, comparableBytes.length));
  const equalBytes = timingSafeEqual(comparableBytes, expectedBytes);
  return sameLength && equalBytes;
}

function protectCsrf(req, res, next) {
  const origin = req.get("origin");
  const allowedOrigins = req.app.locals.allowedOrigins || new Set();
  if (origin && !allowedOrigins.has(origin)) {
    res.status(403).json({ success: false, message: "Request origin is not allowed." });
    return;
  }
  if (req.auth) {
    const supplied = req.get("x-csrf-token");
    if (!origin || !allowedOrigins.has(origin) || !tokensMatchConstantTime(supplied, req.auth.csrfToken)) {
      res.status(403).json({ success: false, message: "The request could not be verified." });
      return;
    }
  }
  next();
}

function ownsResource(authenticatedUserId, resourceUserId) {
  return resourceUserId == null || authenticatedUserId === resourceUserId;
}

module.exports = {
  SESSION_COOKIE_NAME,
  authenticateSession,
  ownsResource,
  protectCsrf,
  readCookie,
  requireAuthentication,
  tokensMatchConstantTime,
};
