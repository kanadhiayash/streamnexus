const { catchAsync } = require('../middleware/errorHandler');

const dashboard = catchAsync(async (req, res) => {
  res.render('partner/dashboard', {
    partnerUser: req.session.user,
  });
});

module.exports = { dashboard };
