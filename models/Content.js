const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema(
  {
    schemaVersion: { type: Number, default: 1, index: true },
    fixtureId: { type: String, default: null },
    fixtureOwner: { type: String, default: null, index: true },
    programKey: { type: String, default: null, index: true },
    collectionKeys: [{ type: String }],
    accessMode: { type: String, enum: ['screening', 'festival', 'partner_preview'], default: 'screening' },
    featuredRank: { type: Number, default: null },
    releaseWindow: {
      opensAt: { type: Date, default: null },
      closesAt: { type: Date, default: null },
    },
    slug: { type: String },
    title: { type: String, required: true, index: true },
    type: { type: String, required: true, enum: ['movie', 'tv', 'series'], index: true },
    shortDescription: { type: String, default: '' },
    synopsis: { type: String, default: '' },
    releaseYear: { type: Number, default: null },
    ageRating: { type: String, default: '' },
    runtimeMinutes: { type: Number, default: null },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    rentalPriceMinor: { type: Number, min: 0, default: null },
    currencyCode: { type: String, default: 'CAD' },
    image: { type: String, default: '/images/default.svg' },
    posterReference: { type: String, default: '' },
    backdropReference: { type: String, default: null },
    posterAlt: { type: String, default: '' },
    available: { type: Boolean, default: true, index: true },
    lifecycle: { type: String, enum: ['draft', 'published', 'unpublished', 'archived'], default: 'published', index: true },
    rating: { type: Number, min: 0, max: 10, default: 7.5 },
    genre: { type: String, default: 'General' },
    genres: [{ type: String }],
    tags: [{ type: String }],
    duration: { type: String, default: '2h' },
    cast: { type: String, default: '' },
    castMembers: [{ type: String }],
    trending: { type: Boolean, default: false, index: true },
    rentalLimit: { type: Number, min: 1, max: 50, default: 20 },
    licenceLimit: { type: Number, min: 1, max: 50, default: 20 },
    activeLicenceCount: { type: Number, min: 0, default: 0 },
    editorialRank: { type: Number, default: null },
    publishedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

contentSchema.index({ title: 'text', description: 'text', shortDescription: 'text', synopsis: 'text', genres: 'text' });
contentSchema.index({ slug: 1 }, { unique: true, sparse: true });
contentSchema.index(
  { fixtureId: 1 },
  { unique: true, partialFilterExpression: { fixtureId: { $type: 'string' } } }
);
contentSchema.index({ lifecycle: 1, editorialRank: 1, _id: 1 });
contentSchema.index({ lifecycle: 1, type: 1, _id: 1 });
contentSchema.index({ lifecycle: 1, genres: 1, _id: 1 });
contentSchema.index({ lifecycle: 1, rentalPriceMinor: 1, _id: 1 });

module.exports = mongoose.model('Content', contentSchema);
