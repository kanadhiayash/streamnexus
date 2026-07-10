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

  findActiveByUserAndContent({ userId, contentId }) {
    return RentalModel.findOne({ userId, contentId, status: 'active' }).lean();
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
});

module.exports = { createRentalsRepository };
