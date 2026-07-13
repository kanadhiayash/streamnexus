const mongoose = require('mongoose');

const releaseWindowSchema = new mongoose.Schema(
  {
    schemaVersion: { type: Number, default: 1, index: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
    titleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', required: true, index: true },
    programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', default: null, index: true },
    opensAt: { type: Date, required: true, index: true },
    closesAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ['scheduled', 'active', 'expired', 'cancelled'], default: 'scheduled', index: true },
  },
  { timestamps: true }
);

releaseWindowSchema.index({ titleId: 1, opensAt: 1, closesAt: 1 });

module.exports = mongoose.model('ReleaseWindow', releaseWindowSchema);
