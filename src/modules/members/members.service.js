const logger = require('../../../utils/logger');
const { NotFoundError, toServiceResult } = require('../../shared/errors/domainErrors');
const { assertObjectId } = require('../../shared/validation/objectId');
const { createMembersRepository } = require('./members.repository');

const createMembersService = ({ repository = createMembersRepository(), logger: injectedLogger = logger } = {}) => ({
  getUserById(userId) {
    return toServiceResult(async () => {
      assertObjectId(userId, 'user ID');
      const user = await repository.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      return user;
    }).catch((error) => {
      injectedLogger.error('Error fetching user:', error);
      return { success: false, error: error.message };
    });
  },
});

module.exports = { createMembersService };
