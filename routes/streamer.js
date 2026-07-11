const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const { restrictTo } = require('../middleware/role');
const streamerCtrl = require('../controllers/streamerController');

router.use(ensureAuthenticated, restrictTo('streamer'));

router.get('/browse', streamerCtrl.browse);
router.get('/search', streamerCtrl.browse);
router.get('/content/:id', streamerCtrl.details);
router.get('/content/:id/review', streamerCtrl.reviewRental);
router.post('/content/:id/shortlist', streamerCtrl.addToShortlist);
router.post('/content/:id/shortlist/remove', streamerCtrl.removeFromShortlist);
router.get('/shortlist', streamerCtrl.shortlist);
router.post('/content/:id/rent', streamerCtrl.rentContent);
router.get('/rentals', streamerCtrl.rentals);
router.get('/rentals/ref/:publicReference', streamerCtrl.rentalDetail);
router.post('/rentals/:id/checkout', streamerCtrl.checkout);

module.exports = router;
