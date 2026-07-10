process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-session-secret-with-enough-entropy';

const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Content = require('../models/Content');
const Rental = require('../models/Rental');
const SavedTitle = require('../models/SavedTitle');
const User = require('../models/User');
const { inspectDataContracts } = require('../src/infrastructure/migrations/dataContractsMigration');
const {
  mapRentalToV2,
  mapTitleToV2,
  mapUserToV2,
  stableSlug,
  toMinorUnits,
} = require('../src/modules/data/compatibility');
const { buildRentalWindow } = require('../src/modules/rentals/rentals.service');

let mongoServer;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri('streamnexus_data_contracts'));
});

test.beforeEach(async () => {
  await Promise.all([
    Content.deleteMany({}),
    Rental.deleteMany({}),
    SavedTitle.deleteMany({}),
    User.deleteMany({}),
  ]);
});

test.after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test('compatibility mappers produce target role, title, money, and rental fields', () => {
  const titleId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const rentalId = new mongoose.Types.ObjectId();
  const title = {
    _id: titleId,
    title: 'Cyber City',
    type: 'tv',
    description: 'Series description',
    price: 2.99,
    available: true,
    genre: 'Crime',
    image: '/images/cyber-city.jpg',
  };

  assert.equal(toMinorUnits(2.99), 299);
  assert.equal(stableSlug('Cyber City', titleId), `cyber-city-${titleId.toString().slice(-6)}`);
  assert.equal(mapUserToV2({ email: 'm@example.com', password: 'hash', role: 'streamer' }).role, 'member');

  const mappedTitle = mapTitleToV2(title, 2);
  assert.equal(mappedTitle.type, 'series');
  assert.equal(mappedTitle.rentalPriceMinor, 299);
  assert.equal(mappedTitle.lifecycle, 'published');
  assert.equal(mappedTitle.activeLicenceCount, 2);

  const mappedRental = mapRentalToV2({
    _id: rentalId,
    userId,
    contentId: titleId,
    status: 'completed',
    rentedAt: new Date('2026-07-10T00:00:00.000Z'),
    expiresAt: new Date('2026-08-24T00:00:00.000Z'),
  }, title);
  assert.equal(mappedRental.status, 'returned');
  assert.match(mappedRental.publicReference, /^SNX-[A-F0-9]{10}$/);
  assert.equal(mappedRental.titleSnapshot.slug, mappedTitle.slug);
});

test('dry-run migration reports counts without sensitive records', async () => {
  const user = await User.create({
    email: 'sensitive-member@example.com',
    password: 'legacy-password-hash',
    role: 'streamer',
    shortlist: [],
    rented: [],
  });
  const title = await Content.create({
    title: 'Migration Fixture',
    type: 'movie',
    description: 'Fixture title',
    price: 4.99,
    available: true,
    genre: 'Drama',
  });
  user.shortlist.push(title._id);
  await user.save();

  const rentalWindow = buildRentalWindow(new Date('2026-07-10T00:00:00.000Z'));
  await Rental.create({
    userId: user._id,
    contentId: title._id,
    status: 'active',
    date: rentalWindow.rentedAt,
    rentedAt: rentalWindow.rentedAt,
    expiresAt: rentalWindow.expiresAt,
  });

  const report = await inspectDataContracts({ dryRun: true });
  const serialized = JSON.stringify(report);

  assert.equal(report.dryRun, true);
  assert.equal(report.users.scanned, 1);
  assert.equal(report.users.wouldBackfill, 1);
  assert.equal(report.titles.wouldBackfill, 1);
  assert.equal(report.rentals.wouldBackfill, 1);
  assert.equal(report.savedTitles.wouldUpsert, 1);
  assert.equal(serialized.includes('sensitive-member@example.com'), false);
  assert.equal(serialized.includes('legacy-password-hash'), false);
});
