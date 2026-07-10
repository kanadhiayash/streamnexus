const logger = require('../../../utils/logger');
const { sanitizeSearchQuery } = require('../../../utils/validators');
const { NotFoundError, ValidationError, toServiceResult } = require('../../shared/errors/domainErrors');
const { assertObjectId } = require('../../shared/validation/objectId');
const { createAuditService } = require('../audit/audit.service');
const { createCatalogRepository } = require('./catalog.repository');

const normalizeContentInput = (contentData) => {
  const { title, type, description, price, image, available, rating, genre, duration, cast, rentalLimit } = contentData;

  if (!title?.trim() || !type || price === undefined || price === '') {
    throw new ValidationError('Title, type, and price are required');
  }

  if (!['movie', 'tv'].includes(type)) {
    throw new ValidationError('Invalid content type');
  }

  const numPrice = Number(price);
  if (isNaN(numPrice) || numPrice < 0) {
    throw new ValidationError('Price must be a valid non-negative number');
  }

  const numRentalLimit = rentalLimit ? Number(rentalLimit) : 5;
  if (isNaN(numRentalLimit) || numRentalLimit < 1 || numRentalLimit > 50) {
    throw new ValidationError('Rental limit must be a number between 1 and 50');
  }

  return {
    title: title.trim(),
    type,
    description: description?.trim() || '',
    price: numPrice,
    image: image?.trim() || '/images/default.svg',
    available: available === true || available === 'on',
    rating: rating ? Math.min(10, Math.max(0, Number(rating))) : 7.5,
    genre: genre?.trim() || 'General',
    duration: duration?.trim() || '2h',
    cast: cast?.trim() || '',
    rentalLimit: Math.floor(numRentalLimit),
  };
};

const createCatalogService = ({
  repository = createCatalogRepository(),
  auditService = createAuditService(),
  logger: injectedLogger = logger,
} = {}) => {
  const service = {
    getAllContent(filters = {}) {
    return toServiceResult(() => repository.findAll(filters));
  },

    getContentById(contentId) {
    return toServiceResult(async () => {
      assertObjectId(contentId, 'content ID');
      const content = await repository.findById(contentId);
      if (!content) {
        throw new NotFoundError('Content not found');
      }
      return content;
    });
  },

    createContent(contentData) {
    return toServiceResult(async () => {
      const content = await repository.create(normalizeContentInput(contentData));
      injectedLogger.info(`Content created: ${content._id}`);
      await auditService.record({ action: 'catalog.created', targetType: 'content', targetId: content._id });
      return content;
    });
  },

    updateContent(contentId, contentData) {
    return toServiceResult(async () => {
      assertObjectId(contentId, 'content ID');
      const content = await repository.update(contentId, normalizeContentInput(contentData));
      if (!content) {
        throw new NotFoundError('Content not found');
      }
      injectedLogger.info(`Content updated: ${contentId}`);
      await auditService.record({ action: 'catalog.updated', targetType: 'content', targetId: content._id });
      return content;
    });
  },

    deleteContent(contentId) {
    return toServiceResult(async () => {
      assertObjectId(contentId, 'content ID');
      const content = await repository.delete(contentId);
      if (!content) {
        throw new NotFoundError('Content not found');
      }
      injectedLogger.info(`Content deleted: ${contentId}`);
      await auditService.record({ action: 'catalog.deleted', targetType: 'content', targetId: content._id });
      return content;
    });
  },

    getAvailableContent(filters = {}) {
    return toServiceResult(() => repository.findAvailable(filters));
  },

    getSimilarContent(contentId, limit = 4) {
    return toServiceResult(async () => {
      const result = await service.getContentById(contentId);
      if (!result.success) {
        throw new NotFoundError(result.error);
      }
      return repository.findSimilar({ contentId, type: result.data.type, limit });
    });
  },

    searchContent(query, filters = {}) {
    return toServiceResult(() => {
      if (!query?.trim()) {
        throw new ValidationError('Search query is required');
      }
      const safeQuery = sanitizeSearchQuery(query);
      if (!safeQuery) {
        throw new ValidationError('Search query is required');
      }
      return repository.search({ query: safeQuery, filters });
    });
  },

    getTrendingContent(limit = 10) {
    return toServiceResult(() => repository.findTrending(limit));
  },

    getContentByGenre(genre, limit = 10) {
    return toServiceResult(() => {
      if (!genre?.trim()) {
        throw new ValidationError('Genre is required');
      }
      const safeGenre = sanitizeSearchQuery(genre);
      if (!safeGenre) {
        throw new ValidationError('Genre is required');
      }
      return repository.findByGenre({ genre: safeGenre, limit });
    });
  },

    getTopRatedContent(limit = 10) {
    return toServiceResult(() => repository.findTopRated(limit));
  },
  };

  return service;
};

module.exports = { createCatalogService, normalizeContentInput };
