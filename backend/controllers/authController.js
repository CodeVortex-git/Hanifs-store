const authService = require("../services/authService");
const { getAuthCookieConfig } = require("../config/authCookie");

function setSessionCookie(res, token, expiresAt, environment = process.env) {
  const { name, options } = getAuthCookieConfig(environment);
  res.cookie(name, token, {
    ...options,
    expires: expiresAt,
  });
}

function clearSessionCookie(res, environment = process.env) {
  const { name, options } = getAuthCookieConfig(environment);
  res.clearCookie(name, options);
}

function sendAuthError(res, error) {
  if (error instanceof authService.AuthServiceError) {
    res.status(error.status).json({
      success: false,
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
    });
    return;
  }
  if (error?.code === "P2002") {
    res.status(409).json({ success: false, message: "An account with this email already exists." });
    return;
  }
  console.error("Authentication request failed:", error?.message || "Unknown error");
  res.status(500).json({ success: false, message: "We could not complete the authentication request. Please try again." });
}

async function register(req, res) {
  try {
    const result = await authService.register(req.body);
    if (req.auth?.sessionId) await authService.revokeSession(req.auth.sessionId);
    setSessionCookie(res, result.token, result.expiresAt);
    res.status(201).json({ success: true, user: result.user, csrfToken: result.csrfToken });
  } catch (error) {
    sendAuthError(res, error);
  }
}

async function login(req, res) {
  try {
    const result = await authService.login(req.body);
    if (req.auth?.sessionId) await authService.revokeSession(req.auth.sessionId);
    setSessionCookie(res, result.token, result.expiresAt);
    res.status(200).json({ success: true, user: result.user, csrfToken: result.csrfToken });
  } catch (error) {
    sendAuthError(res, error);
  }
}

async function logout(req, res) {
  try {
    await authService.revokeSession(req.auth?.sessionId);
    clearSessionCookie(res);
    res.status(200).json({ success: true, message: "You have been logged out." });
  } catch (error) {
    sendAuthError(res, error);
  }
}

function currentUser(req, res) {
  if (!req.auth) {
    res.status(401).json({ success: false, message: "Authentication is required." });
    return;
  }
  res.status(200).json({ success: true, user: req.auth.user, csrfToken: req.auth.csrfToken });
}

async function updateCurrentUser(req, res) {
  try {
    const user = await authService.updateProfile(req.auth.user.id, req.body);
    res.status(200).json({ success: true, user });
  } catch (error) {
    sendAuthError(res, error);
  }
}

module.exports = { clearSessionCookie, currentUser, login, logout, register, setSessionCookie, updateCurrentUser };
