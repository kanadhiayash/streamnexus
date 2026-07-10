process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-session-secret-with-enough-entropy';

const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Content = require('../models/Content');
const Rental = require('../models/Rental');
const User = require('../models/User');
const { createRentalsService } = require('../src/modules/rentals/rentals.service');

let mongoServer;
let rentals;

const now = new Date('2026-07-10T00:00:00.000Z');

const createUser = (email) => User.create({
  email,
  password: 'hash',
  role: 'streamer',
  shortlist: [],
  rented: [],
});

const createTitle = (overrides = {}) => Content.create({
  title: overrides.title || 'Race Title',
  type: 'movie',
  description: 'Concurrency fixture',
  price: 4.99,
  available: true,
  genre: 'Drama',
  rentalLimit: overrides.rentalLimit || 1,
  licenceLimit: overrides.rentalLimit || 1,
  activeLicenceCount: overrides.activeLicenceCount || 0,
});

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri('streamnexus_rental_lifecycle'));
  await Promise.all([Content.syncIndexes(), Rental.syncIndexes(), User.syncIndexes()]);
  rentals = createRentalsService({
    clock: () => now,
    auditService: { record: async () => ({ success: true }) },
    logger: { info() {}, warn() {}, error() {} },
  });
});

test.beforeEach(async () => {
  await Promise.all([
    Content.deleteMany({}),
    Rental.deleteMany({}),
    User.deleteMany({}),
  ]);
});

test.after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test('last-seat race allows one active rental and one capacity release path', async () => {
  const [firstUser, secondUser] = await Promise.all([
    createUser('race-one@example.com'),
    createUser('race-two@example.com'),
  ]);
  const title = await createTitle({ rentalLimit: 1 });

  const results = await Promise.all([
    rentals.createRental(firstUser._id.toString(), title._id.toString()),
    rentals.createRental(secondUser._id.toString(), title._id.toString()),
  ]);

  assert.equal(results.filter(result => result.success).length, 1);
  assert.equal(results.filter(result => !result.success).length, 1);
  assert.equal(await Rental.countDocuments({ contentId: title._id, status: 'active' }), 1);

  const updatedTitle = await Content.findById(title._id).lean();
  assert.equal(updatedTitle.activeLicenceCount, 1);
});

test('duplicate rental submission returns one active rental idempotently', async () => {
  const user = await createUser('duplicate@example.com');
  const title = await createTitle({ rentalLimit: 2 });

  const first = await rentals.createRental(user._id.toString(), title._id.toString());
  const second = await rentals.createRental(user._id.toString(), title._id.toString());

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(second.data.idempotent, true);
  assert.equal(await Rental.countDocuments({ userId: user._id, contentId: title._id, status: 'active' }), 1);

  const updatedTitle = await Content.findById(title._id).lean();
  assert.equal(updatedTitle.activeLicenceCount, 1);
});

test('double return releases licence once', async () => {
  const user = await createUser('return@example.com');
  const title = await createTitle({ rentalLimit: 1 });
  const created = await rentals.createRental(user._id.toString(), title._id.toString());

  const [firstReturn, secondReturn] = await Promise.all([
    rentals.returnRental(created.data._id.toString(), user._id.toString()),
    rentals.returnRental(created.data._id.toString(), user._id.toString()),
  ]);

  assert.equal(firstReturn.success, true);
  assert.equal(secondReturn.success, true);
  const updatedTitle = await Content.findById(title._id).lean();
  assert.equal(updatedTitle.activeLicenceCount, 0);
  assert.equal(await Rental.countDocuments({ contentId: title._id, status: 'active' }), 0);
});

test('return and expiry race cannot make capacity negative', async () => {
  const user = await createUser('expiry@example.com');
  const title = await createTitle({ rentalLimit: 1 });
  const created = await rentals.createRental(user._id.toString(), title._id.toString());
  await Rental.updateOne({ _id: created.data._id }, { $set: { expiresAt: new Date('2026-07-01T00:00:00.000Z') } });

  const [returned, expired] = await Promise.all([
    rentals.returnRental(created.data._id.toString(), user._id.toString()),
    rentals.expireRentals(now),
  ]);

  assert.equal(returned.success, true);
  assert.equal(expired.success, true);
  const updatedTitle = await Content.findById(title._id).lean();
  assert.equal(updatedTitle.activeLicenceCount, 0);
  assert.ok(updatedTitle.activeLicenceCount >= 0);
});
