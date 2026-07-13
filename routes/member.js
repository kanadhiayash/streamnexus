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

const memberGuards = [ensureAuthenticated, restrictTo('streamer')];

router.get('/home', memberGuards, searchRateLimiter, streamerCtrl.browse);
router.get('/my-list', memberGuards, streamerCtrl.shortlist);
router.get('/my-access', memberGuards, streamerCtrl.rentals);
router.get('/my-access/ref/:publicReference', memberGuards, streamerCtrl.rentalDetail);
router.post('/my-access/:id/checkout', memberGuards, accessMutationRateLimiter, streamerCtrl.checkout);
router.get('/account', memberGuards, streamerCtrl.account);

router.get('/titles/:id/review', memberGuards, streamerCtrl.reviewRental);
router.post('/titles/:id/rent', memberGuards, accessMutationRateLimiter, streamerCtrl.rentContent);
router.post('/titles/:id/shortlist', memberGuards, myListMutationRateLimiter, streamerCtrl.addToShortlist);
router.post('/titles/:id/shortlist/remove', memberGuards, myListMutationRateLimiter, streamerCtrl.removeFromShortlist);

module.exports = router;
