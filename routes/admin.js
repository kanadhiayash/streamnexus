const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const { restrictTo } = require('../middleware/role');
const adminCtrl = require('../controllers/adminController');

router.use(ensureAuthenticated, restrictTo('admin'));

router.get('/dashboard', adminCtrl.dashboard);
router.get('/content', adminCtrl.contentList);
router.get('/content/new', adminCtrl.showNewContent);
router.post('/content', adminCtrl.createContent);
router.get('/content/:id/edit', adminCtrl.showEditContent);
router.put('/content/:id', adminCtrl.updateContent);
router.post('/content/:id/lifecycle/:action', adminCtrl.updateLifecycle);
router.delete('/content/:id', adminCtrl.deleteContent);

module.exports = router;
