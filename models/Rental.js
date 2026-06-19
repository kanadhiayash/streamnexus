const mongoose = require('mongoose');

const rentalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', required: true },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  date: { type: Date, default: Date.now },
  rentedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

rentalSchema.index({ contentId: 1, status: 1 });
rentalSchema.index({ userId: 1, contentId: 1, status: 1 });

module.exports = mongoose.model('Rental', rentalSchema);
