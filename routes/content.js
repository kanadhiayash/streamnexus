const express = require('express');
const router = express.Router();
const contentCtrl = require('../controllers/contentController');

router.get('/:id', contentCtrl.contentById);

module.exports = router;
