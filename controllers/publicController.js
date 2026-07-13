const contentService = require('../services/contentService');
const rentalService = require('../services/rentalService');
const userService = require('../services/userService');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { MEMBER_COMPATIBLE_ROLES } = require('../src/modules/auth/roleDestinations');

const normalizeSlug = value => String(value || '').trim().toLowerCase();

const matchesSlugOrId = (content, slugOrId) => (
  normalizeSlug(content.slug) === normalizeSlug(slugOrId) ||
  content._id.toString() === String(slugOrId)
);

const loadAvailableContent = async (filters = {}) => {
  const result = await contentService.getAvailableContent(filters);
  if (!result.success) {
    throw new AppError(result.error || 'Failed to load catalog', result.statusCode || 500);
  }
  return result.data || [];
};

const renderCatalog = catchAsync(async (req, res) => {
  const contents = await loadAvailableContent();
  res.render('public/catalog', { contents });
});

const renderTitle = catchAsync(async (req, res) => {
  const contents = await loadAvailableContent();
  const content = contents.find(item => matchesSlugOrId(item, req.params.slugOrId));
  if (!content) {
    throw new AppError('Title not found', 404);
  }

  const capacityResult = await rentalService.attachCapacityToContent(content);
  const similarResult = await contentService.getSimilarContent(content._id);
  const similarCapacityResult = await rentalService.attachCapacityToContents(similarResult.data || []);
  const activeMember = req.session?.user && MEMBER_COMPATIBLE_ROLES.has(req.session.user.role);
  const isShortlisted = activeMember
    ? await userService.isShortlisted(req.session.user.id, content._id)
    : false;

  res.render('streamer/details', {
    content: capacityResult.success ? capacityResult.data : content,
    isShortlisted,
    similar: similarCapacityResult.success ? similarCapacityResult.data : similarResult.data || [],
    canAccessMemberActions: Boolean(activeMember),
  });
});

const renderProgram = catchAsync(async (req, res) => {
  const contents = await loadAvailableContent({ programKey: req.params.slug });
  res.render('public/program', { slug: req.params.slug, contents });
});

const renderCollection = catchAsync(async (req, res) => {
  const contents = await loadAvailableContent({ collectionKeys: req.params.slug });
  res.render('public/collection', { slug: req.params.slug, contents });
});

module.exports = {
  renderCatalog,
  renderCollection,
  renderProgram,
  renderTitle,
};
