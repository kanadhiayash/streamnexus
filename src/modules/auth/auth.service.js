const bcrypt = require('bcryptjs');

const logger = require('../../../utils/logger');
const { validateEmail, validatePassword } = require('../../../utils/validators');
const { ConflictError, ValidationError, NotFoundError, ForbiddenError } = require('../../shared/errors/domainErrors');
const { createAuditService } = require('../audit/audit.service');
const { createAuthRepository } = require('./auth.repository');

const buildSessionUser = (user) => ({
  id: user._id,
  email: user.email,
  role: user.role,
  sessionVersion: user.sessionVersion || 1,
});

const createAuthService = ({
  repository = createAuthRepository(),
  auditService = createAuditService(),
  hash = bcrypt.hash,
  compare = bcrypt.compare,
  logger: injectedLogger = logger,
} = {}) => ({
  async registerMember({ email, password, confirmPassword }) {
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password?.trim() || !confirmPassword?.trim()) {
      throw new ValidationError('Email, password, and confirmation are required');
    }

    if (!validateEmail(normalizedEmail)) {
      throw new ValidationError('Invalid email format');
    }

    if (!validatePassword(password)) {
      throw new ValidationError('Password must be at least 3 characters for the local demo');
    }

    if (password !== confirmPassword) {
      throw new ValidationError('Passwords do not match');
    }

    const existingUser = await repository.findExistingAccount(normalizedEmail);
    if (existingUser) {
      throw new ConflictError('An account with that email already exists');
    }

    const passwordHash = await hash(password, 10);
    const user = await repository.createMember({ email: normalizedEmail, passwordHash });
    injectedLogger.info('Member account created');
    await auditService.record({ action: 'auth.registered', actorId: user._id, targetType: 'user', targetId: user._id });

    return {
      user,
      sessionUser: buildSessionUser(user),
      redirectTo: '/streamer/browse?signedup=true',
    };
  },

  async authenticate({ email, password }) {
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password?.trim()) {
      throw new ValidationError('Email and password are required');
    }

    if (!validateEmail(normalizedEmail)) {
      throw new ValidationError('Invalid email format');
    }

    const user = await repository.findByEmail(normalizedEmail);
    if (!user) {
      injectedLogger.warn('Failed login attempt');
      throw new NotFoundError('Invalid email or password');
    }

    if (user.status && user.status !== 'active') {
      injectedLogger.warn('Failed login attempt');
      throw new NotFoundError('Invalid email or password');
    }

    const matched = await compare(password, user.password);
    if (!matched) {
      injectedLogger.warn('Failed login attempt');
      throw new NotFoundError('Invalid email or password');
    }

    await repository.recordLogin(user._id);
    injectedLogger.info(`User logged in with role ${user.role}`);
    await auditService.record({ action: 'auth.login_succeeded', actorId: user._id, targetType: 'user', targetId: user._id });

    return {
      user,
      sessionUser: buildSessionUser(user),
      redirectTo: user.role === 'admin' ? '/admin/dashboard' : '/streamer/browse',
    };
  },

  async changePassword({ user, currentPassword, newPassword, confirmPassword }) {
    if (!user?._id) {
      throw new ForbiddenError('Authentication required');
    }
    if (!currentPassword?.trim() || !newPassword?.trim() || !confirmPassword?.trim()) {
      throw new ValidationError('Current password, new password, and confirmation are required');
    }
    if (!validatePassword(newPassword)) {
      throw new ValidationError('Password must be at least 3 characters for the local demo');
    }
    if (newPassword !== confirmPassword) {
      throw new ValidationError('Passwords do not match');
    }
    const matched = await compare(currentPassword, user.password);
    if (!matched) {
      throw new ForbiddenError('Current password is incorrect');
    }
    const passwordHash = await hash(newPassword, 10);
    await repository.changePassword({ userId: user._id, passwordHash });
    return { changed: true };
  },
});

module.exports = { createAuthService, buildSessionUser };
