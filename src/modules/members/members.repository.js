const User = require('../../../models/User');

const createMembersRepository = ({ UserModel = User } = {}) => ({
  findById(userId) {
    return UserModel.findById(userId).lean();
  },
});

module.exports = { createMembersRepository };
