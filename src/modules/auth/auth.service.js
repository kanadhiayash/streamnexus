const bcrypt = require('bcryptjs');

const logger = require('../../../utils/logger');
const { validateEmail, validatePassword } = require('../../../utils/validators');
const { ConflictError, ValidationError, NotFoundError } = require('../../shared/errors/domainErrors');
const { createAuditService } = require('../audit/audit.service');
const { createAuthRepository } = require('./auth.repository');

const buildSessionUser = (user) => ({
  id: user._id,
  email: user.email,
  role: user.role,
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
    injectedLogger.info(`Streamer account created: ${normalizedEmail}`);
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
      injectedLogger.warn(`Login attempt with non-existent email: ${normalizedEmail}`);
      throw new NotFoundError('Invalid email or password');
    }

    const matched = await compare(password, user.password);
    if (!matched) {
      injectedLogger.warn(`Failed login attempt for: ${normalizedEmail}`);
      throw new NotFoundError('Invalid email or password');
    }

    injectedLogger.info(`User logged in: ${normalizedEmail} (${user.role})`);
    await auditService.record({ action: 'auth.login_succeeded', actorId: user._id, targetType: 'user', targetId: user._id });

    return {
      user,
      sessionUser: buildSessionUser(user),
      redirectTo: user.role === 'admin' ? '/admin/dashboard' : '/streamer/browse',
    };
  },
});

module.exports = { createAuthService, buildSessionUser };
