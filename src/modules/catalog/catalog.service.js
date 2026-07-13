const logger = require('../../../utils/logger');
const { sanitizeSearchQuery } = require('../../../utils/validators');
const { NotFoundError, ValidationError, toServiceResult } = require('../../shared/errors/domainErrors');
const { assertObjectId } = require('../../shared/validation/objectId');
const { createAuditService } = require('../audit/audit.service');
const { stableSlug, toMinorUnits } = require('../data/compatibility');
const { createCatalogRepository } = require('./catalog.repository');
const { RENTAL_POLICY } = require('../../config/rentalPolicy');

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

  const numRentalLimit = rentalLimit ? Number(rentalLimit) : RENTAL_POLICY.defaultTitleLicenceLimit;
  if (isNaN(numRentalLimit) || numRentalLimit < 1 || numRentalLimit > 50) {
    throw new ValidationError('Rental limit must be a number between 1 and 50');
  }

  return {
    schemaVersion: 2,
    slug: contentData.slug?.trim() || stableSlug(title),
    title: title.trim(),
    type,
    shortDescription: description?.trim() || '',
    synopsis: description?.trim() || '',
    description: description?.trim() || '',
    price: numPrice,
    rentalPriceMinor: toMinorUnits(numPrice),
    currencyCode: contentData.currencyCode?.trim() || 'CAD',
    image: image?.trim() || '/images/default.svg',
    posterReference: image?.trim() || '/images/default.svg',
    posterAlt: `${title.trim()} poster`,
    available: available === true || available === 'on',
    lifecycle: available === false ? 'unpublished' : 'published',
    rating: rating ? Math.min(10, Math.max(0, Number(rating))) : 7.5,
    genre: genre?.trim() || 'General',
    genres: [genre?.trim() || 'General'],
    duration: duration?.trim() || '2h',
    cast: cast?.trim() || '',
    castMembers: cast ? cast.split(',').map(item => item.trim()).filter(Boolean) : [],
    rentalLimit: Math.floor(numRentalLimit),
    licenceLimit: Math.floor(numRentalLimit),
  };
};

const lifecyclePatch = (action, now = new Date()) => {
  if (action === 'publish') {
    return { available: true, lifecycle: 'published', publishedAt: now, archivedAt: null };
  }
  if (action === 'unpublish') {
    return { available: false, lifecycle: 'unpublished' };
  }
  if (action === 'archive') {
    return { available: false, lifecycle: 'archived', archivedAt: now };
  }
  if (action === 'restore') {
    return { available: false, lifecycle: 'unpublished', archivedAt: null };
  }
  throw new ValidationError('Invalid lifecycle action');
};

const createCatalogService = ({
  repository = createCatalogRepository(),
  auditService = createAuditService(),
  logger: injectedLogger = logger,
  clock = () => new Date(),
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
    return service.updateLifecycle(contentId, 'archive');
  },

    updateLifecycle(contentId, action) {
    return toServiceResult(async () => {
      assertObjectId(contentId, 'content ID');
      const content = await repository.updateLifecycle(contentId, lifecyclePatch(action, clock()));
      if (!content) {
        throw new NotFoundError('Content not found');
      }
      injectedLogger.info(`Content lifecycle ${action}: ${contentId}`);
      await auditService.record({ action: `catalog.${action}`, targetType: 'content', targetId: content._id });
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

module.exports = { createCatalogService, lifecyclePatch, normalizeContentInput };
