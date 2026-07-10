const User = require('../../../models/User');

const createAuthRepository = ({ UserModel = User } = {}) => ({
  findByEmail(email) {
    return UserModel.findOne({ email });
  },

  findExistingAccount(email) {
    return UserModel.findOne({ email }).lean();
  },

  createMember({ email, passwordHash }) {
    return UserModel.create({
      email,
      password: passwordHash,
      role: 'streamer',
      shortlist: [],
      rented: [],
    });
  },
});

module.exports = { createAuthRepository };
