const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

const isObjectId = (value) => typeof value === 'string' && OBJECT_ID_PATTERN.test(value);

const assertObjectId = (value, label = 'ID') => {
  if (!isObjectId(value)) {
    const error = new Error(`Invalid ${label}`);
    error.statusCode = 400;
    throw error;
  }
};

module.exports = { isObjectId, assertObjectId };
