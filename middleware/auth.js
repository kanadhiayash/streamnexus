module.exports = {
  ensureAuthenticated: (req, res, next) => {
    if (req.session && req.session.user) {
      return next();
    }
    return res.redirect('/login');
  },
  ensureGuest: (req, res, next) => {
    if (req.session && req.session.user) {
      return res.redirect('/');
    }
    next();
  },
};
