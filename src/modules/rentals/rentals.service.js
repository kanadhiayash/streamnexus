const logger = require('../../../utils/logger');
const { ConflictError, ForbiddenError, NotFoundError, toServiceResult } = require('../../shared/errors/domainErrors');
const { assertObjectId } = require('../../shared/validation/objectId');
const { createAuditService } = require('../audit/audit.service');
const { createRentalsRepository } = require('./rentals.repository');

const DEFAULT_RENTAL_LIMIT = 5;
const RENTAL_DAYS = 45;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const normalizeRentalLimit = (value) => {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit < 1) {
    return DEFAULT_RENTAL_LIMIT;
  }
  return Math.floor(limit);
};

const buildRentalWindow = (startDate = new Date()) => {
  const rentedAt = new Date(startDate);
  const expiresAt = new Date(rentedAt.getTime() + RENTAL_DAYS * DAY_IN_MS);
  return { rentedAt, expiresAt };
};

const normalizeRentalDates = (rental) => {
  const rentedAt = rental.rentedAt || rental.date || rental.createdAt || new Date();
  const expiresAt = rental.expiresAt || new Date(new Date(rentedAt).getTime() + RENTAL_DAYS * DAY_IN_MS);
  return { ...rental, rentedAt, expiresAt };
};

const buildCapacity = (content, activeCount) => {
  const limit = normalizeRentalLimit(content?.rentalLimit);
  const activeRentals = Number(activeCount) || 0;
  const remaining = Math.max(limit - activeRentals, 0);
  return {
    rentalLimit: limit,
    activeRentals,
    remaining,
    isFull: remaining <= 0,
  };
};

const createRentalsService = ({
  repository = createRentalsRepository(),
  auditService = createAuditService(),
  logger: injectedLogger = logger,
} = {}) => ({
  getUserRentals(userId) {
    return toServiceResult(async () => {
      assertObjectId(userId, 'user ID');
      const rentals = await repository.findUserRentals(userId);
      return rentals.map(normalizeRentalDates);
    });
  },

  createRental(userId, contentId) {
    return toServiceResult(async () => {
      assertObjectId(userId, 'user ID');
      assertObjectId(contentId, 'content ID');

      const content = await repository.findContentById(contentId);
      if (!content) {
        throw new NotFoundError('Content not found');
      }
      if (!content.available) {
        throw new ConflictError('Content is not available for rental');
      }

      const activeCount = await repository.countActiveByContent(contentId);
      const capacity = buildCapacity(content, activeCount);
      if (capacity.isFull) {
        throw new ConflictError(`Rental capacity reached for this title. ${capacity.rentalLimit} streamers already have active access.`);
      }

      const existingRental = await repository.findActiveByUserAndContent({ userId, contentId });
      if (existingRental) {
        throw new ConflictError('You already have an active rental of this content');
      }

      const rentalWindow = buildRentalWindow();
      const rental = await repository.createRental({
        userId,
        contentId,
        status: 'active',
        date: rentalWindow.rentedAt,
        rentedAt: rentalWindow.rentedAt,
        expiresAt: rentalWindow.expiresAt,
      });

      const user = await repository.findUserById(userId);
      if (user && !user.rented.some(id => id.equals(contentId))) {
        user.rented.push(contentId);
        await user.save();
      }

      injectedLogger.info(`Rental created: ${rental._id} for user ${userId}`);
      await auditService.record({ action: 'rentals.created', actorId: userId, targetType: 'rental', targetId: rental._id });
      return rental;
    });
  },

  completeRental(rentalId, userId) {
    return toServiceResult(async () => {
      assertObjectId(rentalId, 'rental ID');
      assertObjectId(userId, 'user ID');

      const rental = await repository.findRentalById(rentalId);
      if (!rental) {
        throw new NotFoundError('Rental not found');
      }
      if (rental.userId.toString() !== userId) {
        throw new ForbiddenError('Unauthorized');
      }

      if (!rental.rentedAt) {
        rental.rentedAt = rental.date || rental.createdAt || new Date();
      }
      if (!rental.expiresAt) {
        rental.expiresAt = buildRentalWindow(rental.rentedAt).expiresAt;
      }
      rental.status = 'completed';
      rental.completedAt = new Date();
      await rental.save();

      injectedLogger.info(`Rental completed: ${rentalId}`);
      await auditService.record({ action: 'rentals.completed', actorId: userId, targetType: 'rental', targetId: rentalId });
      return rental;
    });
  },

  getRentalById(rentalId) {
    return toServiceResult(async () => {
      assertObjectId(rentalId, 'rental ID');
      const rental = await repository.findRentalByIdForRead(rentalId);
      if (!rental) {
        throw new NotFoundError('Rental not found');
      }
      return normalizeRentalDates(rental);
    });
  },

  getAllRentals(filters = {}) {
    return toServiceResult(async () => {
      const rentals = await repository.findAllRentals(filters);
      return rentals.map(normalizeRentalDates);
    });
  },

  getRentalStats() {
    return toServiceResult(async () => {
      const totalRentals = await repository.countRentals();
      const activeRentals = await repository.countRentals({ status: 'active' });
      const completedRentals = await repository.countRentals({ status: 'completed' });
      return { totalRentals, activeRentals, completedRentals };
    });
  },

  attachCapacityToContents(contents = []) {
    return toServiceResult(async () => {
      const plainContents = contents.map(content => (content.toObject ? content.toObject() : content));
      const capacityEntries = await Promise.all(plainContents.map(async (content) => {
        const activeRentals = await repository.countActiveByContent(content._id);
        return [content._id.toString(), activeRentals];
      }));
      const capacityMap = new Map(capacityEntries);

      return plainContents.map(content => ({
        ...content,
        capacity: buildCapacity(content, capacityMap.get(content._id.toString()) || 0),
      }));
    });
  },

  async attachCapacityToContent(content) {
    const result = await this.attachCapacityToContents([content]);
    if (!result.success) {
      return result;
    }
    return { success: true, data: result.data[0] };
  },
});

module.exports = {
  DEFAULT_RENTAL_LIMIT,
  RENTAL_DAYS,
  buildCapacity,
  buildRentalWindow,
  createRentalsService,
  normalizeRentalDates,
  normalizeRentalLimit,
};
