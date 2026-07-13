const mongoose = require('mongoose');

const partnerSchema = new mongoose.Schema(
  {
    schemaVersion: { type: Number, default: 1, index: true },
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    status: { type: String, enum: ['active', 'suspended', 'archived'], default: 'active', index: true },
    assignedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Partner', partnerSchema);
