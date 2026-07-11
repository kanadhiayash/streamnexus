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
      passwordHash,
      role: 'member',
      status: 'active',
      sessionVersion: 1,
      shortlist: [],
      rented: [],
    });
  },

  recordLogin(userId, loggedInAt = new Date()) {
    return UserModel.updateOne({ _id: userId }, { $set: { lastLoginAt: loggedInAt } });
  },

  changePassword({ userId, passwordHash, changedAt = new Date() }) {
    return UserModel.updateOne(
      { _id: userId },
      {
        $set: { password: passwordHash, passwordHash, passwordChangedAt: changedAt },
        $inc: { sessionVersion: 1 },
      }
    );
  },

  markDeleted(userId, deletedAt = new Date()) {
    return UserModel.updateOne(
      { _id: userId },
      { $set: { status: 'deleted', deletedAt }, $inc: { sessionVersion: 1 } }
    );
  },
});

module.exports = { createAuthRepository };
