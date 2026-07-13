const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const { restrictTo } = require('../middleware/role');
const { adminMutationRateLimiter } = require('../middleware/rateLimit');
const adminCtrl = require('../controllers/adminController');

router.use(ensureAuthenticated, restrictTo('admin'));

router.get('/dashboard', adminCtrl.dashboard);
router.get('/content', adminCtrl.contentList);
router.get('/content/new', adminCtrl.showNewContent);
router.post('/content', adminMutationRateLimiter, adminCtrl.createContent);
router.get('/content/:id/edit', adminCtrl.showEditContent);
router.put('/content/:id', adminMutationRateLimiter, adminCtrl.updateContent);
router.post('/content/:id/lifecycle/:action', adminMutationRateLimiter, adminCtrl.updateLifecycle);
router.delete('/content/:id', adminMutationRateLimiter, adminCtrl.deleteContent);

module.exports = router;
