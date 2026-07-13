const { catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { rotateCsrfToken } = require('../middleware/csrf');
const { resolveSafeReturnPath } = require('../middleware/requestGuards');
const { seedDatabase } = require('../src/demo/demoSeed');
const { createAuthService } = require('../src/modules/auth/auth.service');

const authService = createAuthService();

const AUTH_DEMO_PERSONAS = [
  {
    key: 'member',
    label: 'Demo Member',
    description: 'Opens the member catalog and simulated access workspace.',
    email: process.env.DEMO_STREAMER_EMAIL || 'streamer@gmail.com',
    password: process.env.DEMO_STREAMER_PASSWORD || 'streamer',
  },
  {
    key: 'admin',
    label: 'Demo Admin',
    description: 'Opens catalog, fixture, and operations controls.',
    email: process.env.DEMO_ADMIN_EMAIL || 'admin@gmail.com',
    password: process.env.DEMO_ADMIN_PASSWORD || 'admin',
  },
];

const AUTH_ALLOWED_RETURN_PREFIXES = {
  admin: ['/admin/'],
  member: ['/home', '/my-list', '/my-access', '/titles/', '/catalog', '/access', '/programs/', '/collections/'],
  streamer: ['/home', '/my-list', '/my-access', '/titles/', '/catalog', '/access', '/programs/', '/collections/'],
  partner: ['/partner/'],
};

const createAuthViewModel = ({ message = null, error = null, form = {}, returnTo = '' } = {}) => ({
  message,
  error,
  form,
  returnTo,
  demoPersonas: AUTH_DEMO_PERSONAS,
});

const getRequestedReturnTo = (value) => resolveSafeReturnPath(value, [
  '/admin/',
  '/home',
  '/my-list',
  '/my-access',
  '/titles/',
  '/catalog',
  '/access',
  '/programs/',
  '/collections/',
  '/partner/',
]);

const getRoleSafeReturnTo = (value, role) => resolveSafeReturnPath(value, AUTH_ALLOWED_RETURN_PREFIXES[role] || []);

const renderSignupError = (res, error, form) => res.status(error.statusCode || 400).render('signup', {
  ...createAuthViewModel({ error: error.message, form }),
});

const renderLoginError = (res, error, form = {}) => res.status(error.statusCode === 404 ? 401 : error.statusCode || 400).render('login', {
  ...createAuthViewModel({
    error: error.statusCode === 404 ? 'Invalid email or password' : error.message,
    form,
    returnTo: form.returnTo || '',
  }),
});

const regenerateSession = (req) => new Promise((resolve, reject) => {
  req.session.regenerate((error) => (error ? reject(error) : resolve()));
});

const saveSession = (req) => new Promise((resolve, reject) => {
  req.session.save((error) => (error ? reject(error) : resolve()));
});

const establishSession = async (req, sessionUser) => {
  await regenerateSession(req);
  req.session.user = sessionUser;
  rotateCsrfToken(req);
  await saveSession(req);
};

const showLogin = (req, res) => {
  res.render('login', createAuthViewModel({
    returnTo: getRequestedReturnTo(req.query.returnTo) || '',
  }));
};

const showSignup = (req, res) => {
  res.render('signup', createAuthViewModel());
};

const signup = catchAsync(async (req, res) => {
  const form = { email: req.body.email?.trim().toLowerCase() || '' };

  try {
    const result = await authService.registerMember(req.body);
    await establishSession(req, result.sessionUser);
    return res.redirect(result.redirectTo);
  } catch (error) {
    return renderSignupError(res, error, form);
  }
});

const login = catchAsync(async (req, res) => {
  const form = {
    email: req.body.email?.trim().toLowerCase() || '',
    returnTo: getRequestedReturnTo(req.body.returnTo) || '',
  };

  try {
    const result = await authService.authenticate(req.body);
    await establishSession(req, result.sessionUser);
    return res.redirect(getRoleSafeReturnTo(form.returnTo, result.sessionUser.role) || result.redirectTo);
  } catch (error) {
    return renderLoginError(res, error, form);
  }
});

const logout = catchAsync(async (req, res) => {
  const hadUser = Boolean(req.session.user);
  req.session.destroy((err) => {
    if (err) {
      logger.error('Error destroying session:', err);
      return res.status(500).render('error', { message: 'Failed to logout' });
    }
    res.clearCookie('streamnexus.sid');
    logger.info(`User logged out: ${hadUser}`);
    res.redirect('/login');
  });
});

module.exports = { seedDatabase, showLogin, showSignup, signup, login, logout };
