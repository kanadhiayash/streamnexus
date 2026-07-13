const AuditEvent = require('../../../models/AuditEvent');
const Partner = require('../../../models/Partner');
const Program = require('../../../models/Program');
const User = require('../../../models/User');

const createAdminRepository = ({
  AuditEventModel = AuditEvent,
  PartnerModel = Partner,
  ProgramModel = Program,
  UserModel = User,
} = {}) => ({
  findMembers(filters = {}) {
    return UserModel.find({ role: { $in: ['streamer', 'member'] }, ...filters })
      .select('email displayName role status sessionVersion createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .lean();
  },

  updateMemberStatus({ userId, status }) {
    return UserModel.findOneAndUpdate(
      { _id: userId, role: { $in: ['streamer', 'member'] } },
      { $set: { status }, $inc: { sessionVersion: 1 } },
      { returnDocument: 'after' }
    )
      .select('email displayName role status sessionVersion')
      .lean();
  },

  findPartners(filters = {}) {
    return PartnerModel.find(filters).sort({ name: 1 }).lean();
  },

  findPrograms(filters = {}) {
    return ProgramModel.find(filters).populate('partnerId', 'name key status').sort({ updatedAt: -1 }).lean();
  },

  findAuditEvents(filters = {}, limit = 40) {
    return AuditEventModel.find(filters)
      .select('actorId actorRole action targetType targetId metadata createdAt')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  },
});

module.exports = { createAdminRepository };
