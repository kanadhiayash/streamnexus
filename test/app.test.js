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
let redactSensitive;

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

const submitLogin = async (agent, credentials) => {
  const loginPage = await agent.get('/login').expect(200);
  const csrfToken = extractCsrfToken(loginPage.text);

  return agent
    .post('/login')
    .type('form')
    .send({ ...credentials, _csrf: csrfToken });
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
  ({ redactSensitive } = require('../middleware/errorHandler'));

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
  assert.match(response.text, /class="skip-link" href="#main-content"/);
  assert.match(response.text, /<main id="main-content" class="container" tabindex="-1">/);
  assert.match(response.text, /Create Member Account/);
  assert.match(response.text, /Sign In/);
});

test('public pages send defensive browser security headers', async () => {
  const agent = request.agent(createApp());
  const response = await agent.get('/').expect(200);

  assert.match(response.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['x-powered-by'], undefined);
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

test('admin archives, restores, and publishes content without hard deleting it', async () => {
  const content = await Content.create({
    title: 'Admin Lifecycle Probe',
    type: 'movie',
    price: 3.99,
    available: true,
    lifecycle: 'published',
    description: 'Lifecycle operations test title',
    genre: 'Test',
    expiresAt: new Date(),
  });

  const adminAgent = await loginAs('admin');
  const listPage = await adminAgent.get('/admin/content').expect(200);
  const csrfToken = extractCsrfToken(listPage.text);

  await adminAgent
    .post(`/admin/content/${content._id}/lifecycle/archive`)
    .type('form')
    .send({ _csrf: csrfToken, returnTo: '/admin/content' })
    .expect(302)
    .expect('Location', '/admin/content?lifecycle=archive');

  let updated = await Content.findById(content._id).lean();
  assert.equal(updated.lifecycle, 'archived');
  assert.equal(updated.available, false);
  assert.ok(updated.archivedAt);

  const memberAgent = await loginAs('streamer');
  const archivedBrowse = await memberAgent.get('/streamer/browse?search=Admin%20Lifecycle%20Probe').expect(200);
  assert.match(archivedBrowse.text, /No matching titles found/);
  assert.doesNotMatch(archivedBrowse.text, /Lifecycle operations test title/);

  await adminAgent
    .post(`/admin/content/${content._id}/lifecycle/restore`)
    .type('form')
    .send({ _csrf: csrfToken, returnTo: '/admin/content' })
    .expect(302);

  updated = await Content.findById(content._id).lean();
  assert.equal(updated.lifecycle, 'unpublished');
  assert.equal(updated.available, false);

  await adminAgent
    .post(`/admin/content/${content._id}/lifecycle/publish`)
    .type('form')
    .send({ _csrf: csrfToken, returnTo: '/admin/content' })
    .expect(302);

  updated = await Content.findById(content._id).lean();
  assert.equal(updated.lifecycle, 'published');
  assert.equal(updated.available, true);

  const publishedBrowse = await memberAgent.get('/streamer/browse?search=Admin%20Lifecycle%20Probe').expect(200);
  assert.match(publishedBrowse.text, /Lifecycle operations test title/);
});

test('[SNX-SEC-105] admin lifecycle mutations reject GET and missing CSRF requests', async () => {
  const content = await Content.create({
    title: 'Security Lifecycle Probe',
    type: 'movie',
    price: 3.99,
    available: true,
    lifecycle: 'published',
    description: 'Security mutation test title',
    genre: 'Test',
  });

  const adminAgent = await loginAs('admin');

  await adminAgent
    .get(`/admin/content/${content._id}/lifecycle/archive`)
    .expect(404);

  let updated = await Content.findById(content._id).lean();
  assert.equal(updated.lifecycle, 'published');
  assert.equal(updated.available, true);

  await adminAgent
    .post(`/admin/content/${content._id}/lifecycle/archive`)
    .type('form')
    .send({ returnTo: '/admin/content' })
    .expect(403);

  updated = await Content.findById(content._id).lean();
  assert.equal(updated.lifecycle, 'published');
  assert.equal(updated.available, true);
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

test('member reviews, confirms, opens, and returns a rental by public reference', async () => {
  const streamerAgent = await loginAs('streamer');
  const content = await Content.findOne({ available: true }).lean();
  assert.ok(content);

  const reviewPage = await streamerAgent.get(`/streamer/content/${content._id}/review`).expect(200);
  assert.match(reviewPage.text, /Confirm Rental/);
  assert.match(reviewPage.text, /Simulated payment for demo review only/);
  assert.match(reviewPage.text, /does not process payments or enable playback/);
  const csrfToken = extractCsrfToken(reviewPage.text);

  const firstConfirm = await streamerAgent
    .post(`/streamer/content/${content._id}/rent`)
    .type('form')
    .send({ _csrf: csrfToken })
    .expect(302);

  assert.match(firstConfirm.headers.location, /^\/streamer\/rentals\?rented=true&ref=SNX-/);

  const user = await User.findOne({ email: 'streamer@gmail.com' }).lean();
  const rental = await Rental.findOne({ userId: user._id, contentId: content._id }).lean();
  assert.ok(rental);
  assert.ok(rental.publicReference);

  await streamerAgent
    .post(`/streamer/content/${content._id}/rent`)
    .type('form')
    .send({ _csrf: csrfToken })
    .expect(302);

  const activeCount = await Rental.countDocuments({ userId: user._id, contentId: content._id, status: 'active' });
  assert.equal(activeCount, 1);

  const detailPage = await streamerAgent.get(`/streamer/rentals/ref/${rental.publicReference}`).expect(200);
  assert.match(detailPage.text, /Rental confirmation/);
  assert.match(detailPage.text, new RegExp(rental.publicReference));
  assert.match(detailPage.text, /Return Access/);

  const secondStreamer = request.agent(createApp());
  const signupPage = await secondStreamer.get('/signup').expect(200);
  const signupCsrf = extractCsrfToken(signupPage.text);
  await secondStreamer
    .post('/signup')
    .type('form')
    .send({
      email: 'reference-owner-check@example.com',
      password: 'streamerpass',
      confirmPassword: 'streamerpass',
      _csrf: signupCsrf,
    })
    .expect(302);

  await secondStreamer
    .get(`/streamer/rentals/ref/${rental.publicReference}`)
    .expect(403);

  const returnCsrf = extractCsrfToken(detailPage.text);
  await streamerAgent
    .post(`/streamer/rentals/${rental._id}/checkout`)
    .type('form')
    .send({ _csrf: returnCsrf })
    .expect(302)
    .expect('Location', '/streamer/rentals?checkout=success');

  const returned = await Rental.findById(rental._id).lean();
  assert.equal(returned.status, 'returned');
  assert.equal(returned.endReason, 'member_returned');
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

test('[SNX-AUTH-001] member login persists after redirect', async () => {
  const agent = request.agent(createApp());
  const response = await submitLogin(agent, { email: 'streamer@gmail.com', password: 'streamer' });

  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/streamer/browse');
  assert.ok(response.headers['set-cookie']?.some(cookie => cookie.startsWith('streamnexus.sid=')));

  const destination = await agent.get('/streamer/browse').expect(200);
  assert.match(destination.text, /Browse Titles/);
  assert.doesNotMatch(destination.text, /Sign In/);
});

test('[SNX-AUTH-002] admin login persists after redirect', async () => {
  const agent = request.agent(createApp());
  const response = await submitLogin(agent, { email: 'admin@gmail.com', password: 'admin' });

  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/admin/dashboard');

  const dashboard = await agent.get('/admin/dashboard').expect(200);
  assert.match(dashboard.text, /Admin Dashboard/);
  assert.doesNotMatch(dashboard.text, /Sign In/);
});

test('[SNX-AUTH-003] valid session persists after reload', async () => {
  const agent = request.agent(createApp());
  const response = await submitLogin(agent, { email: 'streamer@gmail.com', password: 'streamer' });

  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/streamer/browse');

  await agent.get('/streamer/browse').expect(200);
  const reloaded = await agent.get('/streamer/browse').expect(200);
  assert.match(reloaded.text, /Browse Titles/);
});

test('[SNX-AUTH-004] legacy demo account is repaired', async () => {
  await User.updateOne(
    { email: 'streamer@gmail.com' },
    { $unset: { role: '', status: '', sessionVersion: '', shortlist: '', rented: '' } }
  );

  await seedDatabase({ isProduction: false });

  const repaired = await User.findOne({ email: 'streamer@gmail.com' }).lean();
  assert.equal(repaired.role, 'streamer');
  assert.equal(repaired.status, 'active');
  assert.equal(repaired.sessionVersion, 1);
  assert.deepEqual(repaired.shortlist, []);
  assert.deepEqual(repaired.rented, []);

  const agent = request.agent(createApp());
  const response = await submitLogin(agent, { email: 'streamer@gmail.com', password: 'streamer' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/streamer/browse');
  await agent.get('/streamer/browse').expect(200);
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

test('[SNX-AUTH-005] suspended account is rejected', async () => {
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

test('[SNX-SEC-100] login throttle applies by account and IP', async () => {
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

test('[SNX-SEC-101] signup throttle blocks automated abuse', async () => {
  const previousLimit = process.env.SIGNUP_RATE_LIMIT_MAX;
  process.env.SIGNUP_RATE_LIMIT_MAX = '2';

  try {
    const agent = request.agent(createApp());
    const signupPage = await agent.get('/signup').expect(200);
    const csrfToken = extractCsrfToken(signupPage.text);

    for (let i = 0; i < 2; i++) {
      await agent
        .post('/signup')
        .type('form')
        .send({
          email: `invalid-signup-${i}@example.com`,
          password: 'streamerpass',
          confirmPassword: 'mismatch',
          _csrf: csrfToken,
        })
        .expect(400);
    }

    await agent
      .post('/signup')
      .type('form')
      .send({
        email: 'invalid-signup-3@example.com',
        password: 'streamerpass',
        confirmPassword: 'mismatch',
        _csrf: csrfToken,
      })
      .expect(429);
  } finally {
    if (previousLimit === undefined) {
      delete process.env.SIGNUP_RATE_LIMIT_MAX;
    } else {
      process.env.SIGNUP_RATE_LIMIT_MAX = previousLimit;
    }
  }
});

test('[SNX-SEC-102] unsafe return destination is rejected', async () => {
  const streamerAgent = await loginAs('streamer');
  const content = await Content.findOne({ available: true }).lean();
  const detailsPage = await streamerAgent.get(`/streamer/content/${content._id}`).expect(200);
  const csrfToken = extractCsrfToken(detailsPage.text);

  await streamerAgent
    .post(`/streamer/content/${content._id}/shortlist`)
    .type('form')
    .send({ _csrf: csrfToken })
    .expect(302);

  await streamerAgent
    .post(`/streamer/content/${content._id}/shortlist/remove`)
    .type('form')
    .send({ _csrf: csrfToken, returnTo: 'https://evil.example/steal' })
    .expect(400);

  const user = await User.findOne({ email: 'streamer@gmail.com' }).lean();
  assert.equal(user.shortlist.length, 1);

  await streamerAgent
    .post(`/streamer/content/${content._id}/shortlist/remove`)
    .type('form')
    .send({ _csrf: csrfToken, returnTo: '/streamer/shortlist' })
    .expect(302)
    .expect('Location', '/streamer/shortlist');
});

test('[SNX-SEC-103] oversized request body is rejected', async () => {
  const previousBodyLimit = process.env.REQUEST_BODY_LIMIT;
  const previousQueryLimit = process.env.REQUEST_QUERY_MAX_LENGTH;
  process.env.REQUEST_BODY_LIMIT = '200b';
  process.env.REQUEST_QUERY_MAX_LENGTH = '12';

  try {
    const agent = request.agent(createApp());
    const loginPage = await agent.get('/login').expect(200);
    const csrfToken = extractCsrfToken(loginPage.text);

    await agent
      .post('/login')
      .type('form')
      .send({ email: 'admin@gmail.com', password: 'x'.repeat(500), _csrf: csrfToken })
      .expect(413);

    await request(createApp())
      .get(`/?${'q'.repeat(13)}=1`)
      .expect(414);
  } finally {
    if (previousBodyLimit === undefined) delete process.env.REQUEST_BODY_LIMIT;
    else process.env.REQUEST_BODY_LIMIT = previousBodyLimit;
    if (previousQueryLimit === undefined) delete process.env.REQUEST_QUERY_MAX_LENGTH;
    else process.env.REQUEST_QUERY_MAX_LENGTH = previousQueryLimit;
  }
});

test('[SNX-SEC-104] object ownership is enforced server-side', async () => {
  const ownerAgent = await loginAs('streamer');
  const content = await Content.findOne({ available: true }).lean();
  const reviewPage = await ownerAgent.get(`/streamer/content/${content._id}/review`).expect(200);
  const csrfToken = extractCsrfToken(reviewPage.text);

  await ownerAgent
    .post(`/streamer/content/${content._id}/rent`)
    .type('form')
    .send({ _csrf: csrfToken })
    .expect(302);

  const owner = await User.findOne({ email: 'streamer@gmail.com' }).lean();
  const rental = await Rental.findOne({ userId: owner._id, contentId: content._id }).lean();
  const otherAgent = request.agent(createApp());
  const signupPage = await otherAgent.get('/signup').expect(200);
  const signupCsrf = extractCsrfToken(signupPage.text);

  await otherAgent
    .post('/signup')
    .type('form')
    .send({
      email: 'object-owner-check@example.com',
      password: 'streamerpass',
      confirmPassword: 'streamerpass',
      _csrf: signupCsrf,
    })
    .expect(302);

  await otherAgent
    .get(`/streamer/rentals/ref/${rental.publicReference}`)
    .expect(403);
});

test('[SNX-SEC-106] idempotent access confirmation prevents duplicate writes', async () => {
  const streamerAgent = await loginAs('streamer');
  const content = await Content.findOne({ available: true }).lean();
  const reviewPage = await streamerAgent.get(`/streamer/content/${content._id}/review`).expect(200);
  const csrfToken = extractCsrfToken(reviewPage.text);
  const idempotencyKey = 'snx-confirmation-test-key';

  await streamerAgent
    .post(`/streamer/content/${content._id}/rent`)
    .set('Idempotency-Key', idempotencyKey)
    .type('form')
    .send({ _csrf: csrfToken })
    .expect(302);

  await streamerAgent
    .post(`/streamer/content/${content._id}/rent`)
    .set('Idempotency-Key', idempotencyKey)
    .type('form')
    .send({ _csrf: csrfToken })
    .expect(302);

  const user = await User.findOne({ email: 'streamer@gmail.com' }).lean();
  const rentals = await Rental.find({ userId: user._id, contentId: content._id }).lean();
  assert.equal(rentals.length, 1);
  assert.ok(rentals[0].idempotencyKeyHash);
});

test('[SNX-SEC-107] logs exclude sensitive authentication and session data', () => {
  const redacted = redactSensitive('email=private@example.com password=secret token=abc cookie=sid sessionId=xyz authorization=bearer');

  assert.doesNotMatch(redacted, /private@example\.com|secret|abc|sid|xyz|bearer/i);
  assert.match(redacted, /redacted/);
});

test('[SNX-AUTH-020] suspended account cannot use protected routes', async () => {
  const streamerAgent = await loginAs('streamer');
  const user = await User.findOne({ email: 'streamer@gmail.com' }).lean();
  await User.updateOne({ _id: user._id }, { $set: { status: 'suspended' } });

  await streamerAgent
    .get('/streamer/browse')
    .expect(302)
    .expect('Location', '/login');
});
