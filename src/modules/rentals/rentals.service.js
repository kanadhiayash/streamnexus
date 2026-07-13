const crypto = require('crypto');

const logger = require('../../../utils/logger');
const { ConflictError, ForbiddenError, NotFoundError, toServiceResult } = require('../../shared/errors/domainErrors');
const { assertObjectId } = require('../../shared/validation/objectId');
const { RENTAL_POLICY } = require('../../config/rentalPolicy');
const { createAuditService } = require('../audit/audit.service');
const { mapTitleToV2, publicRentalReference } = require('../data/compatibility');
const { createRentalsRepository } = require('./rentals.repository');

const DEFAULT_RENTAL_LIMIT = RENTAL_POLICY.defaultTitleLicenceLimit;
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

const hashIdempotencyKey = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  return crypto.createHash('sha256').update(value.trim()).digest('hex');
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
  clock = () => new Date(),
} = {}) => ({
  getUserRentals(userId) {
    return toServiceResult(async () => {
      assertObjectId(userId, 'user ID');
      await this.expireRentals(clock(), { userId });
      const rentals = await repository.findUserRentals(userId);
      return rentals.map(normalizeRentalDates);
    });
  },

  createRental(userId, contentId, options = {}) {
    return toServiceResult(async () => {
      assertObjectId(userId, 'user ID');
      assertObjectId(contentId, 'content ID');

      const idempotencyKeyHash = hashIdempotencyKey(options.idempotencyKey) || options.idempotencyKeyHash;
      if (idempotencyKeyHash) {
        const existingByKey = await repository.findByIdempotencyKey({ userId, idempotencyKeyHash });
        if (existingByKey) {
          return { ...existingByKey, idempotent: true };
        }
      }

      const existingRental = await repository.findActiveByUserAndContent({ userId, contentId });
      if (existingRental) {
        return { ...existingRental, idempotent: true };
      }

      const activeForUser = await repository.countActiveByUser(userId);
      if (activeForUser >= RENTAL_POLICY.maxActiveRentalsPerMember) {
        throw new ConflictError('Active access limit reached. Return an access pass before activating another.');
      }

      const content = await repository.findContentById(contentId);
      if (!content) {
        throw new NotFoundError('Content not found');
      }
      if (!content.available) {
        throw new ConflictError('This title is not available for access activation');
      }

      const reservedContent = await repository.reserveLicence(contentId);
      if (!reservedContent) {
        const activeCount = await repository.countActiveByContent(contentId);
        const capacity = buildCapacity(content, activeCount);
        throw new ConflictError(`Capacity reached. All simulated access seats are currently active for this title. ${capacity.rentalLimit} members already have active access.`);
      }

      let rental;
      try {
        const rentalWindow = buildRentalWindow(clock());
        const titleSnapshot = mapTitleToV2(reservedContent, reservedContent.activeLicenceCount);
        rental = await repository.createRental({
          schemaVersion: 2,
          publicReference: options.publicReference,
          userId,
          contentId,
          titleId: contentId,
          status: 'active',
          titleSnapshot: {
            title: titleSnapshot.title,
            slug: titleSnapshot.slug,
            posterReference: titleSnapshot.posterReference,
          },
          priceSnapshot: {
            amountMinor: titleSnapshot.rentalPriceMinor,
            currencyCode: titleSnapshot.currencyCode,
          },
          policySnapshot: {
            version: RENTAL_POLICY.version,
            durationDays: RENTAL_POLICY.durationDays,
          },
          idempotencyKeyHash,
          date: rentalWindow.rentedAt,
          rentedAt: rentalWindow.rentedAt,
          startedAt: rentalWindow.rentedAt,
          expiresAt: rentalWindow.expiresAt,
        });
        rental.publicReference = rental.publicReference || publicRentalReference(rental._id);
        await rental.save();
      } catch (error) {
        await repository.releaseLicence(contentId);
        if (error.code === 11000) {
          const duplicate = await repository.findActiveByUserAndContent({ userId, contentId });
          if (duplicate) {
            return { ...duplicate, idempotent: true };
          }
        }
        throw error;
      }

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
    return this.returnRental(rentalId, userId);
  },

  returnRental(rentalId, userId) {
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
      if (rental.status !== 'active') {
        return rental;
      }

      const returnedRental = await repository.markRentalReturned({ rentalId, userId, endedAt: clock() });
      if (!returnedRental) {
        return repository.findRentalById(rentalId);
      }
      await repository.releaseLicence(returnedRental.contentId);

      injectedLogger.info(`Rental completed: ${rentalId}`);
      await auditService.record({ action: 'rentals.completed', actorId: userId, targetType: 'rental', targetId: rentalId });
      return returnedRental;
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

  getRentalByPublicReference(publicReference, userId) {
    return toServiceResult(async () => {
      const rental = await repository.findRentalByPublicReference(publicReference);
      if (!rental) {
        throw new NotFoundError('Rental not found');
      }
      if (rental.userId.toString() !== userId) {
        throw new ForbiddenError('Unauthorized');
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
      const completedRentals = await repository.countRentals({ status: { $in: ['completed', 'returned'] } });
      return { totalRentals, activeRentals, completedRentals };
    });
  },

  attachCapacityToContents(contents = []) {
    return toServiceResult(async () => {
      const plainContents = contents.map(content => (content.toObject ? content.toObject() : content));
      const capacityMap = await repository.countActiveByContents(plainContents.map(content => content._id));

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

  expireRentals(now = clock()) {
    return toServiceResult(async () => {
      const expired = await repository.findExpiredActive(now);
      let released = 0;
      for (const rental of expired) {
        const expiredRental = await repository.markRentalExpired({ rentalId: rental._id, endedAt: now });
        if (!expiredRental) continue;
        await repository.releaseLicence(expiredRental.contentId);
        released += 1;
      }
      return { expired: expired.length, released };
    });
  },

  cancelRentalAsAdmin(rentalId, actorId) {
    return toServiceResult(async () => {
      assertObjectId(rentalId, 'rental ID');
      const rental = await repository.findRentalById(rentalId);
      if (!rental) {
        throw new NotFoundError('Rental not found');
      }
      const cancelledRental = await repository.markRentalCancelled({ rentalId, endedAt: clock() });
      if (!cancelledRental) {
        return repository.findRentalById(rentalId);
      }
      await repository.releaseLicence(cancelledRental.contentId);
      await auditService.record({ action: 'SNX.access.cancelled', actorId, actorRole: 'admin', targetType: 'rental', targetId: rentalId });
      return cancelledRental;
    });
  },

  reconcileLicenceCounts() {
    return toServiceResult(() => repository.reconcileActiveLicenceCounts());
  },
});

module.exports = {
  DEFAULT_RENTAL_LIMIT,
  RENTAL_DAYS,
  buildCapacity,
  buildRentalWindow,
  createRentalsService,
  hashIdempotencyKey,
  normalizeRentalDates,
  normalizeRentalLimit,
};
