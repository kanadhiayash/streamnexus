const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const { restrictTo } = require('../middleware/role');
const partnerCtrl = require('../controllers/partnerController');

router.use(ensureAuthenticated, restrictTo('partner'));

router.get('/dashboard', partnerCtrl.dashboard);

module.exports = router;
