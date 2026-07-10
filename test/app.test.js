process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-session-secret-with-enough-entropy';
process.env.SEED_DEMO_DATA = 'false';
process.env.LOGIN_RATE_LIMIT_MAX = '3';
process.env.LOGIN_RATE_LIMIT_WINDOW_MS = '60000';
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
let contentService;

const extractCsrfToken = (html) => {
  const match = html.match(/name=['"]_csrf['"] value=['"]([^'"]+)['"]/);
  assert.ok(match, 'Expected CSRF token in response body');
  return match[1];
};

const loginAs = async (role) => {
  const agent = request.agent(createApp());
  const loginPage = await agent.get('/login').expect(200);
  const csrfToken = extractCsrfToken(loginPage.text);
  const credentials = role === 'admin'
    ? { email: 'admin@gmail.com', password: 'admin' }
    : { email: 'streamer@gmail.com', password: 'streamer' };

  await agent
    .post('/login')
    .type('form')
    .send({ ...credentials, _csrf: csrfToken })
    .expect(302);

  return agent;
};

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri('streamnexus_test');

  ({ createApp } = require('../app'));
  ({ seedDatabase } = require('../controllers/authController'));
  Content = require('../models/Content');
  User = require('../models/User');
  Rental = require('../models/Rental');
  contentService = require('../services/contentService');

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

test('renders a CSRF token on login and rejects unsafe requests without it', async () => {
  const agent = request.agent(createApp());
  const loginPage = await agent.get('/login').expect(200);

  assert.match(loginPage.text, /name=['"]_csrf['"]/);

  await agent
    .post('/login')
    .type('form')
    .send({ email: 'admin@gmail.com', password: 'admin' })
    .expect(403);
});

test('guest landing page renders sign in and signup entry points', async () => {
  const agent = request.agent(createApp());
  const response = await agent.get('/').expect(200);

  assert.match(response.text, /StreamNexus/);
  assert.match(response.text, /Create Member Account/);
  assert.match(response.text, /Sign In/);
});

test('signup creates a member account and cannot create admin role', async () => {
  const agent = request.agent(createApp());
  const signupPage = await agent.get('/signup').expect(200);
  const csrfToken = extractCsrfToken(signupPage.text);

  await agent
    .post('/signup')
    .type('form')
    .send({
      email: 'new-streamer@example.com',
      password: 'streamerpass',
      confirmPassword: 'streamerpass',
      role: 'admin',
      _csrf: csrfToken,
    })
    .expect(302)
    .expect('Location', '/streamer/browse?signedup=true');

  const user = await User.findOne({ email: 'new-streamer@example.com' }).lean();
  assert.ok(user);
  assert.equal(user.role, 'member');
});

test('enforces role-protected admin routes', async () => {
  const streamerAgent = await loginAs('streamer');

  await streamerAgent
    .get('/admin/dashboard')
    .expect(403);
});

test('admin can create content with a valid CSRF token', async () => {
  const adminAgent = await loginAs('admin');
  const formPage = await adminAgent.get('/admin/content/new').expect(200);
  const csrfToken = extractCsrfToken(formPage.text);

  await adminAgent
    .post('/admin/content')
    .type('form')
    .send({
      title: 'Test Launch Film',
      type: 'movie',
      price: '4.99',
      rentalLimit: '7',
      description: 'A launch-readiness test title',
      genre: 'Drama',
      _csrf: csrfToken,
    })
    .expect(302);

  const created = await Content.findOne({ title: 'Test Launch Film' }).lean();
  assert.ok(created);
  assert.equal(created.price, 4.99);
  assert.equal(created.rentalLimit, 7);
});

test('streamer can shortlist and rent available content', async () => {
  const streamerAgent = await loginAs('streamer');
  const content = await Content.findOne({ available: true }).lean();
  assert.ok(content);

  const detailsPage = await streamerAgent.get(`/streamer/content/${content._id}`).expect(200);
  const csrfToken = extractCsrfToken(detailsPage.text);

  await streamerAgent
    .post(`/streamer/content/${content._id}/shortlist`)
    .type('form')
    .send({ _csrf: csrfToken })
    .expect(302);

  const user = await User.findOne({ email: 'streamer@gmail.com' }).lean();
  assert.equal(user.shortlist.length, 1);

  await streamerAgent
    .post(`/streamer/content/${content._id}/rent`)
    .type('form')
    .send({ _csrf: csrfToken })
    .expect(302);

  const rental = await Rental.findOne({ userId: user._id, contentId: content._id }).lean();
  assert.ok(rental);
  assert.equal(rental.status, 'active');
  assert.ok(rental.rentedAt);
  assert.ok(rental.expiresAt);
  const rentalDays = Math.round((rental.expiresAt.getTime() - rental.rentedAt.getTime()) / (24 * 60 * 60 * 1000));
  assert.equal(rentalDays, 45);
});

test('rental capacity blocks the sixth style over-limit rental and admin sees slots', async () => {
  const content = await Content.findOne({ available: true }).lean();
  assert.ok(content);
  await Content.updateOne({ _id: content._id }, { $set: { rentalLimit: 1 } });

  const firstStreamer = await loginAs('streamer');
  const firstDetails = await firstStreamer.get(`/streamer/content/${content._id}`).expect(200);
  const firstCsrf = extractCsrfToken(firstDetails.text);

  await firstStreamer
    .post(`/streamer/content/${content._id}/rent`)
    .type('form')
    .send({ _csrf: firstCsrf })
    .expect(302);

  const secondStreamer = request.agent(createApp());
  const signupPage = await secondStreamer.get('/signup').expect(200);
  const signupCsrf = extractCsrfToken(signupPage.text);
  await secondStreamer
    .post('/signup')
    .type('form')
    .send({
      email: 'capacity-user@example.com',
      password: 'streamerpass',
      confirmPassword: 'streamerpass',
      _csrf: signupCsrf,
    })
    .expect(302);

  const secondDetails = await secondStreamer.get(`/streamer/content/${content._id}`).expect(200);
  const secondCsrf = extractCsrfToken(secondDetails.text);
  await secondStreamer
    .post(`/streamer/content/${content._id}/rent`)
    .type('form')
    .send({ _csrf: secondCsrf })
    .expect(400);

  const adminAgent = await loginAs('admin');
  const dashboard = await adminAgent.get('/admin/dashboard').expect(200);
  assert.match(dashboard.text, /1 active \/ 1 max rentals/);
  assert.match(dashboard.text, /0 slots open/);
});

test('search treats regex metacharacters as literal input', async () => {
  await Content.deleteMany({});
  await Content.create([
    {
      title: 'A+B',
      type: 'movie',
      price: 2.99,
      available: true,
      description: 'Literal symbol test',
      genre: 'Test',
    },
    {
      title: 'Plain Match',
      type: 'movie',
      price: 2.99,
      available: true,
      description: 'Should not match wildcard input',
      genre: 'Drama',
    },
  ]);

  const literalResult = await contentService.searchContent('A+B');
  assert.equal(literalResult.success, true);
  assert.deepEqual(literalResult.data.map(item => item.title), ['A+B']);

  const wildcardResult = await contentService.searchContent('.*');
  assert.equal(wildcardResult.success, true);
  assert.equal(wildcardResult.data.length, 0);
});

test('member catalog supports URL-backed sort and pagination state', async () => {
  await Content.deleteMany({});
  await Content.create([
    { title: 'Alpha', type: 'movie', price: 1.99, available: true, description: 'First', genre: 'Drama' },
    { title: 'Bravo', type: 'movie', price: 5.99, available: true, description: 'Second', genre: 'Drama' },
  ]);

  const streamerAgent = await loginAs('streamer');
  const response = await streamerAgent
    .get('/streamer/browse?sort=price_desc&page=1')
    .expect(200);

  assert.match(response.text, /Browse Titles/);
  assert.match(response.text, /Price: high to low/);
  assert.ok(response.text.indexOf('Bravo') < response.text.indexOf('Alpha'));
});

test('login regenerates the session id after authentication', async () => {
  const agent = request.agent(createApp());
  const loginPage = await agent.get('/login').expect(200);
  const initialCookie = loginPage.headers['set-cookie']?.find(cookie => cookie.startsWith('streamnexus.sid='));
  const csrfToken = extractCsrfToken(loginPage.text);

  const loginResponse = await agent
    .post('/login')
    .type('form')
    .send({ email: 'admin@gmail.com', password: 'admin', _csrf: csrfToken })
    .expect(302);

  const nextCookie = loginResponse.headers['set-cookie']?.find(cookie => cookie.startsWith('streamnexus.sid='));
  assert.ok(initialCookie);
  assert.ok(nextCookie);
  assert.notEqual(initialCookie.split(';')[0], nextCookie.split(';')[0]);
});

test('stale sessionVersion forces reauthentication', async () => {
  const streamerAgent = await loginAs('streamer');
  const user = await User.findOne({ email: 'streamer@gmail.com' }).lean();
  await User.updateOne({ _id: user._id }, { $inc: { sessionVersion: 1 } });

  await streamerAgent
    .get('/streamer/browse')
    .expect(302)
    .expect('Location', '/login');
});

test('suspended accounts fail with a generic authentication response', async () => {
  await User.updateOne({ email: 'streamer@gmail.com' }, { $set: { status: 'suspended' } });
  const agent = request.agent(createApp());
  const loginPage = await agent.get('/login').expect(200);
  const csrfToken = extractCsrfToken(loginPage.text);

  const response = await agent
    .post('/login')
    .type('form')
    .send({ email: 'streamer@gmail.com', password: 'streamer', _csrf: csrfToken })
    .expect(401);

  assert.match(response.text, /Invalid email or password/);
  assert.doesNotMatch(response.text, /suspended/i);
});

test('rate limits repeated login attempts', async () => {
  const agent = request.agent(createApp());
  const loginPage = await agent.get('/login').expect(200);
  const csrfToken = extractCsrfToken(loginPage.text);

  for (let i = 0; i < 3; i++) {
    await agent
      .post('/login')
      .type('form')
      .send({ email: 'admin@gmail.com', password: 'wrong-password', _csrf: csrfToken })
      .expect(401);
  }

  await agent
    .post('/login')
    .type('form')
    .send({ email: 'admin@gmail.com', password: 'wrong-password', _csrf: csrfToken })
    .expect(429);
});
