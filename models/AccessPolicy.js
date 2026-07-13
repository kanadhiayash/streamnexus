const mongoose = require('mongoose');

const accessPolicySchema = new mongoose.Schema(
  {
    schemaVersion: { type: Number, default: 1, index: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
    titleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', default: null, index: true },
    programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', default: null, index: true },
    accessMode: { type: String, enum: ['screening', 'festival', 'partner_preview'], default: 'screening' },
    seatLimit: { type: Number, min: 1, max: 50, default: 20 },
    status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft', index: true },
  },
  { timestamps: true }
);

accessPolicySchema.index({ partnerId: 1, titleId: 1, programId: 1 });

module.exports = mongoose.model('AccessPolicy', accessPolicySchema);
