const { AppError } = require('./errorHandler');

module.exports = {
  restrictTo: function (role) {
    return (req, res, next) => {
      if (!req.session.user || req.session.user.role !== role) {
        return next(new AppError('Forbidden: Insufficient permissions', 403));
      }
      next();
    };
  },
};
