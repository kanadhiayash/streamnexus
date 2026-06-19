process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'load-test-session-secret-with-enough-entropy';
process.env.SEED_DEMO_DATA = 'false';
process.env.LOGIN_RATE_LIMIT_MAX = process.env.LOGIN_RATE_LIMIT_MAX || '1000';
process.env.LOGIN_RATE_LIMIT_WINDOW_MS = process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '60000';
process.env.DEMO_ADMIN_EMAIL = 'admin@gmail.com';
process.env.DEMO_ADMIN_PASSWORD = 'admin';
process.env.DEMO_STREAMER_EMAIL = 'streamer@gmail.com';
process.env.DEMO_STREAMER_PASSWORD = 'streamer';

const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const ITERATIONS = Number(process.env.LOAD_TEST_ITERATIONS || 40);
const MAX_AVG_MS = Number(process.env.LOAD_TEST_MAX_AVG_MS || 250);
const MAX_P95_MS = Number(process.env.LOAD_TEST_MAX_P95_MS || 750);

const extractCsrfToken = (html) => {
  const match = html.match(/name=['"]_csrf['"] value=['"]([^'"]+)['"]/);
  assert.ok(match, 'Expected CSRF token in response body');
  return match[1];
};

const timed = async (label, fn, results) => {
  const start = process.hrtime.bigint();
  await fn();
  const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
  results.push({ label, durationMs });
};

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

(async () => {
  let mongoServer;
  try {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongoServer.getUri('streamnexus_load');

    const { createApp } = require('../app');
    const { seedDatabase } = require('../controllers/authController');
    const Content = require('../models/Content');
    const User = require('../models/User');
    const Rental = require('../models/Rental');

    await mongoose.connect(process.env.MONGO_URI);
    await Promise.all([Content.deleteMany({}), User.deleteMany({}), Rental.deleteMany({})]);
    await seedDatabase({ isProduction: false });

    const app = createApp();
    const results = [];

    for (let i = 0; i < ITERATIONS; i++) {
      await timed('guest-login-page', () => request(app).get('/login').expect(200), results);
      await timed('guest-landing-page', () => request(app).get('/').expect(200), results);
    }

    const streamer = request.agent(app);
    const loginPage = await streamer.get('/login').expect(200);
    const csrfToken = extractCsrfToken(loginPage.text);
    await streamer
      .post('/login')
      .type('form')
      .send({ email: 'streamer@gmail.com', password: 'streamer', _csrf: csrfToken })
      .expect(302);

    for (let i = 0; i < ITERATIONS; i++) {
      await timed('streamer-browse', () => streamer.get('/streamer/browse').expect(200), results);
      await timed('streamer-search', () => streamer.get('/streamer/browse?search=neon&type=movie').expect(200), results);
      await timed('streamer-rentals', () => streamer.get('/streamer/rentals').expect(200), results);
    }

    const durations = results.map((result) => result.durationMs);
    const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
    const p95 = percentile(durations, 95);
    const summary = {
      iterations: ITERATIONS,
      requests: results.length,
      average_ms: Math.round(average),
      p95_ms: Math.round(p95),
      max_ms: Math.round(Math.max(...durations)),
      thresholds: {
        average_ms: MAX_AVG_MS,
        p95_ms: MAX_P95_MS,
      },
    };

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

    assert.ok(average <= MAX_AVG_MS, `Average latency ${Math.round(average)}ms exceeded ${MAX_AVG_MS}ms`);
    assert.ok(p95 <= MAX_P95_MS, `p95 latency ${Math.round(p95)}ms exceeded ${MAX_P95_MS}ms`);
  } finally {
    await mongoose.disconnect().catch(() => {});
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
})().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exit(1);
});
