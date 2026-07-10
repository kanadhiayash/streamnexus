const User = require('../../../models/User');

const createSavedTitlesRepository = ({ UserModel = User } = {}) => ({
  findUserWithShortlist(userId) {
    return UserModel.findById(userId).populate('shortlist');
  },

  findUserWithShortlistLean(userId) {
    return UserModel.findById(userId).populate('shortlist').lean();
  },

  findUserByIdLean(userId) {
    return UserModel.findById(userId).lean();
  },
});

module.exports = { createSavedTitlesRepository };
