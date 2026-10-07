const adminAuthService = require("../services/adminAuthService");
const { getAdminAuthCookieConfig } = require("../config/adminAuthCookie");

function setAdminCookie(res, token, expiresAt) {
  const { name, options } = getAdminAuthCookieConfig();
  res.cookie(name, token, { ...options, expires: expiresAt });
}

function clearAdminCookie(res) {
  const { name, options } = getAdminAuthCookieConfig();
  res.clearCookie(name, options);
}

function sendError(res, error) {
  if (error instanceof adminAuthService.AdminAuthError) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }
  console.error("Administrator authentication request failed:", error?.message || "Unknown error");
  res.status(500).json({ success: false, message: "We could not complete the authentication request. Please try again." });
}

async function login(req, res) {
  try {
    const result = await adminAuthService.login(req.body);
    setAdminCookie(res, result.token, result.expiresAt);
    res.status(200).json({ success: true, admin: result.admin, csrfToken: result.csrfToken });
  } catch (error) {
    sendError(res, error);
  }
}

async function logout(req, res) {
  try {
    await adminAuthService.revokeAdminSession(req.adminAuth?.sessionId);
    clearAdminCookie(res);
    res.status(200).json({ success: true, message: "You have been logged out." });
  } catch (error) {
    sendError(res, error);
  }
}

function currentAdmin(req, res) {
  if (!req.adminAuth) {
    res.status(401).json({ success: false, message: "Administrator authentication is required." });
    return;
  }
  res.status(200).json({ success: true, admin: req.adminAuth.admin, csrfToken: req.adminAuth.csrfToken });
}

module.exports = { clearAdminCookie, currentAdmin, login, logout, setAdminCookie };
