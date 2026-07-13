const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAccessEntitlementsService,
  isTerminalAccessState,
  mapRentalToAccessEntitlement,
} = require('../src/modules/access/accessEntitlements.service');

const baseRental = {
  _id: 'rental-1',
  publicReference: 'SNX-ACCESS-0001',
  userId: 'member-1',
  contentId: 'title-1',
  titleId: 'title-1',
  status: 'active',
  titleSnapshot: {
    title: 'Compatibility Title',
    slug: 'compatibility-title',
    posterReference: '/images/default.svg',
  },
  priceSnapshot: {
    amountMinor: 499,
    currencyCode: 'CAD',
  },
  policySnapshot: {
    version: 'rental-v1',
    durationDays: 45,
  },
  startedAt: new Date('2026-07-01T00:00:00.000Z'),
  rentedAt: new Date('2026-07-01T00:00:00.000Z'),
  expiresAt: new Date('2026-08-15T00:00:00.000Z'),
};

test('[SNX-ACCESS-010] legacy rental maps to canonical access entitlement', () => {
  const entitlement = mapRentalToAccessEntitlement({
    ...baseRental,
    status: 'completed',
    completedAt: new Date('2026-07-02T00:00:00.000Z'),
  });

  assert.equal(entitlement.status, 'returned');
  assert.equal(entitlement.memberId, 'member-1');
  assert.equal(entitlement.titleId, 'title-1');
  assert.equal(entitlement.legacy.collection, 'rentals');
  assert.equal(entitlement.legacy.originalStatus, 'completed');
});

test('[SNX-ACCESS-011] active entitlement returns once and becomes terminal', async () => {
  const auditEvents = [];
  const service = createAccessEntitlementsService({
    rentalsService: {
      returnRental: async () => ({
        success: true,
        data: {
          ...baseRental,
          status: 'returned',
          endedAt: new Date('2026-07-02T00:00:00.000Z'),
          endReason: 'member_returned',
        },
      }),
    },
    auditService: { record: async event => { auditEvents.push(event); return { success: true, data: event }; } },
  });

  const result = await service.returnAccess('rental-1', 'member-1');

  assert.equal(result.success, true);
  assert.equal(result.data.status, 'returned');
  assert.equal(isTerminalAccessState(result.data.status), true);
  assert.deepEqual(auditEvents.map(event => event.action), ['SNX.access.returned']);
});

test('[SNX-ACCESS-012] expired entitlement remains terminal', () => {
  const entitlement = mapRentalToAccessEntitlement({
    ...baseRental,
    status: 'expired',
    endedAt: new Date('2026-08-15T00:00:00.000Z'),
    endReason: 'expired',
  });

  assert.equal(entitlement.status, 'expired');
  assert.equal(isTerminalAccessState(entitlement.status), true);
});

test('[SNX-ACCESS-013] cancelled entitlement remains terminal', async () => {
  const service = createAccessEntitlementsService({
    rentalsService: {
      cancelRentalAsAdmin: async () => ({
        success: true,
        data: {
          ...baseRental,
          status: 'cancelled',
          endedAt: new Date('2026-07-03T00:00:00.000Z'),
          endReason: 'admin_cancelled',
        },
      }),
    },
    auditService: { record: async event => ({ success: true, data: event }) },
  });

  const result = await service.cancelAccessAsAdmin('rental-1', 'admin-1');

  assert.equal(result.success, true);
  assert.equal(result.data.status, 'cancelled');
  assert.equal(isTerminalAccessState(result.data.status), true);
});

test('[SNX-ACCESS-014] duplicate active access is deterministic', async () => {
  const service = createAccessEntitlementsService({
    rentalsService: {
      createRental: async () => ({
        success: true,
        data: { ...baseRental, idempotent: true },
      }),
    },
    auditService: { record: async event => ({ success: true, data: event }) },
  });

  const result = await service.createAccessEntitlement('member-1', 'title-1');

  assert.equal(result.success, true);
  assert.equal(result.data.status, 'active');
  assert.equal(result.data.idempotent, true);
  assert.equal(result.data.publicReference, 'SNX-ACCESS-0001');
});

test('[SNX-DATA-010] entitlement snapshots remain backward compatible', () => {
  const entitlement = mapRentalToAccessEntitlement(baseRental);

  assert.deepEqual(entitlement.titleSnapshot, baseRental.titleSnapshot);
  assert.deepEqual(entitlement.priceSnapshot, baseRental.priceSnapshot);
  assert.deepEqual(entitlement.policySnapshot, baseRental.policySnapshot);
  assert.equal(entitlement.accessWindow.startedAt, baseRental.startedAt);
  assert.equal(entitlement.accessWindow.expiresAt, baseRental.expiresAt);
});

test('[SNX-SEC-020] access audit payload excludes credentials and session data', async () => {
  const auditEvents = [];
  const service = createAccessEntitlementsService({
    rentalsService: {
      createRental: async () => ({
        success: true,
        data: { ...baseRental },
      }),
    },
    auditService: { record: async event => { auditEvents.push(event); return { success: true, data: event }; } },
  });

  await service.createAccessEntitlement('member-1', 'title-1', {
    email: 'private@example.com',
    password: 'do-not-log',
    token: 'secret-token',
    sessionId: 'session-123',
  });

  assert.equal(auditEvents.length, 1);
  assert.deepEqual(Object.keys(auditEvents[0]).sort(), ['action', 'actorId', 'targetId', 'targetType']);
  assert.doesNotMatch(JSON.stringify(auditEvents[0]), /email|password|token|session/i);
});
