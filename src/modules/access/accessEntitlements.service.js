const { createAuditService } = require('../audit/audit.service');
const { mapRentalToV2 } = require('../data/compatibility');
const { createRentalsService } = require('../rentals/rentals.service');

const ACTIVE_ACCESS_STATE = 'active';
const TERMINAL_ACCESS_STATES = new Set(['returned', 'expired', 'cancelled', 'denied']);

const normalizeAccessState = (status) => (status === 'completed' ? 'returned' : status);

const isTerminalAccessState = (status) => TERMINAL_ACCESS_STATES.has(normalizeAccessState(status));

const mapRentalToAccessEntitlement = (rentalRecord, titleRecord) => {
  const mapped = mapRentalToV2(rentalRecord, titleRecord);

  return {
    schemaVersion: mapped.schemaVersion,
    entitlementId: rentalRecord?._id || rentalRecord?.id || null,
    publicReference: mapped.publicReference,
    memberId: mapped.userId,
    titleId: mapped.titleId,
    status: normalizeAccessState(mapped.status),
    titleSnapshot: mapped.titleSnapshot,
    priceSnapshot: mapped.priceSnapshot,
    policySnapshot: mapped.policySnapshot,
    accessWindow: {
      startedAt: mapped.startedAt,
      expiresAt: mapped.expiresAt,
      endedAt: mapped.endedAt,
    },
    endReason: mapped.endReason,
    idempotent: Boolean(rentalRecord?.idempotent),
    legacy: {
      collection: 'rentals',
      rentalId: rentalRecord?._id || rentalRecord?.id || null,
      originalStatus: rentalRecord?.status || null,
    },
  };
};

const createSafeAccessAudit = (auditService) => async ({ action, actorId, targetId }) => auditService.record({
  action,
  actorId,
  targetType: 'access_entitlement',
  targetId,
});

const createAccessEntitlementsService = ({
  rentalsService = createRentalsService(),
  auditService = createAuditService(),
} = {}) => {
  const recordAudit = createSafeAccessAudit(auditService);

  return {
    async createAccessEntitlement(memberId, titleId, options = {}) {
      const result = await rentalsService.createRental(memberId, titleId, options);
      if (!result.success) return result;

      const entitlement = mapRentalToAccessEntitlement(result.data);
      await recordAudit({ action: 'SNX.access.confirmed', actorId: memberId, targetId: entitlement.entitlementId });
      return { success: true, data: entitlement };
    },

    async getAccessEntitlementByPublicReference(publicReference, memberId) {
      const result = await rentalsService.getRentalByPublicReference(publicReference, memberId);
      if (!result.success) return result;
      return { success: true, data: mapRentalToAccessEntitlement(result.data) };
    },

    async returnAccess(entitlementId, memberId) {
      const result = await rentalsService.returnRental(entitlementId, memberId);
      if (!result.success) return result;

      const entitlement = mapRentalToAccessEntitlement(result.data);
      await recordAudit({ action: 'SNX.access.returned', actorId: memberId, targetId: entitlement.entitlementId });
      return { success: true, data: entitlement };
    },

    async expireAccess(now) {
      const result = await rentalsService.expireRentals(now);
      if (result.success) {
        await recordAudit({ action: 'SNX.access.expired', actorId: null, targetId: 'expired-batch' });
      }
      return result;
    },

    async cancelAccessAsAdmin(entitlementId, adminId) {
      const result = await rentalsService.cancelRentalAsAdmin(entitlementId, adminId);
      if (!result.success) return result;

      const entitlement = mapRentalToAccessEntitlement(result.data);
      await recordAudit({ action: 'SNX.access.cancelled', actorId: adminId, targetId: entitlement.entitlementId });
      return { success: true, data: entitlement };
    },
  };
};

module.exports = {
  ACTIVE_ACCESS_STATE,
  TERMINAL_ACCESS_STATES,
  createAccessEntitlementsService,
  isTerminalAccessState,
  mapRentalToAccessEntitlement,
  normalizeAccessState,
};
