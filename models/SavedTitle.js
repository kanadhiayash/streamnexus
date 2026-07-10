const mongoose = require('mongoose');

const savedTitleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  titleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', required: true },
}, { timestamps: true });

savedTitleSchema.index({ userId: 1, titleId: 1 }, { unique: true });
savedTitleSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('SavedTitle', savedTitleSchema);
