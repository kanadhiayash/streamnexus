const { catchAsync, AppError } = require('../middleware/errorHandler');
const { createPartnerDomainService } = require('../src/modules/partners/partnerDomain.service');

const partnerService = createPartnerDomainService();
const actorFromSession = (req) => ({
  userId: req.session.user.id,
  role: req.session.user.role,
});

const dashboard = catchAsync(async (req, res) => {
  const result = await partnerService.loadWorkspace(actorFromSession(req));
  if (!result.success) {
    throw new AppError(result.error || 'Failed to load partner dashboard', result.statusCode || 500);
  }
  res.render('partner/dashboard', {
    page: { kind: 'partner-dashboard', title: 'Partner Dashboard' },
    workspace: result.data,
  });
});

const updateProgramStatus = catchAsync(async (req, res) => {
  if (req.body.confirmation !== 'UPDATE') {
    throw new AppError('Confirmation is required to update program status', 400);
  }
  const result = await partnerService.updateProgramStatus(actorFromSession(req), req.params.id, req.body.status);
  if (!result.success) {
    throw new AppError(result.error || 'Failed to update program status', result.statusCode || 400);
  }
  res.redirect('/partner/dashboard?program=updated');
});

module.exports = { dashboard, updateProgramStatus };
