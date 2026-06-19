const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    password: { type: String, required: true },
    role: { type: String, required: true, enum: ['admin', 'streamer'] },
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

module.exports = mongoose.model('User', userSchema);
