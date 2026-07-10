const { AppError } = require('./errorHandler');

module.exports = {
  restrictTo: function (role) {
    return (req, res, next) => {
      const actualRole = req.session.user?.role;
      const allowedRoles = role === 'streamer' ? ['streamer', 'member'] : [role];
      if (!actualRole || !allowedRoles.includes(actualRole)) {
        return next(new AppError('Forbidden: Insufficient permissions', 403));
      }
      next();
    };
  },
};
