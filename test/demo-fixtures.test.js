process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-session-secret-with-enough-entropy';

const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Content = require('../models/Content');
const User = require('../models/User');
const {
  DEMO_FIXTURE_COUNT,
  DEMO_FIXTURE_OWNER,
  DEMO_PERSONAS,
  TITLE_FIXTURES,
  fixtureIds,
  inspectDemoFixtures,
  resetDemoFixtures,
  seedDemoFixtures,
} = require('../src/demo/fixtureCatalog');

let mongoServer;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri('streamnexus_demo_fixtures'));
  await Promise.all([Content.syncIndexes(), User.syncIndexes()]);
});

test.beforeEach(async () => {
  await Promise.all([
    Content.deleteMany({}),
    User.deleteMany({}),
  ]);
});

test.after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test('[SNX-FIXTURE-011] exactly 50 title fixtures exist', async () => {
  await seedDemoFixtures();

  assert.equal(await Content.countDocuments({ fixtureOwner: DEMO_FIXTURE_OWNER }), DEMO_FIXTURE_COUNT);
  assert.equal(await Content.countDocuments({}), DEMO_FIXTURE_COUNT);
});

test('[SNX-FIXTURE-012] fixture IDs are complete and unique', () => {
  const ids = fixtureIds();

  assert.equal(ids.length, 50);
  assert.equal(ids[0], 'SNX-TITLE-001');
  assert.equal(ids.at(-1), 'SNX-TITLE-050');
  assert.equal(new Set(ids).size, 50);
});

test('[SNX-FIXTURE-013] repeated seed is idempotent', async () => {
  const first = await seedDemoFixtures();
  const second = await seedDemoFixtures();

  assert.equal(first.titles.expected, DEMO_FIXTURE_COUNT);
  assert.equal(second.titles.expected, DEMO_FIXTURE_COUNT);
  assert.equal(await Content.countDocuments({ fixtureOwner: DEMO_FIXTURE_OWNER }), DEMO_FIXTURE_COUNT);
});

test('[SNX-FIXTURE-014] reset touches demo-owned records only', async () => {
  await seedDemoFixtures();
  const custom = await Content.create({
    title: 'Private Admin Title',
    type: 'movie',
    description: 'Not fixture owned',
    price: 4.99,
    image: '/images/default.svg',
    rentalLimit: 7,
    licenceLimit: 7,
    createdBy: new mongoose.Types.ObjectId(),
  });

  const dryRun = await resetDemoFixtures();
  const reset = await resetDemoFixtures({ write: true });

  assert.equal(dryRun.dryRun, true);
  assert.equal(dryRun.deleted, 0);
  assert.equal(reset.deleted, DEMO_FIXTURE_COUNT);
  assert.equal(await Content.exists({ _id: custom._id }).then(Boolean), true);
});

test('[SNX-FIXTURE-015] every title has valid access and artwork metadata', () => {
  for (const fixture of TITLE_FIXTURES) {
    assert.equal(fixture.fixtureOwner, DEMO_FIXTURE_OWNER);
    assert.match(fixture.fixtureId, /^SNX-TITLE-\d{3}$/);
    assert.ok(['movie', 'tv'].includes(fixture.type));
    assert.ok(['screening', 'festival', 'partner_preview'].includes(fixture.accessMode));
    assert.equal(fixture.rentalLimit, 20);
    assert.equal(fixture.licenceLimit, 20);
    assert.match(fixture.posterReference, /^\/images\//);
    assert.match(fixture.backdropReference, /^\/images\//);
    assert.ok(fixture.programKey);
    assert.ok(Array.isArray(fixture.collectionKeys));
    assert.ok(fixture.releaseWindow.opensAt instanceof Date);
    assert.ok(fixture.releaseWindow.closesAt instanceof Date);
  }
});

test('[SNX-FIXTURE-016] demo personas are deterministic', async () => {
  await seedDemoFixtures();

  const personaEmails = DEMO_PERSONAS.map((persona) => persona.email).sort();
  const users = await User.find({ email: { $in: personaEmails } }).sort({ email: 1 }).lean();
  const populated = users.find((user) => user.email === 'member.populated@streamnexus.test');
  const fresh = users.find((user) => user.email === 'member.fresh@streamnexus.test');

  assert.equal(users.length, DEMO_PERSONAS.length);
  assert.ok(populated);
  assert.equal(populated.shortlist.length, 3);
  assert.ok(fresh);
  assert.equal(fresh.shortlist.length, 0);
});

test('[SNX-DATA-012] fixture slugs are stable and unique', () => {
  const slugs = TITLE_FIXTURES.map((fixture) => fixture.slug);

  assert.equal(slugs.length, DEMO_FIXTURE_COUNT);
  assert.equal(new Set(slugs).size, DEMO_FIXTURE_COUNT);
  assert.equal(slugs[0], 'glass-harbor-signal-snx-title-001');
  assert.equal(slugs.at(-1), 'the-seventh-greenhouse-snx-title-050');
});

test('[SNX-SEC-021] fixture output contains no credentials or proprietary data', async () => {
  const result = await seedDemoFixtures();
  const inspection = await inspectDemoFixtures();
  const payload = JSON.stringify({ result, inspection, fixtures: TITLE_FIXTURES });

  assert.doesNotMatch(payload, /password|token|cookie|session|authorization/i);
  assert.doesNotMatch(payload, /Keanu|Kravitz|McConaughey|Hathaway|Oscar|Pascal|Chalamet|Pugh|Gosling|Robbie/i);
  assert.doesNotMatch(payload, /Disney|Netflix|Marvel|Warner|Universal|Paramount|HBO/i);
});
