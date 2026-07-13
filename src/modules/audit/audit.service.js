const logger = require('../../../utils/logger');
const AuditEvent = require('../../../models/AuditEvent');

const ALLOWED_ACTIONS = new Set([
  'auth.registered',
  'auth.login_succeeded',
  'catalog.created',
  'catalog.updated',
  'catalog.deleted',
  'catalog.publish',
  'catalog.unpublish',
  'catalog.archive',
  'catalog.restore',
  'saved_titles.added',
  'saved_titles.removed',
  'rentals.created',
  'rentals.completed',
  'SNX.access.confirmed',
  'SNX.access.returned',
  'SNX.access.expired',
  'SNX.access.cancelled',
  'SNX.member.suspended',
  'SNX.member.restored',
  'SNX.partner.collection-created',
  'SNX.program.created',
  'SNX.program.updated',
  'SNX.system.reconciled',
]);

const SENSITIVE_KEY_PATTERN = /(email|password|token|cookie|session|authorization)/i;

const safeMetadata = (metadata = {}) => Object.fromEntries(
  Object.entries(metadata || {})
    .filter(([key, value]) => !SENSITIVE_KEY_PATTERN.test(key) && typeof value !== 'function')
    .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 240) : value])
);

const createAuditService = ({ logger: injectedLogger = logger, AuditEventModel = AuditEvent } = {}) => ({
  async record(event = {}) {
    if (!ALLOWED_ACTIONS.has(event.action)) {
      return { success: false, error: 'Unsupported audit action', statusCode: 400 };
    }

    injectedLogger.info(`Audit event: ${event.action}`);
    const auditEvent = {
      actorId: event.actorId || null,
      actorRole: event.actorRole || 'system',
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId || null,
      requestId: event.requestId || '',
      metadata: safeMetadata(event.metadata),
    };
    const persisted = await AuditEventModel.create(auditEvent);
    return { success: true, data: persisted.toObject ? persisted.toObject() : persisted };
  },
});

module.exports = { createAuditService, safeMetadata };
