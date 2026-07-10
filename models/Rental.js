const mongoose = require('mongoose');

const rentalSchema = new mongoose.Schema({
  schemaVersion: { type: Number, default: 1, index: true },
  publicReference: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', required: true },
  titleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', default: null },
  status: { type: String, enum: ['active', 'completed', 'returned', 'expired', 'cancelled'], default: 'active' },
  titleSnapshot: {
    title: { type: String, default: '' },
    slug: { type: String, default: '' },
    posterReference: { type: String, default: '' },
  },
  priceSnapshot: {
    amountMinor: { type: Number, min: 0, default: null },
    currencyCode: { type: String, default: 'CAD' },
  },
  policySnapshot: {
    version: { type: String, default: 'rental-v1' },
    durationDays: { type: Number, default: 45 },
  },
  idempotencyKeyHash: { type: String },
  date: { type: Date, default: Date.now },
  rentedAt: { type: Date, default: Date.now },
  startedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
  completedAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
  endReason: { type: String, default: null },
}, { timestamps: true });

rentalSchema.index({ contentId: 1, status: 1 });
rentalSchema.index({ userId: 1, contentId: 1, status: 1 });
rentalSchema.index({ publicReference: 1 }, { unique: true, sparse: true });
rentalSchema.index({ userId: 1, status: 1, expiresAt: 1 });
rentalSchema.index({ titleId: 1, status: 1, expiresAt: 1 });
rentalSchema.index({ userId: 1, idempotencyKeyHash: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Rental', rentalSchema);
