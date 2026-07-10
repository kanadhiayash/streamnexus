const rateLimit = require('express-rate-limit');

const loginRateLimiter = rateLimit({
  windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 10,
  keyGenerator: (req) => {
    const ipKey = rateLimit.ipKeyGenerator ? rateLimit.ipKeyGenerator(req.ip) : req.ip;
    const emailKey = String(req.body?.email || 'unknown').trim().toLowerCase();
    return `${ipKey}:${emailKey}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: 'Too many login attempts. Please try again later.',
});

module.exports = { loginRateLimiter };
