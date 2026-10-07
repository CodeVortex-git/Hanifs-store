function getAuthCookieConfig(environment = process.env) {
  const sameSite = String(environment.AUTH_COOKIE_SAME_SITE || "lax").toLowerCase();
  if (!["strict", "lax", "none"].includes(sameSite)) {
    throw new Error("AUTH_COOKIE_SAME_SITE must be Strict, Lax, or None.");
  }
  const isProduction = environment.NODE_ENV === "production";
  return {
    name: isProduction ? "__Host-hanifs_session" : "hanifs_session",
    options: {
      httpOnly: true,
      secure: isProduction || sameSite === "none",
      sameSite,
      path: "/",
    },
  };
}

module.exports = { getAuthCookieConfig };
