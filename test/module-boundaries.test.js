const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const { createAdminUseCases } = require('../src/modules/admin/admin.useCases');
const { createAuthService } = require('../src/modules/auth/auth.service');
const { createCatalogService } = require('../src/modules/catalog/catalog.service');
const { buildCapacity } = require('../src/modules/rentals/rentals.service');

const silentAudit = { record: async () => ({ success: true }) };
const silentLogger = { info() {}, warn() {}, error() {} };

test('auth module registers public accounts through repository boundary', async () => {
  const created = [];
  const service = createAuthService({
    repository: {
      findExistingAccount: async () => null,
      createMember: async (data) => {
        created.push(data);
        return { _id: 'member-id', email: data.email, role: 'member' };
      },
    },
    auditService: silentAudit,
    hash: async value => `hashed:${value}`,
    compare: async () => true,
    logger: silentLogger,
  });

  const result = await service.registerMember({
    email: ' New-Member@Example.com ',
    password: 'demo123',
    confirmPassword: 'demo123',
  });

  assert.equal(created[0].email, 'new-member@example.com');
  assert.equal(created[0].passwordHash, 'hashed:demo123');
  assert.deepEqual(result.sessionUser, { id: 'member-id', email: 'new-member@example.com', role: 'member', sessionVersion: 1 });
  assert.equal(result.redirectTo, '/streamer/browse?signedup=true');
});

test('auth module keeps routine emails out of failure logs', async () => {
  const warnings = [];
  const service = createAuthService({
    repository: {
      findByEmail: async () => null,
    },
    auditService: silentAudit,
    logger: { ...silentLogger, warn: message => warnings.push(message) },
  });

  await assert.rejects(
    () => service.authenticate({ email: 'private-person@example.com', password: 'wrong-password' }),
    /Invalid email or password/
  );

  assert.equal(warnings.some(message => message.includes('private-person@example.com')), false);
});

test('catalog module validates admin title input before repository writes', async () => {
  const writes = [];
  const service = createCatalogService({
    repository: {
      create: async (data) => {
        writes.push(data);
        return { _id: 'title-id', ...data };
      },
    },
    auditService: silentAudit,
    logger: silentLogger,
  });

  const result = await service.createContent({
    title: '  Boundary Title ',
    type: 'movie',
    price: '4.99',
    available: 'on',
    rentalLimit: '6',
  });

  assert.equal(result.success, true);
  assert.equal(writes[0].title, 'Boundary Title');
  assert.equal(writes[0].price, 4.99);
  assert.equal(writes[0].rentalLimit, 6);
});

test('rental capacity remains a focused domain calculation', () => {
  assert.deepEqual(buildCapacity({ rentalLimit: 3 }, 2), {
    rentalLimit: 3,
    activeRentals: 2,
    remaining: 1,
    isFull: false,
  });
  assert.equal(buildCapacity({ rentalLimit: 3 }, 3).isFull, true);
});

test('admin module composes dashboard state without controller calculations', async () => {
  const useCases = createAdminUseCases({
    catalog: { getAllContent: async () => ({ success: true, data: [{ _id: 'a', rentalLimit: 5 }] }) },
    rentals: {
      getAllRentals: async () => ({ success: true, data: [{ _id: 'rental' }] }),
      getRentalStats: async () => ({ success: true, data: { totalRentals: 1, activeRentals: 1, completedRentals: 0 } }),
      attachCapacityToContents: async contents => ({
        success: true,
        data: contents.map(content => ({ ...content, capacity: { rentalLimit: 5, activeRentals: 2, remaining: 3 } })),
      }),
    },
  });

  const result = await useCases.loadDashboard();

  assert.equal(result.success, true);
  assert.equal(result.data.stats.totalSlots, 5);
  assert.equal(result.data.stats.activeSlots, 2);
  assert.equal(result.data.stats.remainingSlots, 3);
});

test('migrated controllers do not import Mongoose models directly', () => {
  const controllerDir = path.join(__dirname, '..', 'controllers');
  const migrated = ['authController.js', 'adminController.js', 'streamerController.js'];

  for (const file of migrated) {
    const source = fs.readFileSync(path.join(controllerDir, file), 'utf8');
    assert.equal(source.includes("require('../models/"), false, `${file} imports a model directly`);
  }
});
