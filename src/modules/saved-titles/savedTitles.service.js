const logger = require('../../../utils/logger');
const { NotFoundError, toServiceResult } = require('../../shared/errors/domainErrors');
const { assertObjectId } = require('../../shared/validation/objectId');
const { createAuditService } = require('../audit/audit.service');
const { createSavedTitlesRepository } = require('./savedTitles.repository');

const createSavedTitlesService = ({
  repository = createSavedTitlesRepository(),
  auditService = createAuditService(),
  logger: injectedLogger = logger,
} = {}) => ({
  getShortlist(userId) {
    return toServiceResult(async () => {
      assertObjectId(userId, 'user ID');
      const user = await repository.findUserWithShortlistLean(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      return user.shortlist || [];
    });
  },

  addToShortlist(userId, contentId) {
    return toServiceResult(async () => {
      assertObjectId(userId, 'user ID');
      assertObjectId(contentId, 'content ID');
      const user = await repository.findUserWithShortlist(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      if (!user.shortlist.some(id => id.equals(contentId))) {
        user.shortlist.push(contentId);
        await user.save();
        injectedLogger.info(`Added to shortlist: user ${userId}, content ${contentId}`);
        await auditService.record({ action: 'saved_titles.added', actorId: userId, targetType: 'content', targetId: contentId });
      }
      return user;
    });
  },

  removeFromShortlist(userId, contentId) {
    return toServiceResult(async () => {
      assertObjectId(userId, 'user ID');
      assertObjectId(contentId, 'content ID');
      const user = await repository.findUserWithShortlist(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      user.shortlist = user.shortlist.filter(id => !id.equals(contentId));
      await user.save();
      injectedLogger.info(`Removed from shortlist: user ${userId}, content ${contentId}`);
      await auditService.record({ action: 'saved_titles.removed', actorId: userId, targetType: 'content', targetId: contentId });
      return user;
    });
  },

  async isShortlisted(userId, contentId) {
    try {
      const user = await repository.findUserByIdLean(userId);
      if (!user) return false;
      return user.shortlist.some(id => id.equals(contentId));
    } catch (error) {
      injectedLogger.error('Error checking shortlist:', error);
      return false;
    }
  },
});

module.exports = { createSavedTitlesService };
