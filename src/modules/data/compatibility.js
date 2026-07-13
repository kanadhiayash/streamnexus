const crypto = require('crypto');

const { RENTAL_POLICY } = require('../../config/rentalPolicy');

const toPlainObject = (record) => (record && record.toObject ? record.toObject() : record);

const toMinorUnits = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.round(value * 100);
};

const normalizeRole = (role) => (role === 'streamer' ? 'member' : role);

const normalizeTitleType = (type) => (type === 'tv' ? 'series' : type);

const slugify = (value = '') => value
  .toString()
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);

const stableSlug = (title, id) => {
  const base = slugify(title) || 'title';
  const suffix = id ? id.toString().slice(-6) : crypto.createHash('sha1').update(base).digest('hex').slice(0, 6);
  return `${base}-${suffix}`;
};

const publicRentalReference = (rentalId) => {
  const source = rentalId ? rentalId.toString() : crypto.randomUUID();
  const digest = crypto.createHash('sha1').update(source).digest('hex').slice(0, 10).toUpperCase();
  return `SNX-${digest}`;
};

const mapUserToV2 = (userRecord) => {
  const user = toPlainObject(userRecord) || {};
  return {
    schemaVersion: 2,
    email: user.email,
    passwordHash: user.passwordHash || user.password,
    displayName: user.displayName || '',
    role: normalizeRole(user.role),
    legacyRole: user.role,
    status: user.status || 'active',
    emailVerifiedAt: user.emailVerifiedAt || null,
    passwordChangedAt: user.passwordChangedAt || null,
    sessionVersion: user.sessionVersion || 1,
    lastLoginAt: user.lastLoginAt || null,
    deletedAt: user.deletedAt || null,
  };
};

const mapTitleToV2 = (titleRecord, activeLicenceCount = 0) => {
  const title = toPlainObject(titleRecord) || {};
  const slug = title.slug || stableSlug(title.title, title._id);
  const amountMinor = title.rentalPriceMinor ?? toMinorUnits(title.price);
  const lifecycle = title.lifecycle || (title.available === false ? 'unpublished' : 'published');
  const genres = Array.isArray(title.genres) && title.genres.length > 0
    ? title.genres
    : [title.genre || 'General'];

  return {
    schemaVersion: 2,
    slug,
    title: title.title,
    type: normalizeTitleType(title.type),
    shortDescription: title.shortDescription || title.description || '',
    synopsis: title.synopsis || title.description || '',
    releaseYear: title.releaseYear || null,
    ageRating: title.ageRating || '',
    runtimeMinutes: title.runtimeMinutes || null,
    genres,
    tags: title.tags || [],
    cast: title.castMembers || (title.cast ? title.cast.split(',').map(item => item.trim()).filter(Boolean) : []),
    posterReference: title.posterReference || title.image || '/images/default.svg',
    backdropReference: title.backdropReference || null,
    posterAlt: title.posterAlt || `${title.title || 'Title'} poster`,
    rentalPriceMinor: amountMinor,
    currencyCode: title.currencyCode || RENTAL_POLICY.currencyCode,
    lifecycle,
    licenceLimit: title.licenceLimit || title.rentalLimit || RENTAL_POLICY.defaultTitleLicenceLimit,
    activeLicenceCount,
    editorialRank: title.editorialRank || null,
    publishedAt: title.publishedAt || (lifecycle === 'published' ? title.createdAt || null : null),
    archivedAt: title.archivedAt || null,
  };
};

const mapRentalToV2 = (rentalRecord, titleRecord) => {
  const rental = toPlainObject(rentalRecord) || {};
  const title = titleRecord ? mapTitleToV2(titleRecord) : null;
  const startedAt = rental.startedAt || rental.rentedAt || rental.date || rental.createdAt || new Date();
  const status = rental.status === 'completed' ? 'returned' : rental.status;

  return {
    schemaVersion: 2,
    publicReference: rental.publicReference || publicRentalReference(rental._id),
    userId: rental.userId,
    titleId: rental.titleId || rental.contentId,
    status,
    titleSnapshot: {
      title: rental.titleSnapshot?.title || title?.title || '',
      slug: rental.titleSnapshot?.slug || title?.slug || '',
      posterReference: rental.titleSnapshot?.posterReference || title?.posterReference || '',
    },
    priceSnapshot: {
      amountMinor: rental.priceSnapshot?.amountMinor ?? title?.rentalPriceMinor ?? null,
      currencyCode: rental.priceSnapshot?.currencyCode || title?.currencyCode || RENTAL_POLICY.currencyCode,
    },
    policySnapshot: rental.policySnapshot || {
      version: RENTAL_POLICY.version,
      durationDays: RENTAL_POLICY.durationDays,
    },
    idempotencyKeyHash: rental.idempotencyKeyHash || null,
    startedAt,
    expiresAt: rental.expiresAt,
    endedAt: rental.endedAt || rental.completedAt || null,
    endReason: rental.endReason || (rental.status === 'completed' ? 'legacy_completed' : null),
  };
};

module.exports = {
  mapRentalToV2,
  mapTitleToV2,
  mapUserToV2,
  normalizeRole,
  normalizeTitleType,
  publicRentalReference,
  stableSlug,
  toMinorUnits,
};
