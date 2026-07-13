const Partner = require('../../../models/Partner');
const Program = require('../../../models/Program');
const TitleCollection = require('../../../models/TitleCollection');
const ReleaseWindow = require('../../../models/ReleaseWindow');
const Content = require('../../../models/Content');
const Rental = require('../../../models/Rental');

const createPartnerDomainRepository = ({
  PartnerModel = Partner,
  ProgramModel = Program,
  TitleCollectionModel = TitleCollection,
  ReleaseWindowModel = ReleaseWindow,
  ContentModel = Content,
  RentalModel = Rental,
} = {}) => ({
  findPartnerById(partnerId) {
    return PartnerModel.findById(partnerId).lean();
  },

  findPartnerForUser(userId) {
    return PartnerModel.findOne({ assignedUserIds: userId, status: { $ne: 'archived' } }).lean();
  },

  createProgram(program) {
    return ProgramModel.create(program);
  },

  updateProgram(programId, patch) {
    return ProgramModel.findByIdAndUpdate(programId, patch, { returnDocument: 'after' }).lean();
  },

  findProgramById(programId) {
    return ProgramModel.findById(programId).lean();
  },

  findProgramsByPartner(partnerId) {
    return ProgramModel.find({ partnerId }).sort({ updatedAt: -1 }).lean();
  },

  createCollection(collection) {
    return TitleCollectionModel.create(collection);
  },

  findCollectionById(collectionId) {
    return TitleCollectionModel.findById(collectionId).lean();
  },

  findReleaseWindowsForTitle(titleId) {
    return ReleaseWindowModel.find({ titleId, status: { $ne: 'cancelled' } }).lean();
  },

  findReleaseWindowsByPartner(partnerId) {
    return ReleaseWindowModel.find({ partnerId }).sort({ opensAt: -1 }).lean();
  },

  findTitlesByPartner(partnerId) {
    return ContentModel.find({ partnerId }).sort({ updatedAt: -1 }).lean();
  },

  findRentalsByPartner(partnerId) {
    return RentalModel.find({})
      .populate({ path: 'contentId', match: { partnerId }, select: 'title partnerId activeLicenceCount rentalLimit' })
      .populate('userId', 'status role')
      .sort({ updatedAt: -1 })
      .lean()
      .then(rows => rows.filter(row => row.contentId));
  },
});

module.exports = { createPartnerDomainRepository };
