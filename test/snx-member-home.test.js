process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-session-secret-with-enough-entropy';
process.env.SEED_DEMO_DATA = 'false';
process.env.DEMO_ADMIN_EMAIL = 'admin@gmail.com';
process.env.DEMO_ADMIN_PASSWORD = 'admin';
process.env.DEMO_STREAMER_EMAIL = 'streamer@gmail.com';
process.env.DEMO_STREAMER_PASSWORD = 'streamer';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const ROOT = path.resolve(__dirname, '..');

let mongoServer;
let createApp;
let seedDatabase;
let Content;
let User;
let Rental;

const extractCsrfToken = (html) => {
  const match = html.match(/name=['"]_csrf['"] value=['"]([^'"]+)['"]/);
  assert.ok(match, 'Expected CSRF token in response body');
  return match[1];
};

const loginAs = async (email, password) => {
  const agent = request.agent(createApp());
  const loginPage = await agent.get('/login').expect(200);
  const csrfToken = extractCsrfToken(loginPage.text);
  await agent
    .post('/login')
    .type('form')
    .send({ email, password, _csrf: csrfToken })
    .expect(302);
  return agent;
};

const createAccess = async ({ user, title, daysFromNow }) => {
  const now = new Date();
  return Rental.create({
    publicReference: `SNX-${title._id.toString().slice(-8).toUpperCase()}${daysFromNow}`,
    userId: user._id,
    contentId: title._id,
    titleId: title._id,
    status: 'active',
    titleSnapshot: {
      title: title.title,
      slug: title.slug,
      posterReference: title.image,
    },
    idempotencyKeyHash: `${user._id}-${title._id}-${daysFromNow}`,
    rentedAt: now,
    startedAt: now,
    expiresAt: new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000),
  });
};

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri('streamnexus_member_home_test');

  ({ createApp } = require('../app'));
  ({ seedDatabase } = require('../controllers/authController'));
  Content = require('../models/Content');
  User = require('../models/User');
  Rental = require('../models/Rental');

  await mongoose.connect(process.env.MONGO_URI);
});

test.beforeEach(async () => {
  await Promise.all([
    Content.deleteMany({}),
    User.deleteMany({}),
    Rental.deleteMany({}),
  ]);
  await seedDatabase({ isProduction: false });
});

test.after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test('[SNX-UI-300] member home renders populated state', async () => {
  const agent = await loginAs('member.populated@streamnexus.test', 'streamnexus-demo');
  const response = await agent.get('/home').expect(200);

  assert.match(response.text, /Member Home/);
  assert.match(response.text, /Your saved titles, active access, and curated discovery/);
  assert.match(response.text, /My List Preview/);
  assert.match(response.text, /Featured Programs/);
  assert.match(response.text, /Sponsored screening/);
});

test('[SNX-UI-301] member home renders fresh-member state', async () => {
  const agent = await loginAs('member.fresh@streamnexus.test', 'streamnexus-demo');
  const response = await agent.get('/home').expect(200);

  assert.match(response.text, /Start by saving a title or activating a simulated access pass/);
  assert.match(response.text, /No active access yet/);
  assert.match(response.text, /Saved titles will appear here/);
});

test('[SNX-ACCESS-110] active access appears on member home', async () => {
  const user = await User.findOne({ email: 'member.fresh@streamnexus.test' });
  const title = await Content.findOne({ available: true }).lean();
  await createAccess({ user, title, daysFromNow: 20 });

  const agent = await loginAs('member.fresh@streamnexus.test', 'streamnexus-demo');
  const response = await agent.get('/home').expect(200);

  assert.match(response.text, /Active Access/);
  assert.match(response.text, new RegExp(title.title));
  assert.match(response.text, /20 days remaining|19 days remaining/);
});

test('[SNX-ACCESS-111] expiring access is prioritized correctly', async () => {
  const user = await User.findOne({ email: 'member.fresh@streamnexus.test' });
  const titles = await Content.find({ available: true }).sort({ fixtureId: 1 }).limit(2).lean();
  await createAccess({ user, title: titles[0], daysFromNow: 6 });
  await createAccess({ user, title: titles[1], daysFromNow: 30 });

  const agent = await loginAs('member.fresh@streamnexus.test', 'streamnexus-demo');
  const response = await agent.get('/home').expect(200);

  const expiringSection = response.text.slice(response.text.indexOf('Expiring Soon'), response.text.indexOf('My List Preview'));
  assert.match(expiringSection, new RegExp(titles[0].title));
  assert.doesNotMatch(expiringSection, new RegExp(titles[1].title));
});

test('[SNX-UI-302] My List preview reflects saved state', async () => {
  const populated = await User.findOne({ email: 'member.populated@streamnexus.test' }).populate('shortlist').lean();
  const savedTitle = populated.shortlist[0].title;

  const agent = await loginAs('member.populated@streamnexus.test', 'streamnexus-demo');
  const response = await agent.get('/home').expect(200);

  assert.match(response.text, /My List Preview/);
  assert.match(response.text, new RegExp(savedTitle));
});

test('[SNX-UI-303] discovery card has a valid destination', async () => {
  const agent = await loginAs('member.populated@streamnexus.test', 'streamnexus-demo');
  const response = await agent.get('/home').expect(200);
  const match = response.text.match(/href=['"](\/(?:titles|programs|home\?search=)[^'"]+)['"][^>]*class='[^']*member-link-card/);

  assert.ok(match, 'Expected a member discovery card with a destination');
  const destination = match[1].startsWith('/home?') ? match[1] : match[1];
  await agent.get(destination).expect(200);
});

test('[SNX-A11Y-220] member rails are keyboard operable', async () => {
  const agent = await loginAs('member.populated@streamnexus.test', 'streamnexus-demo');
  const response = await agent.get('/home').expect(200);
  const railSection = response.text.slice(response.text.indexOf('Featured Programs'), response.text.indexOf("id='browse-titles'"));

  assert.match(railSection, /class='rail-grid member-rail'/);
  assert.match(railSection, /aria-label='Open .*'/);
  assert.match(railSection, /<a href=/);
});

test('[SNX-RELEASE-020] member copy does not imply playback or AI recommendations', () => {
  const browseView = fs.readFileSync(path.join(ROOT, 'views', 'streamer', 'browse.ejs'), 'utf8');

  assert.doesNotMatch(browseView, /continue watching/i);
  assert.doesNotMatch(browseView, /watch progress/i);
  assert.doesNotMatch(browseView, /recommended for you/i);
  assert.doesNotMatch(browseView, /AI recommendation/i);
  assert.match(browseView, /Deterministic grouping/);
});
