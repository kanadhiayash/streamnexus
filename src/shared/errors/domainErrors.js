class DomainError extends Error {
  constructor(message, statusCode = 400, code = 'DOMAIN_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

class ValidationError extends DomainError {
  constructor(message = 'Invalid request') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

class NotFoundError extends DomainError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class ConflictError extends DomainError {
  constructor(message = 'Request conflicts with current state') {
    super(message, 409, 'CONFLICT');
  }
}

class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

const success = (data) => ({ success: true, data });

const failure = (error) => ({
  success: false,
  error: error.message || 'Something went wrong',
  statusCode: error.statusCode || 500,
  code: error.code || 'UNKNOWN_ERROR',
});

const toServiceResult = async (operation) => {
  try {
    return success(await operation());
  } catch (error) {
    return failure(error);
  }
};

module.exports = {
  DomainError,
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  success,
  failure,
  toServiceResult,
};
