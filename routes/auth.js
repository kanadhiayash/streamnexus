const express = require('express');
const router = express.Router();
const { showLogin, showSignup, signup, login, logout } = require('../controllers/authController');
const { ensureGuest, ensureAuthenticated } = require('../middleware/auth');
const { authPageRateLimiter, loginRateLimiter, signupRateLimiter } = require('../middleware/rateLimit');

router.get('/login', authPageRateLimiter, ensureGuest, showLogin);
router.post('/login', loginRateLimiter, ensureGuest, login);
router.get('/signup', authPageRateLimiter, ensureGuest, showSignup);
router.post('/signup', signupRateLimiter, ensureGuest, signup);
router.post('/logout', ensureAuthenticated, logout);

module.exports = router;
