const { AppError } = require('./errorHandler');

const DEFAULT_ALLOWED_PREFIXES = ['/'];

const isProtocolRelative = (value) => value.startsWith('//') || value.startsWith('/\\');

const resolveSafeReturnPath = (value, allowedPrefixes = DEFAULT_ALLOWED_PREFIXES) => {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const candidate = value.trim();
  if (isProtocolRelative(candidate)) {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(candidate, 'https://streamnexus.local');
  } catch (error) {
    return null;
  }

  if (parsed.origin !== 'https://streamnexus.local') {
    return null;
  }

  const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  const allowed = allowedPrefixes.some(prefix => parsed.pathname === prefix || parsed.pathname.startsWith(prefix));
  return allowed ? path : null;
};

const requireSafeReturnPath = (value, allowedPrefixes) => {
  if (!value) {
    return null;
  }

  const safePath = resolveSafeReturnPath(value, allowedPrefixes);
  if (!safePath) {
    throw new AppError('Unsafe return destination', 400);
  }
  return safePath;
};

const queryLengthGuard = (maxLength = 2048) => (req, res, next) => {
  const queryIndex = req.originalUrl.indexOf('?');
  const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex + 1) : '';
  if (query.length > maxLength) {
    return next(new AppError('Query string is too long', 414));
  }
  return next();
};

module.exports = {
  queryLengthGuard,
  requireSafeReturnPath,
  resolveSafeReturnPath,
};
