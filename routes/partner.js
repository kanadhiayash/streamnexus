const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const { restrictTo } = require('../middleware/role');
const { adminMutationRateLimiter } = require('../middleware/rateLimit');
const partnerCtrl = require('../controllers/partnerController');

router.use(ensureAuthenticated, restrictTo('partner'));

router.get('/dashboard', partnerCtrl.dashboard);
router.post('/programs/:id/status', adminMutationRateLimiter, partnerCtrl.updateProgramStatus);

module.exports = router;
