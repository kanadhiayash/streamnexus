const rateLimit = require('express-rate-limit');

const numberFromEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const ipKey = (req) => (rateLimit.ipKeyGenerator ? rateLimit.ipKeyGenerator(req.ip) : req.ip);

const accountKey = (req) => String(req.body?.email || 'unknown').trim().toLowerCase();

const createLimiter = ({
  envPrefix,
  fallbackLimit,
  fallbackWindowMs = 15 * 60 * 1000,
  keyGenerator = ipKey,
  message,
  skipSuccessfulRequests = false,
}) => rateLimit({
  windowMs: numberFromEnv(`${envPrefix}_WINDOW_MS`, fallbackWindowMs),
  limit: () => numberFromEnv(`${envPrefix}_MAX`, fallbackLimit),
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests,
  message,
});

const loginRateLimiter = createLimiter({
  envPrefix: 'LOGIN_RATE_LIMIT',
  fallbackLimit: 10,
  keyGenerator: (req) => {
    return `${ipKey(req)}:${accountKey(req)}`;
  },
  skipSuccessfulRequests: true,
  message: 'Too many login attempts. Please try again later.',
});

const signupRateLimiter = createLimiter({
  envPrefix: 'SIGNUP_RATE_LIMIT',
  fallbackLimit: 20,
  skipSuccessfulRequests: true,
  message: 'Too many signup attempts. Please try again later.',
});

const authPageRateLimiter = createLimiter({
  envPrefix: 'AUTH_PAGE_RATE_LIMIT',
  fallbackLimit: 300,
  fallbackWindowMs: 5 * 60 * 1000,
  message: 'Too many authentication page requests. Please slow down and try again.',
});

const searchRateLimiter = createLimiter({
  envPrefix: 'SEARCH_RATE_LIMIT',
  fallbackLimit: 120,
  fallbackWindowMs: 5 * 60 * 1000,
  message: 'Too many search requests. Please slow down and try again.',
});

const accessMutationRateLimiter = createLimiter({
  envPrefix: 'ACCESS_MUTATION_RATE_LIMIT',
  fallbackLimit: 60,
  fallbackWindowMs: 10 * 60 * 1000,
  keyGenerator: req => `${ipKey(req)}:${req.session?.user?.id || 'guest'}`,
  message: 'Too many access requests. Please try again later.',
});

const myListMutationRateLimiter = createLimiter({
  envPrefix: 'MY_LIST_RATE_LIMIT',
  fallbackLimit: 90,
  fallbackWindowMs: 10 * 60 * 1000,
  keyGenerator: req => `${ipKey(req)}:${req.session?.user?.id || 'guest'}`,
  message: 'Too many list changes. Please try again later.',
});

const adminMutationRateLimiter = createLimiter({
  envPrefix: 'ADMIN_MUTATION_RATE_LIMIT',
  fallbackLimit: 80,
  fallbackWindowMs: 10 * 60 * 1000,
  keyGenerator: req => `${ipKey(req)}:${req.session?.user?.id || 'guest'}`,
  message: 'Too many admin changes. Please try again later.',
});

module.exports = {
  accessMutationRateLimiter,
  adminMutationRateLimiter,
  authPageRateLimiter,
  loginRateLimiter,
  myListMutationRateLimiter,
  searchRateLimiter,
  signupRateLimiter,
};
