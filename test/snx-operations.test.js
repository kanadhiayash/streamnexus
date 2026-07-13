process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-session-secret-with-enough-entropy';
process.env.SEED_DEMO_DATA = 'false';
process.env.DEMO_ADMIN_EMAIL = 'admin@gmail.com';
process.env.DEMO_ADMIN_PASSWORD = 'admin';
process.env.DEMO_STREAMER_EMAIL = 'streamer@gmail.com';
process.env.DEMO_STREAMER_PASSWORD = 'streamer';

const assert = require('node:assert/strict');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let createApp;
let AuditEvent;
let Content;
let Partner;
let Program;
let Rental;
let User;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const extractCsrfToken = (html) => {
  const match = html.match(/name=['"]_csrf['"] value=['"]([^'"]+)['"]/);
  assert.ok(match, 'Expected CSRF token in response body');
  return match[1];
};

const passwordHash = () => bcrypt.hash('password', 10);

const createUser = async ({ email, role = 'streamer', status = 'active' }) => User.create({
  email,
  password: await passwordHash(),
  role,
  status,
  displayName: email.split('@')[0],
  sessionVersion: 1,
});

const loginAs = async (email, password = 'password') => {
  const agent = request.agent(createApp());
  const loginPage = await agent.get('/login').expect(200);
  await agent
    .post('/login')
    .type('form')
    .send({ email, password, _csrf: extractCsrfToken(loginPage.text) })
    .expect(302);
  return agent;
};

const seedOperationsWorld = async () => {
  const [admin, member, partnerUser, otherPartnerUser] = await Promise.all([
    createUser({ email: 'ops-admin@example.com', role: 'admin' }),
    createUser({ email: 'ops-member@example.com' }),
    createUser({ email: 'partner-a@example.com', role: 'partner' }),
    createUser({ email: 'partner-b@example.com', role: 'partner' }),
  ]);
  const [partnerA, partnerB] = await Promise.all([
    Partner.create({ key: 'partner-a', name: 'Partner A', assignedUserIds: [partnerUser._id] }),
    Partner.create({ key: 'partner-b', name: 'Partner B', assignedUserIds: [otherPartnerUser._id] }),
  ]);
  const [titleA, titleB] = await Promise.all([
    Content.create({
      title: 'Partner A Title',
      type: 'movie',
      description: 'Partner scoped title',
      price: 4.99,
      partnerId: partnerA._id,
      available: true,
      lifecycle: 'published',
      rentalLimit: 2,
      licenceLimit: 2,
      activeLicenceCount: 1,
      releaseWindow: {
        opensAt: new Date(Date.now() - 2 * DAY_IN_MS),
        closesAt: new Date(Date.now() + 7 * DAY_IN_MS),
      },
    }),
    Content.create({
      title: 'Partner B Title',
      type: 'movie',
      description: 'Other partner title',
      price: 3.99,
      partnerId: partnerB._id,
      available: true,
      lifecycle: 'published',
      rentalLimit: 1,
      licenceLimit: 1,
      activeLicenceCount: 0,
    }),
  ]);
  const [programA, programB] = await Promise.all([
    Program.create({ partnerId: partnerA._id, key: 'a-program', name: 'Partner A Program', status: 'draft', titleIds: [titleA._id] }),
    Program.create({ partnerId: partnerB._id, key: 'b-program', name: 'Partner B Program', status: 'draft', titleIds: [titleB._id] }),
  ]);
  const access = await Rental.create({
    publicReference: 'SNX-OPS-ACCESS',
    userId: member._id,
    contentId: titleA._id,
    titleId: titleA._id,
    status: 'active',
    titleSnapshot: { title: titleA.title, slug: 'partner-a-title', posterReference: '/images/default.svg' },
    rentedAt: new Date(),
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * DAY_IN_MS),
  });
  return { access, admin, member, partnerA, partnerB, partnerUser, programA, programB, titleA, titleB };
};

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri('streamnexus_operations_test');

  ({ createApp } = require('../app'));
  AuditEvent = require('../models/AuditEvent');
  Content = require('../models/Content');
  Partner = require('../models/Partner');
  Program = require('../models/Program');
  Rental = require('../models/Rental');
  User = require('../models/User');

  await mongoose.connect(process.env.MONGO_URI);
});

test.beforeEach(async () => {
  await Promise.all([
    AuditEvent.deleteMany({}),
    Content.deleteMany({}),
    Partner.deleteMany({}),
    Program.deleteMany({}),
    Rental.deleteMany({}),
    User.deleteMany({}),
  ]);
});

test.after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test('[SNX-PARTNER-100] partner dashboard is ownership-scoped', async () => {
  await seedOperationsWorld();
  const agent = await loginAs('partner-a@example.com');

  const response = await agent.get('/partner/dashboard').expect(200);

  assert.match(response.text, /Partner A Program/);
  assert.match(response.text, /Partner A Title/);
  assert.doesNotMatch(response.text, /Partner B Program/);
  assert.doesNotMatch(response.text, /Partner B Title/);
});

test('[SNX-PARTNER-101] partner cannot edit another partner program', async () => {
  const world = await seedOperationsWorld();
  const agent = await loginAs('partner-a@example.com');
  const dashboard = await agent.get('/partner/dashboard').expect(200);

  await agent
    .post(`/partner/programs/${world.programB._id}/status`)
    .type('form')
    .send({ _csrf: extractCsrfToken(dashboard.text), status: 'published', confirmation: 'UPDATE' })
    .expect(403);

  const unchanged = await Program.findById(world.programB._id).lean();
  assert.equal(unchanged.status, 'draft');
});

test('[SNX-ADMIN-100] admin dashboard reports canonical operational state', async () => {
  await seedOperationsWorld();
  const agent = await loginAs('ops-admin@example.com');

  const response = await agent.get('/admin/dashboard').expect(200);

  assert.match(response.text, /Attention Required/);
  assert.match(response.text, /Partner Operations/);
  assert.match(response.text, /Access Activity/);
  assert.match(response.text, /System Health/);
  assert.match(response.text, /Partner A Program/);
  assert.match(response.text, /ops-member/);
});

test('[SNX-ADMIN-101] admin member suspension invalidates access safely', async () => {
  const world = await seedOperationsWorld();
  const memberAgent = await loginAs('ops-member@example.com');
  await memberAgent.get('/home').expect(200);
  const adminAgent = await loginAs('ops-admin@example.com');
  const dashboard = await adminAgent.get('/admin/dashboard').expect(200);

  await adminAgent
    .post(`/admin/members/${world.member._id}/suspend`)
    .type('form')
    .send({ _csrf: extractCsrfToken(dashboard.text), confirmation: 'SUSPEND' })
    .expect(302);

  const member = await User.findById(world.member._id).lean();
  assert.equal(member.status, 'suspended');
  assert.equal(member.sessionVersion, 2);
  await memberAgent.get('/home').expect(302).expect('Location', '/login');
});

test('[SNX-ADMIN-102] admin cancellation releases entitlement capacity once', async () => {
  const world = await seedOperationsWorld();
  const agent = await loginAs('ops-admin@example.com');
  const dashboard = await agent.get('/admin/dashboard').expect(200);

  await agent
    .post(`/admin/access/${world.access._id}/cancel`)
    .type('form')
    .send({ _csrf: extractCsrfToken(dashboard.text), confirmation: 'CANCEL' })
    .expect(302);

  const [access, title, audit] = await Promise.all([
    Rental.findById(world.access._id).lean(),
    Content.findById(world.titleA._id).lean(),
    AuditEvent.findOne({ action: 'SNX.access.cancelled' }).lean(),
  ]);
  assert.equal(access.status, 'cancelled');
  assert.equal(title.activeLicenceCount, 0);
  assert.ok(audit);
});

test('[SNX-ADMIN-103] reconciliation action reports deterministic result', async () => {
  const world = await seedOperationsWorld();
  await Content.updateOne({ _id: world.titleA._id }, { $set: { activeLicenceCount: 0 } });
  const agent = await loginAs('ops-admin@example.com');
  const dashboard = await agent.get('/admin/dashboard').expect(200);

  await agent
    .post('/admin/system/reconcile')
    .type('form')
    .send({ _csrf: extractCsrfToken(dashboard.text), confirmation: 'RECONCILE' })
    .expect(302)
    .expect('Location', '/admin/dashboard?reconciled=1');

  const [title, audit] = await Promise.all([
    Content.findById(world.titleA._id).lean(),
    AuditEvent.findOne({ action: 'SNX.system.reconciled' }).lean(),
  ]);
  assert.equal(title.activeLicenceCount, 1);
  assert.ok(audit);
});

test('[SNX-A11Y-240] operations tables and forms are keyboard usable', async () => {
  await seedOperationsWorld();
  const agent = await loginAs('ops-admin@example.com');
  const response = await agent.get('/admin/dashboard').expect(200);

  assert.match(response.text, /<table>/);
  assert.match(response.text, /name='_csrf'/);
  assert.match(response.text, /<button type='submit'/);
  assert.match(response.text, /aria-labelledby='members-heading'/);
});

test('[SNX-SEC-150] destructive operations require role ownership CSRF and confirmation', async () => {
  const world = await seedOperationsWorld();
  const adminAgent = await loginAs('ops-admin@example.com');
  const dashboard = await adminAgent.get('/admin/dashboard').expect(200);

  await adminAgent
    .post(`/admin/access/${world.access._id}/cancel`)
    .type('form')
    .send({ confirmation: 'CANCEL' })
    .expect(403);

  await adminAgent
    .post(`/admin/access/${world.access._id}/cancel`)
    .type('form')
    .send({ _csrf: extractCsrfToken(dashboard.text) })
    .expect(400);
});

test('[SNX-SEC-151] audit views expose no sensitive payloads', async () => {
  await seedOperationsWorld();
  await AuditEvent.create({
    action: 'SNX.member.suspended',
    targetType: 'user',
    metadata: {
      password: 'private-password',
      sessionId: 'session-private',
      note: 'public-safe-note',
    },
  });
  const agent = await loginAs('ops-admin@example.com');

  const response = await agent.get('/admin/dashboard').expect(200);

  assert.match(response.text, /SNX.member.suspended/);
  assert.doesNotMatch(response.text, /private-password|session-private/);
});
