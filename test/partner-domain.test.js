const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPartnerDomainService,
  stableUniqueIds,
} = require('../src/modules/partners/partnerDomain.service');

const makeRepository = (overrides = {}) => ({
  findPartnerById: async () => ({ _id: 'partner-a', assignedUserIds: ['partner-user-1'] }),
  createProgram: async program => ({ _id: 'program-a', ...program }),
  updateProgram: async (programId, patch) => ({ _id: programId, partnerId: 'partner-a', ...patch }),
  findProgramById: async () => ({ _id: 'program-a', partnerId: 'partner-a', titleIds: ['title-a'] }),
  createCollection: async collection => ({ _id: 'collection-a', ...collection }),
  findCollectionById: async () => ({ _id: 'collection-a', partnerId: 'partner-a' }),
  findReleaseWindowsForTitle: async () => [],
  ...overrides,
});

const makeService = ({ repository = makeRepository(), auditEvents = [] } = {}) => createPartnerDomainService({
  repository,
  auditService: {
    record: async event => {
      auditEvents.push(event);
      return { success: true, data: event };
    },
  },
});

test('[SNX-PARTNER-010] partner ownership is enforced', async () => {
  const auditEvents = [];
  const service = makeService({ auditEvents });

  const result = await service.createProgram(
    { userId: 'partner-user-1', role: 'partner' },
    'partner-a',
    { key: 'market-preview', name: 'Market Preview', titleIds: ['title-b', 'title-a'] },
  );

  assert.equal(result.success, true);
  assert.equal(result.data.partnerId, 'partner-a');
  assert.deepEqual(result.data.titleIds, ['title-a', 'title-b']);
  assert.deepEqual(auditEvents.map(event => event.action), ['SNX.program.created']);
});

test('[SNX-PARTNER-011] partner cannot mutate another partner record', async () => {
  const service = makeService({
    repository: makeRepository({
      findProgramById: async () => ({ _id: 'program-b', partnerId: 'partner-b', titleIds: ['title-b'] }),
      findPartnerById: async () => ({ _id: 'partner-b', assignedUserIds: ['other-partner-user'] }),
    }),
  });

  const result = await service.updateProgram(
    { userId: 'partner-user-1', role: 'partner' },
    'program-b',
    { titleIds: ['title-c'] },
  );

  assert.equal(result.success, false);
  assert.equal(result.code, 'FORBIDDEN');
  assert.equal(result.statusCode, 403);
});

test('[SNX-PARTNER-012] admin can operate across partners', async () => {
  const service = makeService({
    repository: makeRepository({
      findPartnerById: async () => ({ _id: 'partner-b', assignedUserIds: ['partner-user-2'] }),
      createProgram: async program => ({ _id: 'program-b', ...program }),
    }),
  });

  const result = await service.createProgram(
    { userId: 'admin-1', role: 'admin' },
    'partner-b',
    { key: 'admin-preview', name: 'Admin Preview', titleIds: ['title-z'] },
  );

  assert.equal(result.success, true);
  assert.equal(result.data.partnerId, 'partner-b');
  assert.equal(result.data._id, 'program-b');
});

test('[SNX-DATA-020] program-title relationship remains consistent', async () => {
  const service = makeService();

  const result = await service.createProgram(
    { userId: 'partner-user-1', role: 'partner' },
    'partner-a',
    {
      key: 'consistent-program',
      name: 'Consistent Program',
      titleIds: ['title-c', 'title-a', 'title-c', null, 'title-b'],
    },
  );

  assert.equal(result.success, true);
  assert.deepEqual(result.data.titleIds, ['title-a', 'title-b', 'title-c']);
  assert.deepEqual(stableUniqueIds(['b', 'a', 'b', undefined]), ['a', 'b']);
});

test('[SNX-DATA-021] collection membership is deterministic', async () => {
  const service = makeService();

  const result = await service.createCollection(
    { userId: 'partner-user-1', role: 'partner' },
    'partner-a',
    {
      key: 'festival-slate',
      name: 'Festival Slate',
      titleIds: ['title-2', 'title-1', 'title-2'],
      programIds: ['program-2', 'program-1', 'program-2'],
    },
  );

  assert.equal(result.success, true);
  assert.deepEqual(result.data.titleIds, ['title-1', 'title-2']);
  assert.deepEqual(result.data.programIds, ['program-1', 'program-2']);
});

test('[SNX-ACCESS-020] release window controls unlock eligibility', async () => {
  const service = makeService({
    repository: makeRepository({
      findReleaseWindowsForTitle: async () => [{
        titleId: 'title-windowed',
        status: 'active',
        opensAt: '2026-07-01T00:00:00.000Z',
        closesAt: '2026-07-31T23:59:59.000Z',
      }],
    }),
  });

  const result = await service.canUnlockTitle('title-windowed', new Date('2026-07-15T12:00:00.000Z'));

  assert.equal(result.success, true);
  assert.equal(result.data, true);
});

test('[SNX-ACCESS-021] expired release window blocks new access', async () => {
  const service = makeService({
    repository: makeRepository({
      findReleaseWindowsForTitle: async () => [{
        titleId: 'title-expired',
        status: 'expired',
        opensAt: '2026-06-01T00:00:00.000Z',
        closesAt: '2026-06-30T23:59:59.000Z',
      }],
    }),
  });

  const unlockResult = await service.canUnlockTitle('title-expired', new Date('2026-07-15T12:00:00.000Z'));
  const overlapResult = await service.assertReleaseWindowCanBeCreated('title-expired', {
    opensAt: '2026-06-15T00:00:00.000Z',
    closesAt: '2026-07-05T00:00:00.000Z',
  });

  assert.equal(unlockResult.success, true);
  assert.equal(unlockResult.data, false);
  assert.equal(overlapResult.success, false);
  assert.equal(overlapResult.code, 'VALIDATION_ERROR');
});

test('[SNX-SEC-030] partner audit payload is privacy-safe', async () => {
  const auditEvents = [];
  const service = makeService({ auditEvents });

  await service.createCollection(
    {
      userId: 'partner-user-1',
      role: 'partner',
      email: 'partner@example.com',
      password: 'private',
      token: 'secret-token',
      sessionId: 'session-123',
    },
    'partner-a',
    { key: 'safe-audit', name: 'Safe Audit', titleIds: ['title-a'], programIds: ['program-a'] },
  );

  assert.equal(auditEvents.length, 1);
  assert.deepEqual(Object.keys(auditEvents[0]).sort(), ['action', 'actorId', 'targetId', 'targetType']);
  assert.doesNotMatch(JSON.stringify(auditEvents[0]), /email|password|token|session/i);
});
