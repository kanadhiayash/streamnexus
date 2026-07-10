const Content = require('../../../models/Content');

const createCatalogRepository = ({ ContentModel = Content } = {}) => ({
  findAll(filters = {}) {
    return ContentModel.find({ ...filters }).lean().sort({ createdAt: -1 });
  },

  findById(contentId) {
    return ContentModel.findById(contentId);
  },

  create(contentData) {
    return ContentModel.create(contentData);
  },

  update(contentId, contentData) {
    return ContentModel.findByIdAndUpdate(contentId, contentData, { returnDocument: 'after', runValidators: true });
  },

  updateLifecycle(contentId, lifecycleData) {
    return ContentModel.findByIdAndUpdate(contentId, lifecycleData, { returnDocument: 'after', runValidators: true });
  },

  delete(contentId) {
    return ContentModel.findByIdAndDelete(contentId);
  },

  findAvailable(filters = {}) {
    return ContentModel.find({ available: true, ...filters }).lean().sort({ createdAt: -1 });
  },

  findSimilar({ contentId, type, limit }) {
    return ContentModel.find({ _id: { $ne: contentId }, type, available: true }).lean().limit(limit);
  },

  search({ query, filters }) {
    return ContentModel.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { genre: { $regex: query, $options: 'i' } },
      ],
      available: true,
      ...filters,
    })
      .lean()
      .limit(20);
  },

  findTrending(limit) {
    return ContentModel.find({ available: true, trending: true }).lean().sort({ rating: -1 }).limit(limit);
  },

  findByGenre({ genre, limit }) {
    return ContentModel.find({ genre: { $regex: genre, $options: 'i' }, available: true }).lean().limit(limit);
  },

  findTopRated(limit) {
    return ContentModel.find({ available: true }).lean().sort({ rating: -1 }).limit(limit);
  },
});

module.exports = { createCatalogRepository };
