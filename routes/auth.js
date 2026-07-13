const express = require('express');
const router = express.Router();
const { showLogin, showSignup, signup, login, logout } = require('../controllers/authController');
const { ensureGuest, ensureAuthenticated } = require('../middleware/auth');
const { loginRateLimiter, signupRateLimiter } = require('../middleware/rateLimit');

router.get('/login', ensureGuest, showLogin);
router.post('/login', loginRateLimiter, ensureGuest, login);
router.get('/signup', ensureGuest, showSignup);
router.post('/signup', signupRateLimiter, ensureGuest, signup);
router.post('/logout', ensureAuthenticated, logout);

module.exports = router;
