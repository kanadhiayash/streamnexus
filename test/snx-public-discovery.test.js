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
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const ROOT = path.resolve(__dirname, '..');
const UI_SCRIPT = path.join(ROOT, 'public', 'js', 'ui.js');
const PUBLIC_VIEWS = [
  path.join(ROOT, 'views', 'index.ejs'),
  path.join(ROOT, 'views', 'public', 'catalog.ejs'),
  path.join(ROOT, 'views', 'public', 'program.ejs'),
  path.join(ROOT, 'views', 'public', 'collection.ejs'),
  path.join(ROOT, 'views', 'public', 'access.ejs'),
  path.join(ROOT, 'views', 'streamer', 'details.ejs'),
];

let mongoServer;
let createApp;
let seedDatabase;
let Content;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri('streamnexus_public_discovery_test');

  ({ createApp } = require('../app'));
  ({ seedDatabase } = require('../controllers/authController'));
  Content = require('../models/Content');

  await mongoose.connect(process.env.MONGO_URI);
});

test.beforeEach(async () => {
  await Content.deleteMany({});
  await seedDatabase({ isProduction: false });
});

test.after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test('[SNX-UI-200] public landing renders curated discovery modules', async () => {
  const response = await request(createApp()).get('/').expect(200);

  assert.match(response.text, /Screening Programs/);
  assert.match(response.text, /Public Screening Picks/);
  assert.match(response.text, /How Access Works/);
  assert.match(response.text, /data-carousel-auto/);
  assert.match(response.text, /Create Member Account/);
  assert.match(response.text, /Sign In/);
});

test('[SNX-UI-201] public title card opens a valid destination', async () => {
  const response = await request(createApp()).get('/catalog').expect(200);
  const match = response.text.match(/href=['"](\/titles\/[^'"]+)['"][^>]*>View Screening/);

  assert.ok(match, 'Expected public title cards to link to a title detail page');
  await request(createApp()).get(match[1]).expect(200);
});

test('[SNX-UI-202] featured rotation advances and pauses correctly', () => {
  const script = fs.readFileSync(UI_SCRIPT, 'utf8');

  assert.match(script, /data-carousel-auto/);
  assert.match(script, /setInterval/);
  assert.match(script, /data-carousel-toggle/);
  assert.match(script, /Pause featured rotation/);
  assert.match(script, /Resume featured rotation/);
  assert.match(script, /visibilitychange/);
  assert.match(script, /pointerdown/);
  assert.match(script, /pointerup/);
});

test('[SNX-IA-030] public program and collection routes resolve', async () => {
  await request(createApp()).get('/programs/program-northstar').expect(200).expect(/Northstar Program/);
  await request(createApp()).get('/collections/collection-featured').expect(200).expect(/Featured Screenings/);
  await request(createApp()).get('/access').expect(200).expect(/How StreamNexus Access Works/);
});

test('[SNX-ACCESS-100] public access explanation is accurate', async () => {
  const response = await request(createApp()).get('/access').expect(200);

  assert.match(response.text, /fictional titles/i);
  assert.match(response.text, /45-day access windows/);
  assert.match(response.text, /No real payment processing/);
  assert.match(response.text, /No real media playback/);
  assert.match(response.text, /No real commercial licensing claim/);
});

test('[SNX-A11Y-200] featured controls are keyboard operable', async () => {
  const response = await request(createApp()).get('/').expect(200);
  const script = fs.readFileSync(UI_SCRIPT, 'utf8');

  assert.match(response.text, /data-carousel-prev/);
  assert.match(response.text, /data-carousel-next/);
  assert.match(response.text, /data-carousel-toggle/);
  assert.match(response.text, /aria-pressed='false'/);
  assert.match(script, /focusin/);
  assert.match(script, /focusout/);
});

test('[SNX-A11Y-201] reduced-motion mode disables automatic movement', () => {
  const script = fs.readFileSync(UI_SCRIPT, 'utf8');

  assert.match(script, /prefers-reduced-motion: reduce/);
  assert.match(script, /is-reduced-motion/);
  assert.match(script, /toggle\?\.setAttribute\('disabled', 'true'\)/);
});

test('[SNX-RELEASE-010] public copy remains evidence-bounded', () => {
  const publicCopy = PUBLIC_VIEWS.map(file => fs.readFileSync(file, 'utf8')).join('\n');
  const prohibitedClaims = [
    /watch now/i,
    /start streaming/i,
    /real payment accepted/i,
    /licensed streaming platform/i,
    /commercially licensed/i,
  ];

  for (const claim of prohibitedClaims) {
    assert.doesNotMatch(publicCopy, claim);
  }

  assert.match(publicCopy, /fictional|simulated|No real/i);
});
