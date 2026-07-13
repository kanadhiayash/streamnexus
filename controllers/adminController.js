const contentService = require('../services/contentService');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { requireSafeReturnPath } = require('../middleware/requestGuards');
const { validateContentData } = require('../utils/validators');
const logger = require('../utils/logger');
const { createAdminUseCases } = require('../src/modules/admin/admin.useCases');

const adminUseCases = createAdminUseCases();

const dashboard = catchAsync(async (req, res) => {
  const result = await adminUseCases.loadDashboard();

  if (!result.success) {
    return res.status(500).render('admin/dashboard', {
      ...result.data,
      error: 'Failed to load dashboard',
    });
  }

  res.render('admin/dashboard', {
    ...result.data,
    archived: req.query.archived === 'true',
  });
});

const contentList = catchAsync(async (req, res) => {
  const result = await adminUseCases.loadContentList();

  if (!result.success) {
    return res.status(500).render('admin/content-list', {
      contents: [],
      error: 'Failed to load content list',
    });
  }

  res.render('admin/content-list', { contents: result.data || [], lifecycle: req.query.lifecycle || '' });
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
    throw new AppError(result.error || 'Failed to archive content', statusCode);
  }

  logger.info(`Content archived by admin: ${req.params.id}`);
  res.redirect('/admin/dashboard?archived=true');
});

const updateLifecycle = catchAsync(async (req, res) => {
  const returnTo = requireSafeReturnPath(req.body.returnTo, ['/admin/']) || '/admin/content';
  const result = await contentService.updateLifecycle(req.params.id, req.params.action);
  if (!result.success) {
    const statusCode = result.statusCode || 400;
    throw new AppError(result.error || 'Failed to update content lifecycle', statusCode);
  }

  logger.info(`Content lifecycle ${req.params.action} by admin: ${req.params.id}`);
  res.redirect(`${returnTo}?lifecycle=${encodeURIComponent(req.params.action)}`);
});

module.exports = {
  dashboard,
  contentList,
  showNewContent,
  createContent,
  showEditContent,
  updateContent,
  deleteContent,
  updateLifecycle,
};
