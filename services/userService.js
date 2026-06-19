const User = require('../models/User');
const Rental = require('../models/Rental');
const logger = require('../utils/logger');

class UserService {
  async getUserById(userId) {
    try {
      if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
        return { success: false, error: 'Invalid user ID' };
      }
      const user = await User.findById(userId).lean();
      if (!user) {
        return { success: false, error: 'User not found', statusCode: 404 };
      }
      return { success: true, data: user };
    } catch (error) {
      logger.error('Error fetching user:', error);
      return { success: false, error: error.message };
    }
  }

  async getShortlist(userId) {
    try {
      if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
        return { success: false, error: 'Invalid user ID' };
      }
      const user = await User.findById(userId).populate('shortlist').lean();
      if (!user) {
        return { success: false, error: 'User not found', statusCode: 404 };
      }
      return { success: true, data: user.shortlist || [] };
    } catch (error) {
      logger.error('Error fetching shortlist:', error);
      return { success: false, error: error.message };
    }
  }

  async addToShortlist(userId, contentId) {
    try {
      if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
        return { success: false, error: 'Invalid user ID' };
      }
      if (!contentId || !contentId.match(/^[0-9a-fA-F]{24}$/)) {
        return { success: false, error: 'Invalid content ID' };
      }

      const user = await User.findById(userId);
      if (!user) {
        return { success: false, error: 'User not found', statusCode: 404 };
      }

      if (!user.shortlist.some(id => id.equals(contentId))) {
        user.shortlist.push(contentId);
        await user.save();
        logger.info(`Added to shortlist: user ${userId}, content ${contentId}`);
      }

      return { success: true, data: user };
    } catch (error) {
      logger.error('Error adding to shortlist:', error);
      return { success: false, error: error.message };
    }
  }

  async removeFromShortlist(userId, contentId) {
    try {
      if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
        return { success: false, error: 'Invalid user ID' };
      }
      if (!contentId || !contentId.match(/^[0-9a-fA-F]{24}$/)) {
        return { success: false, error: 'Invalid content ID' };
      }

      const user = await User.findById(userId);
      if (!user) {
        return { success: false, error: 'User not found', statusCode: 404 };
      }

      user.shortlist = user.shortlist.filter(id => !id.equals(contentId));
      await user.save();
      logger.info(`Removed from shortlist: user ${userId}, content ${contentId}`);

      return { success: true, data: user };
    } catch (error) {
      logger.error('Error removing from shortlist:', error);
      return { success: false, error: error.message };
    }
  }

  async isShortlisted(userId, contentId) {
    try {
      const user = await User.findById(userId).lean();
      if (!user) return false;
      return user.shortlist.some(id => id.equals(contentId));
    } catch (error) {
      logger.error('Error checking shortlist:', error);
      return false;
    }
  }
}

module.exports = new UserService();
