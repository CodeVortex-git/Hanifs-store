const { getAdminAuthCookieConfig } = require("../config/adminAuthCookie");
const { tokensMatchConstantTime } = require("./auth");
const { hashAdminSessionToken, safeAdmin } = require("../services/adminAuthService");
const prisma = require("../services/prisma");

function readAdminCookie(req) {
  const cookieName = getAdminAuthCookieConfig().name;
  const header = req.headers.cookie;
  if (typeof header !== "string") return null;
  for (const entry of header.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0 || entry.slice(0, separator).trim() !== cookieName) continue;
    try {
      return decodeURIComponent(entry.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

async function authenticateAdminSession(req, _res, next) {
  try {
    req.adminAuth = null;
    const token = readAdminCookie(req);
    if (!token || token.length > 128) return next();
    const session = await prisma.adminSession.findUnique({
      where: { tokenHash: hashAdminSessionToken(token) },
      include: { admin: { select: { id: true, email: true, displayName: true, isActive: true } } },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.admin?.isActive) return next();
    req.adminAuth = {
      admin: safeAdmin(session.admin),
      sessionId: session.id,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireAdmin(req, res, next) {
  if (!req.adminAuth) {
    res.status(401).json({ success: false, message: "Administrator authentication is required." });
    return;
  }
  next();
}

function protectAdminRequest(req, res, next) {
  const origin = req.get("origin");
  const allowedOrigins = req.app.locals.allowedOrigins || new Set();
  if (!origin || !allowedOrigins.has(origin)) {
    res.status(403).json({ success: false, message: "Request origin is not allowed." });
    return;
  }
  if (req.adminAuth && !tokensMatchConstantTime(req.get("x-csrf-token"), req.adminAuth.csrfToken)) {
    res.status(403).json({ success: false, message: "The request could not be verified." });
    return;
  }
  next();
}

module.exports = { authenticateAdminSession, protectAdminRequest, readAdminCookie, requireAdmin };
