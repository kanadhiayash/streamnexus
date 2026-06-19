const contentService = require('../services/contentService');
const rentalService = require('../services/rentalService');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { validateContentData } = require('../utils/validators');
const logger = require('../utils/logger');

const dashboard = catchAsync(async (req, res) => {
  const contentResult = await contentService.getAllContent();
  const rentalsResult = await rentalService.getAllRentals();
  const statsResult = await rentalService.getRentalStats();

  if (!contentResult.success || !rentalsResult.success) {
    return res.status(500).render('admin/dashboard', {
      contents: [],
      rentals: [],
      stats: { totalRentals: 0, activeRentals: 0, completedRentals: 0 },
      error: 'Failed to load dashboard',
    });
  }
  const capacityResult = await rentalService.attachCapacityToContents(contentResult.data || []);
  const contents = capacityResult.success ? capacityResult.data : contentResult.data || [];
  const capacityStats = contents.reduce((totals, item) => {
    const capacity = item.capacity || { rentalLimit: item.rentalLimit || 5, activeRentals: 0, remaining: item.rentalLimit || 5 };
    totals.totalSlots += capacity.rentalLimit;
    totals.activeSlots += capacity.activeRentals;
    totals.remainingSlots += capacity.remaining;
    return totals;
  }, { totalSlots: 0, activeSlots: 0, remainingSlots: 0 });

  res.render('admin/dashboard', {
    contents,
    rentals: rentalsResult.data || [],
    stats: { ...(statsResult.data || {}), ...capacityStats },
  });
});

const contentList = catchAsync(async (req, res) => {
  const result = await contentService.getAllContent();

  if (!result.success) {
    return res.status(500).render('admin/content-list', {
      contents: [],
      error: 'Failed to load content list',
    });
  }

  res.render('admin/content-list', { contents: result.data || [] });
});

const showNewContent = (req, res) => {
  res.render('admin/content-form', { content: null, action: '/admin/content', method: 'post' });
};

const createContent = catchAsync(async (req, res) => {
  const validation = validateContentData(req.body);
  if (!validation.valid) {
    return res.status(400).render('admin/content-form', {
      content: req.body,
      action: '/admin/content',
      method: 'post',
      errors: validation.errors,
    });
  }

  const result = await contentService.createContent(req.body);
  if (!result.success) {
    return res.status(400).render('admin/content-form', {
      content: req.body,
      action: '/admin/content',
      method: 'post',
      message: result.error,
    });
  }

  logger.info(`Content created by admin: ${result.data._id}`);
  res.redirect('/admin/dashboard?created=true');
});

const showEditContent = catchAsync(async (req, res) => {
  const result = await contentService.getContentById(req.params.id);

  if (!result.success) {
    throw new AppError(result.error || 'Content not found', 404);
  }

  const content = result.data.toObject ? result.data.toObject() : result.data;

  res.render('admin/content-form', {
    content: content,
    action: `/admin/content/${content._id}?_method=PUT`,
    method: 'post',
  });
});

const updateContent = catchAsync(async (req, res) => {
  const validation = validateContentData(req.body);
  if (!validation.valid) {
    return res.status(400).render('admin/content-form', {
      content: { ...req.body, _id: req.params.id },
      action: `/admin/content/${req.params.id}?_method=PUT`,
      method: 'post',
      errors: validation.errors,
    });
  }

  const result = await contentService.updateContent(req.params.id, req.body);
  if (!result.success) {
    const statusCode = result.statusCode || 400;
    throw new AppError(result.error || 'Failed to update content', statusCode);
  }

  logger.info(`Content updated by admin: ${req.params.id}`);
  res.redirect('/admin/dashboard?updated=true');
});

const deleteContent = catchAsync(async (req, res) => {
  const result = await contentService.deleteContent(req.params.id);
  if (!result.success) {
    const statusCode = result.statusCode || 400;
    throw new AppError(result.error || 'Failed to delete content', statusCode);
  }

  logger.info(`Content deleted by admin: ${req.params.id}`);
  res.redirect('/admin/dashboard?deleted=true');
});

module.exports = {
  dashboard,
  contentList,
  showNewContent,
  createContent,
  showEditContent,
  updateContent,
  deleteContent,
};
