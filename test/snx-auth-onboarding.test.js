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
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const ROOT = path.resolve(__dirname, '..');
const UI_SCRIPT = path.join(ROOT, 'public', 'js', 'ui.js');

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

const loginWith = async (agent, credentials, returnTo = '') => {
  const loginPath = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login';
  const loginPage = await agent.get(loginPath).expect(200);
  const csrfToken = extractCsrfToken(loginPage.text);
  return agent
    .post('/login')
    .type('form')
    .send({ ...credentials, returnTo, _csrf: csrfToken });
};

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri('streamnexus_auth_onboarding_test');

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

test('[SNX-AUTH-100] member demo selector fills expected fields', async () => {
  const response = await request(createApp()).get('/login').expect(200);
  const script = fs.readFileSync(UI_SCRIPT, 'utf8');

  assert.match(response.text, /data-demo-persona/);
  assert.match(response.text, /data-demo-email='streamer@gmail.com'/);
  assert.match(response.text, /data-demo-password='streamer'/);
  assert.match(response.text, /Demo Member/);
  assert.match(script, /data-demo-persona/);
  assert.match(script, /credentials filled/);
});

test('[SNX-AUTH-101] admin demo selector fills expected fields', async () => {
  const response = await request(createApp()).get('/login').expect(200);

  assert.match(response.text, /data-demo-email='admin@gmail.com'/);
  assert.match(response.text, /data-demo-password='admin'/);
  assert.match(response.text, /Demo Admin/);
});

test('[SNX-AUTH-102] successful member login reaches member home', async () => {
  const agent = request.agent(createApp());
  const response = await loginWith(agent, { email: 'streamer@gmail.com', password: 'streamer' }, '/my-list');

  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/my-list');

  const home = await agent.get('/home').expect(200);
  assert.match(home.text, /Browse Titles/);
});

test('[SNX-AUTH-103] successful admin login reaches admin dashboard', async () => {
  const agent = request.agent(createApp());
  const response = await loginWith(agent, { email: 'admin@gmail.com', password: 'admin' }, '/admin/content');

  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/admin/content');

  const dashboard = await agent.get('/admin/dashboard').expect(200);
  assert.match(dashboard.text, /Admin Dashboard/);
});

test('[SNX-AUTH-104] signup creates member role only', async () => {
  const agent = request.agent(createApp());
  const signupPage = await agent.get('/signup').expect(200);
  const csrfToken = extractCsrfToken(signupPage.text);

  await agent
    .post('/signup')
    .type('form')
    .send({
      email: 'auth-onboarding-member@example.com',
      password: 'memberpass',
      confirmPassword: 'memberpass',
      role: 'admin',
      _csrf: csrfToken,
    })
    .expect(302)
    .expect('Location', '/home?signedup=true');

  const user = await User.findOne({ email: 'auth-onboarding-member@example.com' }).lean();
  assert.equal(user.role, 'member');

  const welcome = await agent.get('/home?signedup=true').expect(200);
  assert.match(welcome.text, /Your member workspace is ready/);
});

test('[SNX-AUTH-105] authenticated user cannot remain on guest auth page', async () => {
  const memberAgent = request.agent(createApp());
  await loginWith(memberAgent, { email: 'streamer@gmail.com', password: 'streamer' });
  await memberAgent.get('/login').expect(302).expect('Location', '/home');
  await memberAgent.get('/signup').expect(302).expect('Location', '/home');

  const adminAgent = request.agent(createApp());
  await loginWith(adminAgent, { email: 'admin@gmail.com', password: 'admin' });
  await adminAgent.get('/login').expect(302).expect('Location', '/admin/dashboard');
});

test('[SNX-A11Y-210] auth errors are announced and field-associated', async () => {
  const agent = request.agent(createApp());
  const response = await loginWith(agent, { email: 'admin@gmail.com', password: 'wrong-password' });

  assert.equal(response.status, 401);
  assert.match(response.text, /id='auth-error' role='alert'/);
  assert.match(response.text, /aria-describedby='email-help auth-error'/);
  assert.match(response.text, /aria-describedby='password-help auth-error'/);
  assert.match(response.text, /aria-invalid='true'/);
});

test('[SNX-SEC-130] authentication response does not enumerate accounts', async () => {
  const unknownAgent = request.agent(createApp());
  const unknown = await loginWith(unknownAgent, { email: 'nobody@example.com', password: 'wrong-password' });

  const wrongPasswordAgent = request.agent(createApp());
  const wrongPassword = await loginWith(wrongPasswordAgent, { email: 'admin@gmail.com', password: 'wrong-password' });

  assert.equal(unknown.status, 401);
  assert.equal(wrongPassword.status, 401);
  assert.match(unknown.text, /Invalid email or password/);
  assert.match(wrongPassword.text, /Invalid email or password/);
  assert.doesNotMatch(unknown.text, /account does not exist|not found|suspended/i);
  assert.doesNotMatch(wrongPassword.text, /account does not exist|not found|suspended/i);
});

test('[SNX-SEC-130] guest auth pages are rate-limited before authorization checks', () => {
  const authRoutes = fs.readFileSync(path.join(ROOT, 'routes', 'auth.js'), 'utf8');
  const rateLimitConfig = fs.readFileSync(path.join(ROOT, 'middleware', 'rateLimit.js'), 'utf8');

  assert.match(authRoutes, /router\.get\('\/login', authPageRateLimiter, ensureGuest, showLogin\)/);
  assert.match(authRoutes, /router\.get\('\/signup', authPageRateLimiter, ensureGuest, showSignup\)/);
  assert.match(rateLimitConfig, /const authPageRateLimiter = createLimiter/);
  assert.match(rateLimitConfig, /AUTH_PAGE_RATE_LIMIT/);
});
