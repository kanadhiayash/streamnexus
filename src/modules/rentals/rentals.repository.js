const Content = require('../../../models/Content');
const Rental = require('../../../models/Rental');
const User = require('../../../models/User');

const createRentalsRepository = ({ ContentModel = Content, RentalModel = Rental, UserModel = User } = {}) => ({
  findUserRentals(userId) {
    return RentalModel.find({ userId })
      .populate('contentId', 'title image price type')
      .sort({ rentedAt: -1, date: -1 })
      .lean();
  },

  findContentById(contentId) {
    return ContentModel.findById(contentId).lean();
  },

  countActiveByContent(contentId) {
    return RentalModel.countDocuments({ contentId, status: 'active' });
  },

  async countActiveByContents(contentIds = []) {
    const rows = await RentalModel.aggregate([
      { $match: { contentId: { $in: contentIds }, status: 'active' } },
      { $group: { _id: '$contentId', count: { $sum: 1 } } },
    ]);
    return new Map(rows.map(row => [row._id.toString(), row.count]));
  },

  countActiveByUser(userId) {
    return RentalModel.countDocuments({ userId, status: 'active' });
  },

  findActiveByUserAndContent({ userId, contentId }) {
    return RentalModel.findOne({ userId, contentId, status: 'active' }).lean();
  },

  findActiveRentalDocument({ userId, contentId }) {
    return RentalModel.findOne({ userId, contentId, status: 'active' });
  },

  reserveLicence(contentId) {
    return ContentModel.findOneAndUpdate(
      {
        _id: contentId,
        available: true,
        lifecycle: { $ne: 'archived' },
        $expr: { $lt: ['$activeLicenceCount', '$rentalLimit'] },
      },
      { $inc: { activeLicenceCount: 1 } },
      { returnDocument: 'after' }
    ).lean();
  },

  releaseLicence(contentId) {
    return ContentModel.updateOne(
      { _id: contentId, activeLicenceCount: { $gt: 0 } },
      { $inc: { activeLicenceCount: -1 } }
    );
  },

  createRental(rentalData) {
    return RentalModel.create(rentalData);
  },

  findUserById(userId) {
    return UserModel.findById(userId);
  },

  findRentalById(rentalId) {
    return RentalModel.findById(rentalId);
  },

  findRentalByIdForRead(rentalId) {
    return RentalModel.findById(rentalId).populate('contentId', 'title image price').populate('userId', 'email').lean();
  },

  findRentalByPublicReference(publicReference) {
    return RentalModel.findOne({ publicReference }).populate('contentId', 'title image price type').lean();
  },

  findAllRentals(filters = {}) {
    return RentalModel.find({ ...filters })
      .populate('userId', 'email')
      .populate('contentId', 'title price')
      .sort({ rentedAt: -1, date: -1 })
      .lean();
  },

  countRentals(filters = {}) {
    return RentalModel.countDocuments(filters);
  },

  findExpiredActive(now) {
    return RentalModel.find({ status: 'active', expiresAt: { $lte: now } });
  },

  async reconcileActiveLicenceCounts() {
    const rows = await RentalModel.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$contentId', count: { $sum: 1 } } },
    ]);
    const activeCountMap = new Map(rows.map(row => [row._id.toString(), row.count]));
    const contents = await ContentModel.find({}).select('_id activeLicenceCount').lean();

    let updated = 0;
    for (const content of contents) {
      const activeCount = activeCountMap.get(content._id.toString()) || 0;
      if (content.activeLicenceCount !== activeCount) {
        await ContentModel.updateOne({ _id: content._id }, { $set: { activeLicenceCount: activeCount } });
        updated += 1;
      }
    }

    return { updated, scanned: contents.length };
  },
});

module.exports = { createRentalsRepository };
