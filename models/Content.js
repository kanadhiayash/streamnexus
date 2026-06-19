const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, index: true },
    type: { type: String, required: true, enum: ['movie', 'tv'], index: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, default: '/images/default.svg' },
    available: { type: Boolean, default: true, index: true },
    rating: { type: Number, min: 0, max: 10, default: 7.5 },
    genre: { type: String, default: 'General' },
    duration: { type: String, default: '2h' },
    cast: { type: String, default: '' },
    trending: { type: Boolean, default: false, index: true },
    rentalLimit: { type: Number, min: 1, max: 50, default: 5 },
  },
  { timestamps: true }
);

contentSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Content', contentSchema);
