const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    schemaVersion: { type: Number, default: 1, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    password: { type: String, required: true },
    passwordHash: { type: String, default: null, select: false },
    displayName: { type: String, default: '' },
    role: { type: String, required: true, enum: ['admin', 'streamer', 'member'] },
    status: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active', index: true },
    emailVerifiedAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
    sessionVersion: { type: Number, default: 1 },
    lastLoginAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    shortlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Content' }],
    rented: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Content' }],
    watchHistory: [
      {
        contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content' },
        progress: { type: Number, default: 0 },
        lastWatched: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

userSchema.index({ role: 1, status: 1 });
userSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('User', userSchema);
