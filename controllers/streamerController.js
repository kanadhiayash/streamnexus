const userService = require('../services/userService');
const rentalService = require('../services/rentalService');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { requireSafeReturnPath } = require('../middleware/requestGuards');
const { createPageUseCases } = require('../src/modules/pages/page.useCases');
const logger = require('../utils/logger');

const pageUseCases = createPageUseCases();

const normalizePageError = (error) => new AppError(
  error.publicMessage || error.message || 'Failed to load page',
  error.statusCode || 500
);

const redirectWithQuery = (res, path, query = {}) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, value);
    }
  });
  const queryString = params.toString();
  return res.redirect(queryString ? `${path}?${queryString}` : path);
};

const browse = catchAsync(async (req, res) => {
  try {
    const model = await pageUseCases.memberCatalog({
      user: req.session.user,
      query: req.query,
    });
    res.render('streamer/browse', {
      ...model,
      signedUp: req.query.signedup === 'true',
    });
  } catch (error) {
    throw normalizePageError(error);
  }
});

const legacyBrowseRedirect = catchAsync(async (req, res) => redirectWithQuery(res, '/home', req.query));

const legacyShortlistRedirect = catchAsync(async (req, res) => res.redirect('/my-list'));

const legacyRentalsRedirect = catchAsync(async (req, res) => redirectWithQuery(res, '/my-access', req.query));

const legacyRentalDetailRedirect = catchAsync(async (req, res) => {
  res.redirect(`/my-access/ref/${encodeURIComponent(req.params.publicReference)}`);
});

const legacyReviewRedirect = catchAsync(async (req, res) => {
  res.redirect(`/titles/${encodeURIComponent(req.params.id)}/review`);
});

const legacyContentRedirect = catchAsync(async (req, res) => {
  try {
    res.redirect(await pageUseCases.canonicalTitlePath({ id: req.params.id }));
  } catch (error) {
    throw normalizePageError(error);
  }
});

const details = catchAsync(async (req, res) => {
  try {
    res.render('streamer/details', await pageUseCases.memberTitle({
      id: req.params.id,
      user: req.session.user,
    }));
  } catch (error) {
    throw normalizePageError(error);
  }
});

const reviewRental = catchAsync(async (req, res) => {
  try {
    res.render('streamer/rental-review', await pageUseCases.rentalReview({ id: req.params.id }));
  } catch (error) {
    throw normalizePageError(error);
  }
});

const addToShortlist = catchAsync(async (req, res) => {
  const result = await userService.addToShortlist(req.session.user.id, req.params.id);
  if (!result.success) {
    throw new AppError(result.error || 'Failed to add to shortlist', 400);
  }

  res.redirect(`/titles/${encodeURIComponent(req.params.id)}`);
});

const removeFromShortlist = catchAsync(async (req, res) => {
  const returnTo = requireSafeReturnPath(req.body.returnTo, ['/home', '/my-list', '/titles/', '/streamer/']) || '/my-list';
  const result = await userService.removeFromShortlist(req.session.user.id, req.params.id);
  if (!result.success) {
    throw new AppError(result.error || 'Failed to remove from shortlist', 400);
  }

  res.redirect(returnTo);
});

const shortlist = catchAsync(async (req, res) => {
  try {
    res.render('streamer/shortlist', await pageUseCases.myList({ user: req.session.user }));
  } catch (error) {
    throw normalizePageError(error);
  }
});

const rentContent = catchAsync(async (req, res) => {
  const result = await rentalService.createRental(req.session.user.id, req.params.id, {
    idempotencyKey: req.get('Idempotency-Key') || req.body.idempotencyKey,
  });
  if (!result.success) {
    const model = await pageUseCases.rentalReview({
      id: req.params.id,
      accessError: result,
    });
    return res.status(result.statusCode || 400).render('streamer/rental-review', model);
  }

  res.redirect(`/my-access?rented=true&ref=${encodeURIComponent(result.data.publicReference || '')}`);
});

const rentals = catchAsync(async (req, res) => {
  try {
    res.render('streamer/rentals', await pageUseCases.myAccess({
      user: req.session.user,
      query: req.query,
    }));
  } catch (error) {
    throw normalizePageError(error);
  }
});

const rentalDetail = catchAsync(async (req, res) => {
  try {
    res.render('streamer/rental-detail', await pageUseCases.accessDetail({
      publicReference: req.params.publicReference,
      user: req.session.user,
    }));
  } catch (error) {
    throw normalizePageError(error);
  }
});

const checkout = catchAsync(async (req, res) => {
  const result = await rentalService.completeRental(req.params.id, req.session.user.id);
  if (!result.success) {
    const statusCode = result.statusCode || 400;
    throw new AppError(result.error || 'Failed to complete checkout', statusCode);
  }

  logger.info(`Access returned for rental ${req.params.id}`);
  res.redirect('/my-access?returned=true');
});

const account = catchAsync(async (req, res) => {
  res.render('streamer/account', pageUseCases.account({ user: req.session.user }));
});

module.exports = {
  account,
  browse,
  details,
  reviewRental,
  addToShortlist,
  removeFromShortlist,
  shortlist,
  rentContent,
  rentals,
  rentalDetail,
  checkout,
  legacyBrowseRedirect,
  legacyContentRedirect,
  legacyRentalDetailRedirect,
  legacyRentalsRedirect,
  legacyReviewRedirect,
  legacyShortlistRedirect,
};
