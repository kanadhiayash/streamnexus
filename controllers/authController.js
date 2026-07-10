const { catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { seedDatabase } = require('../src/demo/demoSeed');
const { createAuthService } = require('../src/modules/auth/auth.service');

const authService = createAuthService();

const renderSignupError = (res, error, form) => res.status(error.statusCode || 400).render('signup', {
  message: null,
  error: error.message,
  form,
});

const renderLoginError = (res, error) => res.status(error.statusCode === 404 ? 401 : error.statusCode || 400).render('login', {
  message: null,
  error: error.statusCode === 404 ? 'Invalid email or password' : error.message,
});

const showLogin = (req, res) => {
  res.render('login', { message: null, error: null });
};

const showSignup = (req, res) => {
  res.render('signup', { message: null, error: null, form: {} });
};

const signup = catchAsync(async (req, res) => {
  const form = { email: req.body.email?.trim().toLowerCase() || '' };

  try {
    const result = await authService.registerMember(req.body);
    req.session.user = result.sessionUser;
    return res.redirect(result.redirectTo);
  } catch (error) {
    return renderSignupError(res, error, form);
  }
});

const login = catchAsync(async (req, res) => {
  try {
    const result = await authService.authenticate(req.body);
    req.session.user = result.sessionUser;
    return res.redirect(result.redirectTo);
  } catch (error) {
    return renderLoginError(res, error);
  }
});

const logout = catchAsync(async (req, res) => {
  const userEmail = req.session.user?.email;
  req.session.destroy((err) => {
    if (err) {
      logger.error('Error destroying session:', err);
      return res.status(500).render('error', { message: 'Failed to logout' });
    }
    logger.info(`User logged out: ${userEmail}`);
    res.redirect('/login');
  });
});

module.exports = { seedDatabase, showLogin, showSignup, signup, login, logout };
