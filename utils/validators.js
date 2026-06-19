const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

const validatePassword = (password) => {
  return password && password.length >= 3;
};

const escapeRegExp = (value) => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const sanitizeSearchQuery = (query, maxLength = 80) => {
  if (!query || typeof query !== 'string') {
    return '';
  }
  return escapeRegExp(query.trim().slice(0, maxLength));
};

const validateContentData = (data) => {
  const errors = [];

  if (!data.title?.trim()) {
    errors.push('Title is required');
  }

  if (!['movie', 'tv'].includes(data.type)) {
    errors.push('Type must be either "movie" or "tv"');
  }

  if (!data.price || isNaN(Number(data.price)) || Number(data.price) < 0) {
    errors.push('Price must be a valid non-negative number');
  }

  if (data.description && typeof data.description !== 'string') {
    errors.push('Description must be a string');
  }

  if (data.rating && (isNaN(Number(data.rating)) || Number(data.rating) < 0 || Number(data.rating) > 10)) {
    errors.push('Rating must be a number between 0 and 10');
  }

  if (data.rentalLimit && (isNaN(Number(data.rentalLimit)) || Number(data.rentalLimit) < 1 || Number(data.rentalLimit) > 50)) {
    errors.push('Rental limit must be a number between 1 and 50');
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
};

const validateMongoId = (id) => {
  return id && id.match(/^[0-9a-fA-F]{24}$/);
};

const validatePagination = (page, limit) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit) || 10));
  const skip = (p - 1) * l;
  return { page: p, limit: l, skip };
};

module.exports = {
  validateEmail,
  validatePassword,
  sanitizeSearchQuery,
  validateContentData,
  validateMongoId,
  validatePagination,
};
