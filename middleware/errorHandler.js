const logger = require('../utils/logger');

const SENSITIVE_PATTERN = /(email|password|token|cookie|sessionId|session|authorization)=([^&\s]+)/gi;
const SECRET_WORD_PATTERN = /(password|token|cookie|sessionId|session|authorization)/gi;

const redactSensitive = (value = '') => String(value)
  .replace(SENSITIVE_PATTERN, '$1=[redacted]')
  .replace(SECRET_WORD_PATTERN, '[redacted]');

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.timestamp = new Date().toISOString();
  }
}

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || 'Internal server error';

  const safeMessage = redactSensitive(err.message);
  const safeStack = redactSensitive(err.stack || '');

  logger.error(`${err.statusCode} - ${safeMessage}`, safeStack);

  // Always log full error details for debugging
  console.error('[ERROR]', {
    statusCode: err.statusCode,
    message: safeMessage,
    path: req.path,
    method: req.method,
    stack: safeStack
  });

  if (process.env.NODE_ENV === 'development') {
    return res.status(err.statusCode).json({
      success: false,
      error: safeMessage,
      stack: safeStack,
      timestamp: err.timestamp,
    });
  }

  const userFriendlyMessage =
    err.statusCode === 404 ? 'Resource not found' : 'Something went wrong. Please try again later.';

  // Check if it's an API endpoint (starts with /content/)
  const isApiEndpoint = req.path.startsWith('/content/') && !req.path.includes('/edit') && !req.path.includes('/new');

  if (isApiEndpoint && req.accepts('json')) {
    return res.status(err.statusCode).json({
      success: false,
      error: userFriendlyMessage,
      timestamp: err.timestamp,
    });
  }

  res.status(err.statusCode).render('error', { message: userFriendlyMessage });
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const catchAsync = (fn) => asyncHandler(fn);

module.exports = { AppError, errorHandler, asyncHandler, catchAsync, redactSensitive };
