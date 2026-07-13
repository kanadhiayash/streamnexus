const Partner = require('../../../models/Partner');
const Program = require('../../../models/Program');
const TitleCollection = require('../../../models/TitleCollection');
const ReleaseWindow = require('../../../models/ReleaseWindow');

const createPartnerDomainRepository = ({
  PartnerModel = Partner,
  ProgramModel = Program,
  TitleCollectionModel = TitleCollection,
  ReleaseWindowModel = ReleaseWindow,
} = {}) => ({
  findPartnerById(partnerId) {
    return PartnerModel.findById(partnerId).lean();
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

  createCollection(collection) {
    return TitleCollectionModel.create(collection);
  },

  findCollectionById(collectionId) {
    return TitleCollectionModel.findById(collectionId).lean();
  },

  findReleaseWindowsForTitle(titleId) {
    return ReleaseWindowModel.find({ titleId, status: { $ne: 'cancelled' } }).lean();
  },
});

module.exports = { createPartnerDomainRepository };
