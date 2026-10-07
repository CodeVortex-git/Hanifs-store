function getAdminAuthCookieConfig(environment = process.env) {
  const sameSite = String(environment.ADMIN_AUTH_COOKIE_SAME_SITE || environment.AUTH_COOKIE_SAME_SITE || "lax").toLowerCase();
  if (!["strict", "lax", "none"].includes(sameSite)) {
    throw new Error("ADMIN_AUTH_COOKIE_SAME_SITE must be Strict, Lax, or None.");
  }
  const isProduction = environment.NODE_ENV === "production";
  return {
    name: isProduction ? "__Host-hanifs_admin_session" : "hanifs_admin_session",
    options: { httpOnly: true, secure: isProduction || sameSite === "none", sameSite, path: "/" },
  };
}

module.exports = { getAdminAuthCookieConfig };
