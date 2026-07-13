const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const { restrictTo } = require('../middleware/role');
const {
  accessMutationRateLimiter,
  myListMutationRateLimiter,
  searchRateLimiter,
} = require('../middleware/rateLimit');
const streamerCtrl = require('../controllers/streamerController');

router.use(ensureAuthenticated, restrictTo('streamer'));

router.get('/browse', searchRateLimiter, streamerCtrl.legacyBrowseRedirect);
router.get('/search', searchRateLimiter, streamerCtrl.legacyBrowseRedirect);
router.get('/content/:id/review', streamerCtrl.legacyReviewRedirect);
router.get('/content/:id', streamerCtrl.legacyContentRedirect);
router.post('/content/:id/shortlist', myListMutationRateLimiter, streamerCtrl.addToShortlist);
router.post('/content/:id/shortlist/remove', myListMutationRateLimiter, streamerCtrl.removeFromShortlist);
router.get('/shortlist', streamerCtrl.legacyShortlistRedirect);
router.post('/content/:id/rent', accessMutationRateLimiter, streamerCtrl.rentContent);
router.get('/rentals', streamerCtrl.legacyRentalsRedirect);
router.get('/rentals/ref/:publicReference', streamerCtrl.legacyRentalDetailRedirect);
router.post('/rentals/:id/checkout', accessMutationRateLimiter, streamerCtrl.checkout);

module.exports = router;
