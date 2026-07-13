const express = require('express');
const router = express.Router();
const publicCtrl = require('../controllers/publicController');

router.get('/catalog', publicCtrl.renderCatalog);
router.get('/access', publicCtrl.renderAccessExplanation);
router.get('/titles/:slugOrId', publicCtrl.renderTitle);
router.get('/programs/:slug', publicCtrl.renderProgram);
router.get('/collections/:slug', publicCtrl.renderCollection);

module.exports = router;
