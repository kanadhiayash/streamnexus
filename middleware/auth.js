const User = require('../models/User');

module.exports = {
  ensureAuthenticated: async (req, res, next) => {
    try {
      if (!req.session?.user) {
        return res.redirect('/login');
      }

      const user = await User.findById(req.session.user.id).select('status sessionVersion role email').lean();
      if (!user || user.status !== 'active' || user.sessionVersion !== req.session.user.sessionVersion) {
        return req.session.destroy(() => res.redirect('/login'));
      }

      req.session.user.role = user.role;
      return next();
    } catch (error) {
      return next(error);
    }
  },
  ensureGuest: (req, res, next) => {
    if (req.session && req.session.user) {
      return res.redirect('/');
    }
    next();
  },
};
