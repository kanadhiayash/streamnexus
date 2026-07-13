const { createAuditService } = require('../audit/audit.service');
const { ForbiddenError, ValidationError, toServiceResult } = require('../../shared/errors/domainErrors');
const { createPartnerDomainRepository } = require('./partnerDomain.repository');

const normalizeId = (value) => value?.toString();

const stableUniqueIds = (ids = []) => [...new Set(ids.map(normalizeId).filter(Boolean))].sort();

const isAdminActor = (actor = {}) => actor.role === 'admin';

const isAssignedPartnerActor = (actor = {}, partner) => {
  if (!partner) return false;
  const actorId = normalizeId(actor.userId || actor._id || actor.id);
  if (!actorId) return false;
  return (partner.assignedUserIds || []).some((assignedId) => normalizeId(assignedId) === actorId);
};

const assertScopedPartnerAccess = (actor, partner) => {
  if (isAdminActor(actor) || isAssignedPartnerActor(actor, partner)) return;
  throw new ForbiddenError('Partner record is outside the assigned scope');
};

const assertWindowRange = ({ opensAt, closesAt }) => {
  const opens = new Date(opensAt);
  const closes = new Date(closesAt);
  if (Number.isNaN(opens.getTime()) || Number.isNaN(closes.getTime()) || opens >= closes) {
    throw new ValidationError('Release window must open before it closes');
  }
};

const hasOverlappingWindow = (windows, candidate) => windows.some((window) => {
  const existingOpen = new Date(window.opensAt);
  const existingClose = new Date(window.closesAt);
  const candidateOpen = new Date(candidate.opensAt);
  const candidateClose = new Date(candidate.closesAt);
  return candidateOpen < existingClose && candidateClose > existingOpen;
});

const isWindowEligible = (window, at = new Date()) => {
  if (!window || window.status === 'cancelled') return false;
  const current = new Date(at);
  return current >= new Date(window.opensAt) && current <= new Date(window.closesAt);
};

const createSafePartnerAudit = (auditService) => async ({ action, actorId, targetType, targetId }) => auditService.record({
  action,
  actorId,
  targetType,
  targetId,
});

const createPartnerDomainService = ({
  repository = createPartnerDomainRepository(),
  auditService = createAuditService(),
} = {}) => {
  const recordAudit = createSafePartnerAudit(auditService);

  return {
    assertScopedPartnerAccess,

    async createProgram(actor, partnerId, programInput) {
      return toServiceResult(async () => {
        const partner = await repository.findPartnerById(partnerId);
        assertScopedPartnerAccess(actor, partner);
        const program = await repository.createProgram({
          partnerId,
          key: programInput.key,
          name: programInput.name,
          status: programInput.status || 'draft',
          titleIds: stableUniqueIds(programInput.titleIds),
        });
        await recordAudit({
          action: 'SNX.program.created',
          actorId: actor.userId,
          targetType: 'program',
          targetId: program._id,
        });
        return program;
      });
    },

    async updateProgram(actor, programId, patch) {
      return toServiceResult(async () => {
        const program = await repository.findProgramById(programId);
        const partner = program ? await repository.findPartnerById(program.partnerId) : null;
        assertScopedPartnerAccess(actor, partner);
        const updated = await repository.updateProgram(programId, {
          ...patch,
          titleIds: patch.titleIds ? stableUniqueIds(patch.titleIds) : program.titleIds,
        });
        await recordAudit({
          action: 'SNX.program.updated',
          actorId: actor.userId,
          targetType: 'program',
          targetId: programId,
        });
        return updated;
      });
    },

    async createCollection(actor, partnerId, collectionInput) {
      return toServiceResult(async () => {
        const partner = await repository.findPartnerById(partnerId);
        assertScopedPartnerAccess(actor, partner);
        const collection = await repository.createCollection({
          partnerId,
          key: collectionInput.key,
          name: collectionInput.name,
          status: collectionInput.status || 'draft',
          titleIds: stableUniqueIds(collectionInput.titleIds),
          programIds: stableUniqueIds(collectionInput.programIds),
          editorialRank: collectionInput.editorialRank || null,
        });
        await recordAudit({
          action: 'SNX.partner.collection-created',
          actorId: actor.userId,
          targetType: 'collection',
          targetId: collection._id,
        });
        return collection;
      });
    },

    async assertReleaseWindowCanBeCreated(titleId, candidateWindow) {
      return toServiceResult(async () => {
        assertWindowRange(candidateWindow);
        const windows = await repository.findReleaseWindowsForTitle(titleId);
        if (hasOverlappingWindow(windows, candidateWindow)) {
          throw new ValidationError('Release window overlaps an existing window');
        }
        return true;
      });
    },

    async canUnlockTitle(titleId, at = new Date()) {
      return toServiceResult(async () => {
        const windows = await repository.findReleaseWindowsForTitle(titleId);
        return windows.some((window) => isWindowEligible(window, at));
      });
    },
  };
};

module.exports = {
  assertScopedPartnerAccess,
  createPartnerDomainService,
  hasOverlappingWindow,
  isWindowEligible,
  stableUniqueIds,
};
