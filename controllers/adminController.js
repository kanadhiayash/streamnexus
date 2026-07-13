const contentService = require('../services/contentService');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { requireSafeReturnPath } = require('../middleware/requestGuards');
const { validateContentData } = require('../utils/validators');
const logger = require('../utils/logger');
const { createAdminUseCases } = require('../src/modules/admin/admin.useCases');

const adminUseCases = createAdminUseCases();
const actorFromSession = (req) => ({
  userId: req.session.user.id,
  role: req.session.user.role,
});

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
    access: req.query.access || '',
    member: req.query.member || '',
    reconciled: req.query.reconciled || '',
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

const updateMemberStatus = catchAsync(async (req, res) => {
  const action = req.params.action || (req.path.endsWith('/suspend') ? 'suspend' : 'restore');
  const expectedConfirmation = action === 'suspend' ? 'SUSPEND' : 'RESTORE';
  if (req.body.confirmation !== expectedConfirmation) {
    throw new AppError('Confirmation is required for member status changes', 400);
  }
  const result = action === 'suspend'
    ? await adminUseCases.suspendMember(actorFromSession(req), req.params.id)
    : await adminUseCases.restoreMember(actorFromSession(req), req.params.id);
  if (!result.success) {
    throw new AppError(result.error || 'Failed to update member status', result.statusCode || 400);
  }
  res.redirect(`/admin/dashboard?member=${encodeURIComponent(action)}`);
});

const cancelAccess = catchAsync(async (req, res) => {
  if (req.body.confirmation !== 'CANCEL') {
    throw new AppError('Confirmation is required to cancel access', 400);
  }
  const result = await adminUseCases.cancelAccess(actorFromSession(req), req.params.id);
  if (!result.success) {
    throw new AppError(result.error || 'Failed to cancel access', result.statusCode || 400);
  }
  res.redirect('/admin/dashboard?access=cancelled');
});

const reconcileCapacity = catchAsync(async (req, res) => {
  if (req.body.confirmation !== 'RECONCILE') {
    throw new AppError('Confirmation is required to reconcile capacity', 400);
  }
  const result = await adminUseCases.reconcileCapacity(actorFromSession(req));
  if (!result.success) {
    throw new AppError(result.error || 'Failed to reconcile capacity', result.statusCode || 400);
  }
  res.redirect(`/admin/dashboard?reconciled=${encodeURIComponent(result.data.updated || 0)}`);
});

module.exports = {
  cancelAccess,
  dashboard,
  contentList,
  showNewContent,
  createContent,
  showEditContent,
  updateContent,
  deleteContent,
  updateLifecycle,
  reconcileCapacity,
  updateMemberStatus,
};
