function createRateLimiter({ windowMs, max, message = "Too many authentication attempts. Please try again later." }) {
  const buckets = new Map();

  function rateLimit(req, res, next) {
    const now = Date.now();
    const key = String(req.ip || req.socket?.remoteAddress || "unknown");
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (buckets.size > 10_000) {
      for (const [entryKey, entry] of buckets) {
        if (entry.resetAt <= now) buckets.delete(entryKey);
      }
    }
    res.set("RateLimit-Limit", String(max));
    res.set("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.set("RateLimit-Reset", String(Math.ceil((bucket.resetAt - now) / 1000)));
    if (bucket.count > max) {
      res.status(429).json({ success: false, message });
      return;
    }
    next();
  }
  rateLimit.reset = () => buckets.clear();
  return rateLimit;
}

const loginRateLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
const registerRateLimit = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 8 });

function resetAuthRateLimits() {
  loginRateLimit.reset();
  registerRateLimit.reset();
}

module.exports = { createRateLimiter, loginRateLimit, registerRateLimit, resetAuthRateLimits };
