const logger = require('../../../utils/logger');

const ALLOWED_ACTIONS = new Set([
  'auth.registered',
  'auth.login_succeeded',
  'catalog.created',
  'catalog.updated',
  'catalog.deleted',
  'saved_titles.added',
  'saved_titles.removed',
  'rentals.created',
  'rentals.completed',
  'SNX.access.confirmed',
  'SNX.access.returned',
  'SNX.access.expired',
  'SNX.access.cancelled',
  'SNX.partner.collection-created',
  'SNX.program.created',
  'SNX.program.updated',
]);

const createAuditService = ({ logger: injectedLogger = logger } = {}) => ({
  async record(event = {}) {
    if (!ALLOWED_ACTIONS.has(event.action)) {
      return { success: false, error: 'Unsupported audit action', statusCode: 400 };
    }

    injectedLogger.info(`Audit event: ${event.action}`);
    return { success: true, data: { ...event, recorded: true } };
  },
});

module.exports = { createAuditService };
