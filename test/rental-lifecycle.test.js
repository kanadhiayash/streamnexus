process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-session-secret-with-enough-entropy';

const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Content = require('../models/Content');
const Rental = require('../models/Rental');
const User = require('../models/User');
const { repairLegacyDemoCapacity } = require('../src/demo/demoSeed');
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

const createActiveRental = async ({ user, title, index = 0 }) => Rental.create({
  schemaVersion: 2,
  publicReference: `SNX-CAP-${title._id.toString().slice(-6)}-${index}`,
  userId: user._id,
  contentId: title._id,
  titleId: title._id,
  status: 'active',
  expiresAt: new Date('2026-08-24T00:00:00.000Z'),
});

const seedActiveRentals = async ({ title, count, emailPrefix }) => {
  for (let index = 0; index < count; index += 1) {
    const user = await createUser(`${emailPrefix}-${index}@example.com`);
    await createActiveRental({ user, title, index });
  }
};

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

test('[SNX-CAPACITY-001] nineteenth seat reserves successfully', async () => {
  const title = await createTitle({ rentalLimit: 20, activeLicenceCount: 18 });
  await seedActiveRentals({ title, count: 18, emailPrefix: 'seat-nineteen' });
  const user = await createUser('seat-nineteen-final@example.com');

  const result = await rentals.createRental(user._id.toString(), title._id.toString());

  assert.equal(result.success, true);
  const updatedTitle = await Content.findById(title._id).lean();
  assert.equal(updatedTitle.activeLicenceCount, 19);
});

test('[SNX-CAPACITY-002] twentieth seat reserves successfully', async () => {
  const title = await createTitle({ rentalLimit: 20, activeLicenceCount: 19 });
  await seedActiveRentals({ title, count: 19, emailPrefix: 'seat-twenty' });
  const user = await createUser('seat-twenty-final@example.com');

  const result = await rentals.createRental(user._id.toString(), title._id.toString());

  assert.equal(result.success, true);
  const updatedTitle = await Content.findById(title._id).lean();
  assert.equal(updatedTitle.activeLicenceCount, 20);
});

test('[SNX-CAPACITY-003] twenty-first seat is rejected', async () => {
  const title = await createTitle({ rentalLimit: 20, activeLicenceCount: 20 });
  await seedActiveRentals({ title, count: 20, emailPrefix: 'seat-full' });
  const user = await createUser('seat-twenty-one@example.com');

  const result = await rentals.createRental(user._id.toString(), title._id.toString());

  assert.equal(result.success, false);
  assert.match(result.error, /capacity reached/i);
  const updatedTitle = await Content.findById(title._id).lean();
  assert.equal(updatedTitle.activeLicenceCount, 20);
});

test('[SNX-CAPACITY-004] reconciliation repairs stale projection', async () => {
  const title = await createTitle({ rentalLimit: 20, activeLicenceCount: 2 });
  await seedActiveRentals({ title, count: 7, emailPrefix: 'stale-repair' });

  const result = await rentals.reconcileLicenceCounts();

  assert.equal(result.success, true);
  const updatedTitle = await Content.findById(title._id).lean();
  assert.equal(updatedTitle.activeLicenceCount, 7);
  assert.equal(result.data.updated, 1);
});

test('[SNX-CAPACITY-005] repeated reconciliation is idempotent', async () => {
  const title = await createTitle({ rentalLimit: 20, activeLicenceCount: 4 });
  await seedActiveRentals({ title, count: 4, emailPrefix: 'stale-idempotent' });

  const first = await rentals.reconcileLicenceCounts();
  const second = await rentals.reconcileLicenceCounts();

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(second.data.updated, 0);
  const updatedTitle = await Content.findById(title._id).lean();
  assert.equal(updatedTitle.activeLicenceCount, 4);
});

test('[SNX-CAPACITY-006] release occurs exactly once', async () => {
  const user = await createUser('single-release@example.com');
  const title = await createTitle({ rentalLimit: 20, activeLicenceCount: 2 });
  const created = await rentals.createRental(user._id.toString(), title._id.toString());
  await Content.updateOne({ _id: title._id }, { $set: { activeLicenceCount: 2 } });

  const [firstReturn, secondReturn] = await Promise.all([
    rentals.returnRental(created.data._id.toString(), user._id.toString()),
    rentals.returnRental(created.data._id.toString(), user._id.toString()),
  ]);

  assert.equal(firstReturn.success, true);
  assert.equal(secondReturn.success, true);
  const updatedTitle = await Content.findById(title._id).lean();
  assert.equal(updatedTitle.activeLicenceCount, 1);
});

test('[SNX-DATA-011] customized capacities are preserved', async () => {
  await Content.create({
    title: 'Custom Capacity',
    type: 'movie',
    description: 'Custom admin title',
    price: 4.99,
    image: '/images/custom-capacity.jpg',
    available: true,
    rentalLimit: 5,
    licenceLimit: 5,
    activeLicenceCount: 0,
    createdBy: new mongoose.Types.ObjectId(),
  });

  await repairLegacyDemoCapacity();

  const customTitle = await Content.findOne({ title: 'Custom Capacity' }).lean();
  assert.equal(customTitle.rentalLimit, 5);
  assert.equal(customTitle.licenceLimit, 5);
});

test('[SNX-FIXTURE-010] legacy demo default migrates from 5 to 20', async () => {
  await Content.create({
    title: 'Neon Chase',
    type: 'movie',
    description: 'Legacy demo title',
    price: 4.99,
    image: '/images/neon-chase.jpg',
    available: true,
    rentalLimit: 5,
    licenceLimit: 5,
    activeLicenceCount: 0,
  });

  const result = await repairLegacyDemoCapacity();

  const demoTitle = await Content.findOne({ title: 'Neon Chase' }).lean();
  assert.equal(result.updated, 1);
  assert.equal(demoTitle.rentalLimit, 20);
  assert.equal(demoTitle.licenceLimit, 20);
});
