const { catchAsync } = require('../middleware/errorHandler');
const { createPageUseCases } = require('../src/modules/pages/page.useCases');

const pageUseCases = createPageUseCases();

const dashboard = catchAsync(async (req, res) => {
  res.render('partner/dashboard', pageUseCases.partnerDashboard({ user: req.session.user }));
});

module.exports = { dashboard };
