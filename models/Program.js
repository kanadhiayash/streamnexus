const mongoose = require('mongoose');

const programSchema = new mongoose.Schema(
  {
    schemaVersion: { type: Number, default: 1, index: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
    key: { type: String, required: true },
    name: { type: String, required: true },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    titleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Content' }],
  },
  { timestamps: true }
);

programSchema.index({ partnerId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('Program', programSchema);
