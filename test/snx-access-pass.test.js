process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-session-secret-with-enough-entropy';
process.env.SEED_DEMO_DATA = 'false';
process.env.DEMO_ADMIN_EMAIL = 'admin@gmail.com';
process.env.DEMO_ADMIN_PASSWORD = 'admin';
process.env.DEMO_STREAMER_EMAIL = 'streamer@gmail.com';
process.env.DEMO_STREAMER_PASSWORD = 'streamer';

const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let createApp;
let seedDatabase;
let Content;
let User;
let Rental;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const extractCsrfToken = (html) => {
  const match = html.match(/name=['"]_csrf['"] value=['"]([^'"]+)['"]/);
  assert.ok(match, 'Expected CSRF token in response body');
  return match[1];
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const loginAs = async (email = 'streamer@gmail.com', password = 'streamer') => {
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

const makeAccessReadyTitle = async (extraQuery = {}) => {
  const title = await Content.findOne({ available: true, ...extraQuery }).sort({ fixtureId: 1 });
  assert.ok(title, 'Expected seeded title');
  const now = Date.now();
  await Content.updateOne(
    { _id: title._id },
    {
      $set: {
        available: true,
        lifecycle: 'published',
        rentalLimit: 2,
        licenceLimit: 2,
        activeLicenceCount: 0,
        releaseWindow: {
          opensAt: new Date(now - DAY_IN_MS),
          closesAt: new Date(now + 14 * DAY_IN_MS),
        },
      },
    }
  );
  return Content.findById(title._id).lean();
};

const confirmAccess = async (agent, title, idempotencyKey = '') => {
  const reviewPage = await agent.get(`/titles/${title._id}/review`).expect(200);
  const requestBuilder = agent
    .post(`/titles/${title._id}/rent`)
    .type('form');
  if (idempotencyKey) requestBuilder.set('Idempotency-Key', idempotencyKey);
  return requestBuilder
    .send({ _csrf: extractCsrfToken(reviewPage.text) })
    .expect(302);
};

const createTerminalAccess = async ({ user, title, status }) => {
  const now = new Date();
  return Rental.create({
    publicReference: `SNX-${status.toUpperCase()}-${title._id.toString().slice(-6).toUpperCase()}`,
    userId: user._id,
    contentId: title._id,
    titleId: title._id,
    status,
    titleSnapshot: {
      title: title.title,
      slug: title.slug,
      posterReference: title.image,
    },
    date: new Date(now.getTime() - 10 * DAY_IN_MS),
    rentedAt: new Date(now.getTime() - 10 * DAY_IN_MS),
    startedAt: new Date(now.getTime() - 10 * DAY_IN_MS),
    expiresAt: new Date(now.getTime() - DAY_IN_MS),
    endedAt: new Date(now.getTime() - DAY_IN_MS),
    endReason: status,
  });
};

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri('streamnexus_access_pass_test');

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

test('[SNX-ACCESS-200] access review reflects canonical policy', async () => {
  const title = await makeAccessReadyTitle();
  const agent = await loginAs();
  const response = await agent.get(`/titles/${title._id}/review`).expect(200);

  assert.match(response.text, /Review Access Pass/);
  assert.match(response.text, /Simulated price/);
  assert.match(response.text, /45 days from confirmation/);
  assert.match(response.text, /Licence availability/);
  assert.match(response.text, /No real payment is processed/);
  assert.match(response.text, /No protected playback is enabled/);

  const expiredWindowTitle = await makeAccessReadyTitle({ _id: { $ne: title._id } });
  await Content.updateOne(
    { _id: expiredWindowTitle._id },
    {
      $set: {
        releaseWindow: {
          opensAt: new Date(Date.now() - 10 * DAY_IN_MS),
          closesAt: new Date(Date.now() - DAY_IN_MS),
        },
      },
    }
  );
  const expiredResponse = await agent.get(`/titles/${expiredWindowTitle._id}/review`).expect(200);
  assert.match(expiredResponse.text, /Access window closed/);
  assert.match(expiredResponse.text, /Access cannot be confirmed right now/);
});

test('[SNX-ACCESS-201] confirmation creates one entitlement', async () => {
  const title = await makeAccessReadyTitle();
  const agent = await loginAs();
  const response = await confirmAccess(agent, title);

  assert.match(response.headers.location, /^\/my-access\?rented=true&ref=SNX-/);
  const user = await User.findOne({ email: 'streamer@gmail.com' }).lean();
  const access = await Rental.findOne({ userId: user._id, contentId: title._id }).lean();
  assert.equal(access.status, 'active');
  assert.ok(access.publicReference);
});

test('[SNX-ACCESS-202] duplicate confirmation is idempotent', async () => {
  const title = await makeAccessReadyTitle();
  const agent = await loginAs();
  const idempotencyKey = 'snx-access-pass-confirmation';
  await confirmAccess(agent, title, idempotencyKey);
  await confirmAccess(agent, title, idempotencyKey);

  const user = await User.findOne({ email: 'streamer@gmail.com' }).lean();
  const rows = await Rental.find({ userId: user._id, contentId: title._id }).lean();
  assert.equal(rows.length, 1);
  assert.ok(rows[0].idempotencyKeyHash);
});

test('[SNX-ACCESS-203] My Access separates active and history states', async () => {
  const titleOne = await makeAccessReadyTitle();
  const titleTwo = await makeAccessReadyTitle({ _id: { $ne: titleOne._id } });
  const agent = await loginAs();
  await confirmAccess(agent, titleOne);
  const user = await User.findOne({ email: 'streamer@gmail.com' }).lean();
  const returned = await Rental.findOne({ userId: user._id, contentId: titleOne._id }).lean();
  const detailPage = await agent.get(`/my-access/ref/${returned.publicReference}`).expect(200);
  await agent
    .post(`/my-access/${returned._id}/checkout`)
    .type('form')
    .send({ _csrf: extractCsrfToken(detailPage.text) })
    .expect(302);
  await confirmAccess(agent, titleTwo);

  const response = await agent.get('/my-access').expect(200);
  const activeSection = response.text.slice(response.text.indexOf('Active Access'), response.text.indexOf('History'));
  const historySection = response.text.slice(response.text.indexOf('History'));
  assert.match(activeSection, new RegExp(escapeRegExp(titleTwo.title)));
  assert.doesNotMatch(activeSection, new RegExp(escapeRegExp(titleOne.title)));
  assert.match(historySection, new RegExp(escapeRegExp(titleOne.title)));
  assert.match(historySection, /Access returned/);
});

test('[SNX-ACCESS-204] return updates entitlement and capacity once', async () => {
  const title = await makeAccessReadyTitle();
  const agent = await loginAs();
  await confirmAccess(agent, title);
  const user = await User.findOne({ email: 'streamer@gmail.com' }).lean();
  const access = await Rental.findOne({ userId: user._id, contentId: title._id }).lean();
  const detailPage = await agent.get(`/my-access/ref/${access.publicReference}`).expect(200);
  const csrfToken = extractCsrfToken(detailPage.text);

  await agent.post(`/my-access/${access._id}/checkout`).type('form').send({ _csrf: csrfToken }).expect(302);
  await agent.post(`/my-access/${access._id}/checkout`).type('form').send({ _csrf: csrfToken }).expect(302);

  const returned = await Rental.findById(access._id).lean();
  const updatedTitle = await Content.findById(title._id).lean();
  assert.equal(returned.status, 'returned');
  assert.equal(updatedTitle.activeLicenceCount, 0);
});

test('[SNX-ACCESS-205] expired and cancelled states remain terminal', async () => {
  const titleOne = await makeAccessReadyTitle();
  const titleTwo = await makeAccessReadyTitle({ _id: { $ne: titleOne._id } });
  const user = await User.findOne({ email: 'streamer@gmail.com' });
  const expired = await createTerminalAccess({ user, title: titleOne, status: 'expired' });
  await createTerminalAccess({ user, title: titleTwo, status: 'cancelled' });
  const agent = await loginAs();

  const listPage = await agent.get('/my-access').expect(200);
  assert.match(listPage.text, /Access expired/);
  assert.match(listPage.text, /Access cancelled/);
  const detailPage = await agent.get(`/my-access/ref/${expired.publicReference}`).expect(200);
  assert.match(detailPage.text, /terminal and cannot be reactivated/);
});

test('[SNX-CAPACITY-100] at-capacity conflict maps to recovery UI', async () => {
  const title = await makeAccessReadyTitle();
  await Content.updateOne({ _id: title._id }, { $set: { rentalLimit: 1, licenceLimit: 1, activeLicenceCount: 1 } });
  const agent = await loginAs();
  const reviewPage = await agent.get(`/titles/${title._id}/review`).expect(200);
  const response = await agent
    .post(`/titles/${title._id}/rent`)
    .type('form')
    .send({ _csrf: extractCsrfToken(reviewPage.text) })
    .expect(409);

  assert.match(response.text, /Access cannot be confirmed right now/);
  assert.match(response.text, /All simulated access seats/);
  assert.match(response.text, /Open My Access/);
  assert.match(response.text, /Browse available titles/);
});

test('[SNX-A11Y-230] access state is understandable without colour', async () => {
  const title = await makeAccessReadyTitle();
  const agent = await loginAs();
  await confirmAccess(agent, title);
  const user = await User.findOne({ email: 'streamer@gmail.com' }).lean();
  const access = await Rental.findOne({ userId: user._id, contentId: title._id }).lean();
  const response = await agent.get(`/my-access/ref/${access.publicReference}`).expect(200);

  assert.match(response.text, /Active access/);
  assert.match(response.text, /Access lifecycle timeline/);
  assert.match(response.text, /Confirmed/);
  assert.match(response.text, /Expires/);
});

test('[SNX-SEC-140] member can read only owned access records', async () => {
  const title = await makeAccessReadyTitle();
  const ownerAgent = await loginAs();
  await confirmAccess(ownerAgent, title);
  const owner = await User.findOne({ email: 'streamer@gmail.com' }).lean();
  const access = await Rental.findOne({ userId: owner._id, contentId: title._id }).lean();

  const otherAgent = request.agent(createApp());
  const signupPage = await otherAgent.get('/signup').expect(200);
  await otherAgent
    .post('/signup')
    .type('form')
    .send({
      email: 'snx-access-owner@example.com',
      password: 'streamerpass',
      confirmPassword: 'streamerpass',
      _csrf: extractCsrfToken(signupPage.text),
    })
    .expect(302);

  await otherAgent.get(`/my-access/ref/${access.publicReference}`).expect(403);
});
