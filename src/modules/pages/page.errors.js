class PageApplicationError extends Error {
  constructor(message, statusCode = 500, publicMessage = message) {
    super(message);
    this.name = 'PageApplicationError';
    this.statusCode = statusCode;
    this.publicMessage = publicMessage;
  }
}

const assertServiceSuccess = (result, fallbackMessage, fallbackStatus = 500) => {
  if (result?.success) {
    return result.data;
  }
  throw new PageApplicationError(
    result?.error || fallbackMessage,
    result?.statusCode || fallbackStatus,
    fallbackMessage
  );
};

module.exports = {
  PageApplicationError,
  assertServiceSuccess,
};
