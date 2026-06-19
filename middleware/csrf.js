const crypto = require('crypto');
const { AppError } = require('./errorHandler');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const getCsrfToken = (req) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
};

const csrfProtection = (req, res, next) => {
  const token = getCsrfToken(req);
  res.locals.csrfToken = token;

  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const submittedToken = req.body?._csrf || req.get('x-csrf-token');
  const tokenBuffer = Buffer.from(token);
  const submittedBuffer = Buffer.from(String(submittedToken || ''));

  if (
    !submittedToken ||
    tokenBuffer.length !== submittedBuffer.length ||
    !crypto.timingSafeEqual(tokenBuffer, submittedBuffer)
  ) {
    return next(new AppError('Invalid or missing CSRF token', 403));
  }

  next();
};

module.exports = { csrfProtection };
