const contentService = require('../services/contentService');
const userService = require('../services/userService');
const rentalService = require('../services/rentalService');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const attachShortlistState = async (userId, contents) => {
  const shortlistResult = await userService.getShortlist(userId);
  const shortlistIds = new Set((shortlistResult.data || []).map(item => item._id.toString()));
  return contents.map(content => ({
    ...content,
    isShortlisted: shortlistIds.has(content._id.toString()),
  }));
};

const browse = catchAsync(async (req, res) => {
  const { type, search, sort = 'title', page = '1' } = req.query;
  const filters = {};
  const pageSize = 12;
  const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);

  if (type && ['movie', 'tv'].includes(type)) {
    filters.type = type;
  }

  let result;
  if (search) {
    result = await contentService.searchContent(search, filters);
  } else {
    result = await contentService.getAvailableContent(filters);
  }

  if (!result.success) {
    return res.status(500).render('streamer/browse', {
      contents: [],
      error: 'Failed to load content',
      type: type || '',
      search: search || '',
    });
  }
  const sortedData = [...(result.data || [])].sort((a, b) => {
    if (sort === 'price_asc') return Number(a.price || 0) - Number(b.price || 0);
    if (sort === 'price_desc') return Number(b.price || 0) - Number(a.price || 0);
    if (sort === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const pageContents = sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const capacityResult = await rentalService.attachCapacityToContents(pageContents);
  const contentsWithCapacity = capacityResult.success ? capacityResult.data : result.data || [];
  const contents = await attachShortlistState(req.session.user.id, contentsWithCapacity);

  res.render('streamer/browse', {
    contents,
    heroItems: sortedData.slice(0, 5),
    type: type || '',
    search: search || '',
    sort,
    pagination: {
      currentPage,
      totalPages,
      totalItems: sortedData.length,
      hasPrevious: currentPage > 1,
      hasNext: currentPage < totalPages,
      previousPage: Math.max(1, currentPage - 1),
      nextPage: Math.min(totalPages, currentPage + 1),
    },
  });
});

const details = catchAsync(async (req, res) => {
  const contentResult = await contentService.getContentById(req.params.id);
  if (!contentResult.success) {
    throw new AppError(contentResult.error || 'Content not found', 404);
  }

  const isShortlisted = await userService.isShortlisted(req.session.user.id, req.params.id);
  const similarResult = await contentService.getSimilarContent(req.params.id);
  const capacityResult = await rentalService.attachCapacityToContent(contentResult.data);
  const similarCapacityResult = await rentalService.attachCapacityToContents(similarResult.data || []);

  res.render('streamer/details', {
    content: capacityResult.success ? capacityResult.data : contentResult.data,
    isShortlisted,
    similar: similarCapacityResult.success ? similarCapacityResult.data : similarResult.data || [],
  });
});

const addToShortlist = catchAsync(async (req, res) => {
  const result = await userService.addToShortlist(req.session.user.id, req.params.id);
  if (!result.success) {
    throw new AppError(result.error || 'Failed to add to shortlist', 400);
  }

  res.redirect(`/streamer/content/${req.params.id}`);
});

const removeFromShortlist = catchAsync(async (req, res) => {
  const result = await userService.removeFromShortlist(req.session.user.id, req.params.id);
  if (!result.success) {
    throw new AppError(result.error || 'Failed to remove from shortlist', 400);
  }

  const returnTo = typeof req.body.returnTo === 'string' && req.body.returnTo.startsWith('/streamer/')
    ? req.body.returnTo
    : '/streamer/shortlist';
  res.redirect(returnTo);
});

const shortlist = catchAsync(async (req, res) => {
  const result = await userService.getShortlist(req.session.user.id);
  if (!result.success) {
    throw new AppError(result.error || 'Failed to load shortlist', 400);
  }

  const capacityResult = await rentalService.attachCapacityToContents(result.data || []);
  res.render('streamer/shortlist', { contents: capacityResult.success ? capacityResult.data : result.data || [] });
});

const rentContent = catchAsync(async (req, res) => {
  const result = await rentalService.createRental(req.session.user.id, req.params.id);
  if (!result.success) {
    return res.status(400).render('error', { message: result.error || 'Failed to rent content' });
  }

  res.redirect('/streamer/rentals?rented=true');
});

const rentals = catchAsync(async (req, res) => {
  const result = await rentalService.getUserRentals(req.session.user.id);
  if (!result.success) {
    return res.status(500).render('streamer/rentals', {
      rentals: [],
      error: 'Failed to load rentals',
    });
  }

  const active = result.data.filter(r => r.status === 'active');
  const completed = result.data.filter(r => ['completed', 'returned', 'expired', 'cancelled'].includes(r.status));

  res.render('streamer/rentals', {
    rentals: result.data || [],
    active,
    completed,
    rented: req.query.rented === 'true',
  });
});

const checkout = catchAsync(async (req, res) => {
  const result = await rentalService.completeRental(req.params.id, req.session.user.id);
  if (!result.success) {
    const statusCode = result.statusCode || 400;
    throw new AppError(result.error || 'Failed to complete checkout', statusCode);
  }

  logger.info(`Checkout completed for rental ${req.params.id}`);
  res.redirect('/streamer/rentals?checkout=success');
});

module.exports = {
  browse,
  details,
  addToShortlist,
  removeFromShortlist,
  shortlist,
  rentContent,
  rentals,
  checkout,
};
