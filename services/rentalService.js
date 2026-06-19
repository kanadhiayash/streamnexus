const Rental = require('../models/Rental');
const Content = require('../models/Content');
const User = require('../models/User');
const logger = require('../utils/logger');

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

class RentalService {
  async getUserRentals(userId) {
    try {
      if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
        return { success: false, error: 'Invalid user ID' };
      }

      const rentals = await Rental.find({ userId })
        .populate('contentId', 'title image price type')
        .sort({ rentedAt: -1, date: -1 })
        .lean();

      return { success: true, data: rentals.map(normalizeRentalDates) };
    } catch (error) {
      logger.error('Error fetching user rentals:', error);
      return { success: false, error: error.message };
    }
  }

  async createRental(userId, contentId) {
    try {
      if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
        return { success: false, error: 'Invalid user ID' };
      }
      if (!contentId || !contentId.match(/^[0-9a-fA-F]{24}$/)) {
        return { success: false, error: 'Invalid content ID' };
      }

      const content = await Content.findById(contentId).lean();
      if (!content) {
        return { success: false, error: 'Content not found', statusCode: 404 };
      }

      if (!content.available) {
        return { success: false, error: 'Content is not available for rental' };
      }

      const activeCount = await Rental.countDocuments({
        contentId,
        status: 'active',
      });
      const capacity = buildCapacity(content, activeCount);
      if (capacity.isFull) {
        return {
          success: false,
          error: `Rental capacity reached for this title. ${capacity.rentalLimit} streamers already have active access.`,
        };
      }

      const existingRental = await Rental.findOne({
        userId,
        contentId,
        status: 'active',
      }).lean();

      if (existingRental) {
        return { success: false, error: 'You already have an active rental of this content' };
      }

      const rentalWindow = buildRentalWindow();
      const rental = await Rental.create({
        userId,
        contentId,
        status: 'active',
        date: rentalWindow.rentedAt,
        rentedAt: rentalWindow.rentedAt,
        expiresAt: rentalWindow.expiresAt,
      });

      const user = await User.findById(userId);
      if (user && !user.rented.some(id => id.equals(contentId))) {
        user.rented.push(contentId);
        await user.save();
      }

      logger.info(`Rental created: ${rental._id} for user ${userId}`);
      return { success: true, data: rental };
    } catch (error) {
      logger.error('Error creating rental:', error);
      return { success: false, error: error.message };
    }
  }

  async completeRental(rentalId, userId) {
    try {
      if (!rentalId || !rentalId.match(/^[0-9a-fA-F]{24}$/)) {
        return { success: false, error: 'Invalid rental ID' };
      }
      if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
        return { success: false, error: 'Invalid user ID' };
      }

      const rental = await Rental.findById(rentalId);
      if (!rental) {
        return { success: false, error: 'Rental not found', statusCode: 404 };
      }

      if (rental.userId.toString() !== userId) {
        return { success: false, error: 'Unauthorized', statusCode: 403 };
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

      logger.info(`Rental completed: ${rentalId}`);
      return { success: true, data: rental };
    } catch (error) {
      logger.error('Error completing rental:', error);
      return { success: false, error: error.message };
    }
  }

  async getRentalById(rentalId) {
    try {
      if (!rentalId || !rentalId.match(/^[0-9a-fA-F]{24}$/)) {
        return { success: false, error: 'Invalid rental ID' };
      }

      const rental = await Rental.findById(rentalId)
        .populate('contentId', 'title image price')
        .populate('userId', 'email')
        .lean();

      if (!rental) {
        return { success: false, error: 'Rental not found', statusCode: 404 };
      }

      return { success: true, data: normalizeRentalDates(rental) };
    } catch (error) {
      logger.error('Error fetching rental:', error);
      return { success: false, error: error.message };
    }
  }

  async getAllRentals(filters = {}) {
    try {
      const query = { ...filters };
      const rentals = await Rental.find(query)
        .populate('userId', 'email')
        .populate('contentId', 'title price')
        .sort({ rentedAt: -1, date: -1 })
        .lean();

      return { success: true, data: rentals.map(normalizeRentalDates) };
    } catch (error) {
      logger.error('Error fetching all rentals:', error);
      return { success: false, error: error.message };
    }
  }

  async getRentalStats() {
    try {
      const totalRentals = await Rental.countDocuments();
      const activeRentals = await Rental.countDocuments({ status: 'active' });
      const completedRentals = await Rental.countDocuments({ status: 'completed' });

      return {
        success: true,
        data: { totalRentals, activeRentals, completedRentals },
      };
    } catch (error) {
      logger.error('Error fetching rental stats:', error);
      return { success: false, error: error.message };
    }
  }

  async attachCapacityToContents(contents = []) {
    try {
      const plainContents = contents.map(content => (content.toObject ? content.toObject() : content));
      const capacityEntries = await Promise.all(plainContents.map(async (content) => {
        const activeRentals = await Rental.countDocuments({ contentId: content._id, status: 'active' });
        return [content._id.toString(), activeRentals];
      }));
      const capacityMap = new Map(capacityEntries);

      return {
        success: true,
        data: plainContents.map(content => ({
          ...content,
          capacity: buildCapacity(content, capacityMap.get(content._id.toString()) || 0),
        })),
      };
    } catch (error) {
      logger.error('Error attaching content capacity:', error);
      return { success: false, error: error.message };
    }
  }

  async attachCapacityToContent(content) {
    const result = await this.attachCapacityToContents([content]);
    if (!result.success) {
      return result;
    }
    return { success: true, data: result.data[0] };
  }
}

module.exports = new RentalService();
