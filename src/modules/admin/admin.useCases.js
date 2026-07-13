const contentService = require('../../../services/contentService');
const rentalService = require('../../../services/rentalService');
const { createAuditService } = require('../audit/audit.service');
const { RENTAL_POLICY } = require('../../config/rentalPolicy');
const { NotFoundError, ValidationError, toServiceResult } = require('../../shared/errors/domainErrors');
const { assertObjectId } = require('../../shared/validation/objectId');
const { createAdminRepository } = require('./admin.repository');

const createAdminUseCases = ({
  catalog = contentService,
  rentals = rentalService,
  repository = createAdminRepository(),
  auditService = createAuditService(),
  clock = () => new Date(),
} = {}) => ({
  async loadDashboard() {
    const contentResult = await catalog.getAllContent();
    const rentalsResult = await rentals.getAllRentals();
    const statsResult = await rentals.getRentalStats();
    const members = await repository.findMembers();
    const partners = await repository.findPartners();
    const programs = await repository.findPrograms();
    const auditEvents = await repository.findAuditEvents();

    if (!contentResult.success || !rentalsResult.success) {
      return {
        success: false,
        error: 'Failed to load dashboard',
        data: {
          contents: [],
          rentals: [],
          stats: { totalRentals: 0, activeRentals: 0, completedRentals: 0 },
        },
      };
    }

    const capacityResult = await rentals.attachCapacityToContents(contentResult.data || []);
    const contents = capacityResult.success ? capacityResult.data : contentResult.data || [];
    const now = clock();
    const capacityStats = contents.reduce((totals, item) => {
      const capacity = item.capacity || {
        rentalLimit: item.rentalLimit || RENTAL_POLICY.defaultTitleLicenceLimit,
        activeRentals: 0,
        remaining: item.rentalLimit || RENTAL_POLICY.defaultTitleLicenceLimit,
      };
      totals.totalSlots += capacity.rentalLimit;
      totals.activeSlots += capacity.activeRentals;
      totals.remainingSlots += capacity.remaining;
      return totals;
    }, { totalSlots: 0, activeSlots: 0, remainingSlots: 0 });
    const alerts = buildOperationalAlerts({ contents, members, rentals: rentalsResult.data || [], now });

    return {
      success: true,
      data: {
        contents,
        rentals: rentalsResult.data || [],
        stats: { ...(statsResult.data || {}), ...capacityStats },
        operations: {
          alerts,
          members,
          partners,
          programs,
          auditEvents,
        },
      },
    };
  },

  async loadContentList() {
    return catalog.getAllContent();
  },

  suspendMember(actor, userId) {
    return updateMemberStatus({ actor, userId, status: 'suspended', repository, auditService });
  },

  restoreMember(actor, userId) {
    return updateMemberStatus({ actor, userId, status: 'active', repository, auditService });
  },

  cancelAccess(actor, rentalId) {
    return toServiceResult(async () => {
      assertObjectId(rentalId, 'access ID');
      const result = await rentals.cancelRentalAsAdmin(rentalId, actor.userId);
      if (!result.success) {
        throw new NotFoundError(result.error || 'Access record not found');
      }
      return result.data;
    });
  },

  reconcileCapacity(actor) {
    return toServiceResult(async () => {
      const result = await rentals.reconcileLicenceCounts();
      if (!result.success) {
        throw new ValidationError(result.error || 'Reconciliation failed');
      }
      await auditService.record({
        action: 'SNX.system.reconciled',
        actorId: actor.userId,
        actorRole: actor.role,
        targetType: 'system',
        metadata: result.data,
      });
      return result.data;
    });
  },
});

const buildOperationalAlerts = ({ contents = [], members = [], rentals = [], now = new Date() }) => {
  const alerts = [];
  contents.forEach((content) => {
    const capacity = content.capacity || {};
    const title = content.title || 'Untitled title';
    if (capacity.isFull) {
      alerts.push({ kind: 'capacity', level: 'warning', label: 'Capacity full', message: `${title} has no simulated access seats open.`, href: '/admin/dashboard#access-activity' });
    }
    if (content.activeLicenceCount !== undefined && capacity.activeRentals !== undefined && content.activeLicenceCount !== capacity.activeRentals) {
      alerts.push({ kind: 'reconciliation', level: 'warning', label: 'Capacity drift', message: `${title} needs licence reconciliation.`, href: '/admin/dashboard#system-health' });
    }
    if (content.lifecycle && content.lifecycle !== 'published') {
      alerts.push({ kind: 'publication', level: 'info', label: 'Unpublished content', message: `${title} is ${content.lifecycle}.`, href: '/admin/content' });
    }
    const closesAt = content.releaseWindow?.closesAt ? new Date(content.releaseWindow.closesAt) : null;
    if (closesAt && closesAt < now) {
      alerts.push({ kind: 'release-window', level: 'info', label: 'Expired window', message: `${title} has a closed release window.`, href: '/admin/dashboard#system-health' });
    }
  });
  members.filter(member => member.status === 'suspended').forEach(member => {
    alerts.push({ kind: 'member', level: 'warning', label: 'Suspended member', message: `${member.displayName || 'Member'} is suspended.`, href: '/admin/dashboard#members' });
  });
  rentals.filter(rental => rental.status === 'active' && rental.expiresAt && new Date(rental.expiresAt) < now).forEach(rental => {
    alerts.push({ kind: 'access', level: 'warning', label: 'Expired active access', message: `${rental.publicReference || 'Access record'} should be expired.`, href: '/admin/dashboard#access-activity' });
  });
  return alerts.slice(0, 24);
};

const updateMemberStatus = ({ actor, userId, status, repository, auditService }) => toServiceResult(async () => {
  assertObjectId(userId, 'member ID');
  const member = await repository.updateMemberStatus({ userId, status });
  if (!member) {
    throw new NotFoundError('Member not found');
  }
  await auditService.record({
    action: status === 'suspended' ? 'SNX.member.suspended' : 'SNX.member.restored',
    actorId: actor.userId,
    actorRole: actor.role,
    targetType: 'user',
    targetId: member._id,
  });
  return member;
});

module.exports = { buildOperationalAlerts, createAdminUseCases };
