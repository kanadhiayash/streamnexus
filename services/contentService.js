const Content = require('../models/Content');
const logger = require('../utils/logger');
const { sanitizeSearchQuery } = require('../utils/validators');

class ContentService {
  async getAllContent(filters = {}) {
    try {
      const query = { ...filters };
      const contents = await Content.find(query).lean().sort({ createdAt: -1 });
      return { success: true, data: contents };
    } catch (error) {
      logger.error('Error fetching all content:', error);
      return { success: false, error: error.message };
    }
  }

  async getContentById(contentId) {
    try {
      if (!contentId || !contentId.match(/^[0-9a-fA-F]{24}$/)) {
        return { success: false, error: 'Invalid content ID' };
      }
      const content = await Content.findById(contentId);
      if (!content) {
        return { success: false, error: 'Content not found', statusCode: 404 };
      }
      return { success: true, data: content };
    } catch (error) {
      logger.error('Error fetching content:', error);
      return { success: false, error: error.message };
    }
  }

  async createContent(contentData) {
    try {
      const { title, type, description, price, image, available, rating, genre, duration, cast, rentalLimit } = contentData;

      if (!title?.trim() || !type || price === undefined || price === '') {
        return { success: false, error: 'Title, type, and price are required' };
      }

      if (!['movie', 'tv'].includes(type)) {
        return { success: false, error: 'Invalid content type' };
      }

      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 0) {
        return { success: false, error: 'Price must be a valid non-negative number' };
      }
      const numRentalLimit = rentalLimit ? Number(rentalLimit) : 5;
      if (isNaN(numRentalLimit) || numRentalLimit < 1 || numRentalLimit > 50) {
        return { success: false, error: 'Rental limit must be a number between 1 and 50' };
      }

      const content = await Content.create({
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
      });

      logger.info(`Content created: ${content._id}`);
      return { success: true, data: content };
    } catch (error) {
      logger.error('Error creating content:', error);
      return { success: false, error: error.message };
    }
  }

  async updateContent(contentId, contentData) {
    try {
      if (!contentId || !contentId.match(/^[0-9a-fA-F]{24}$/)) {
        return { success: false, error: 'Invalid content ID' };
      }

      const { title, type, description, price, image, available, rating, genre, duration, cast, rentalLimit } = contentData;

      if (!title?.trim() || !type || price === undefined || price === '') {
        return { success: false, error: 'Title, type, and price are required' };
      }

      if (!['movie', 'tv'].includes(type)) {
        return { success: false, error: 'Invalid content type' };
      }

      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 0) {
        return { success: false, error: 'Price must be a valid non-negative number' };
      }
      const numRentalLimit = rentalLimit ? Number(rentalLimit) : 5;
      if (isNaN(numRentalLimit) || numRentalLimit < 1 || numRentalLimit > 50) {
        return { success: false, error: 'Rental limit must be a number between 1 and 50' };
      }

      const content = await Content.findByIdAndUpdate(
        contentId,
        {
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
        },
        { new: true, runValidators: true }
      );

      if (!content) {
        return { success: false, error: 'Content not found', statusCode: 404 };
      }

      logger.info(`Content updated: ${contentId}`);
      return { success: true, data: content };
    } catch (error) {
      logger.error('Error updating content:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteContent(contentId) {
    try {
      if (!contentId || !contentId.match(/^[0-9a-fA-F]{24}$/)) {
        return { success: false, error: 'Invalid content ID' };
      }

      const content = await Content.findByIdAndDelete(contentId);
      if (!content) {
        return { success: false, error: 'Content not found', statusCode: 404 };
      }

      logger.info(`Content deleted: ${contentId}`);
      return { success: true, data: content };
    } catch (error) {
      logger.error('Error deleting content:', error);
      return { success: false, error: error.message };
    }
  }

  async getAvailableContent(filters = {}) {
    try {
      const query = { available: true, ...filters };
      const contents = await Content.find(query).lean().sort({ createdAt: -1 });
      return { success: true, data: contents };
    } catch (error) {
      logger.error('Error fetching available content:', error);
      return { success: false, error: error.message };
    }
  }

  async getSimilarContent(contentId, limit = 4) {
    try {
      const content = await Content.findById(contentId).lean();
      if (!content) {
        return { success: false, error: 'Content not found' };
      }

      const similar = await Content.find({
        _id: { $ne: contentId },
        type: content.type,
        available: true,
      })
        .lean()
        .limit(limit);

      return { success: true, data: similar };
    } catch (error) {
      logger.error('Error fetching similar content:', error);
      return { success: false, error: error.message };
    }
  }

  async searchContent(query, filters = {}) {
    try {
      if (!query?.trim()) {
        return { success: false, error: 'Search query is required' };
      }

      const safeQuery = sanitizeSearchQuery(query);
      if (!safeQuery) {
        return { success: false, error: 'Search query is required' };
      }

      const results = await Content.find({
        $or: [
          { title: { $regex: safeQuery, $options: 'i' } },
          { description: { $regex: safeQuery, $options: 'i' } },
          { genre: { $regex: safeQuery, $options: 'i' } },
        ],
        available: true,
        ...filters,
      })
        .lean()
        .limit(20);

      return { success: true, data: results };
    } catch (error) {
      logger.error('Error searching content:', error);
      return { success: false, error: error.message };
    }
  }

  async getTrendingContent(limit = 10) {
    try {
      const trending = await Content.find({ available: true, trending: true })
        .lean()
        .sort({ rating: -1 })
        .limit(limit);

      return { success: true, data: trending };
    } catch (error) {
      logger.error('Error fetching trending content:', error);
      return { success: false, error: error.message };
    }
  }

  async getContentByGenre(genre, limit = 10) {
    try {
      if (!genre?.trim()) {
        return { success: false, error: 'Genre is required' };
      }

      const safeGenre = sanitizeSearchQuery(genre);
      if (!safeGenre) {
        return { success: false, error: 'Genre is required' };
      }

      const contents = await Content.find({
        genre: { $regex: safeGenre, $options: 'i' },
        available: true,
      })
        .lean()
        .limit(limit);

      return { success: true, data: contents };
    } catch (error) {
      logger.error('Error fetching content by genre:', error);
      return { success: false, error: error.message };
    }
  }

  async getTopRatedContent(limit = 10) {
    try {
      const topRated = await Content.find({ available: true })
        .lean()
        .sort({ rating: -1 })
        .limit(limit);

      return { success: true, data: topRated };
    } catch (error) {
      logger.error('Error fetching top rated content:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ContentService();
