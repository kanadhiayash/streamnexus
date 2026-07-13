const MEMBER_COMPATIBLE_ROLES = new Set(['member', 'streamer']);

const getRoleDestination = (role, options = {}) => {
  if (role === 'admin') {
    return '/admin/dashboard';
  }

  if (role === 'partner') {
    return '/partner/dashboard';
  }

  if (MEMBER_COMPATIBLE_ROLES.has(role)) {
    return options.signedUp ? '/home?signedup=true' : '/home';
  }

  return '/';
};

module.exports = { MEMBER_COMPATIBLE_ROLES, getRoleDestination };
