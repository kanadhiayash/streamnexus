const mongoose = require('mongoose');

const titleCollectionSchema = new mongoose.Schema(
  {
    schemaVersion: { type: Number, default: 1, index: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
    key: { type: String, required: true },
    name: { type: String, required: true },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    titleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Content' }],
    programIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Program' }],
    editorialRank: { type: Number, default: null },
  },
  { timestamps: true }
);

titleCollectionSchema.index({ partnerId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('TitleCollection', titleCollectionSchema);
