const logger = require('../utils/logger');

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

  logger.error(`${err.statusCode} - ${err.message}`, err);

  // Always log full error details for debugging
  console.error('[ERROR]', {
    statusCode: err.statusCode,
    message: err.message,
    path: req.path,
    method: req.method,
    stack: err.stack
  });

  if (process.env.NODE_ENV === 'development') {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      stack: err.stack,
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

module.exports = { AppError, errorHandler, asyncHandler, catchAsync };
