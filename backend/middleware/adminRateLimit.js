const { createRateLimiter } = require("./authRateLimit");

// Admin login gets a distinct, stricter per-process limit from customer auth.
const adminLoginRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many administrator sign-in attempts. Please try again later.",
});

module.exports = { adminLoginRateLimit };
