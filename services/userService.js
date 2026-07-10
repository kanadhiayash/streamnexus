const { createMembersService } = require('../src/modules/members/members.service');
const { createSavedTitlesService } = require('../src/modules/saved-titles/savedTitles.service');

const membersService = createMembersService();
const savedTitlesService = createSavedTitlesService();

module.exports = {
  getUserById: (...args) => membersService.getUserById(...args),
  getShortlist: (...args) => savedTitlesService.getShortlist(...args),
  addToShortlist: (...args) => savedTitlesService.addToShortlist(...args),
  removeFromShortlist: (...args) => savedTitlesService.removeFromShortlist(...args),
  isShortlisted: (...args) => savedTitlesService.isShortlisted(...args),
};
