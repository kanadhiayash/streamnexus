const contentService = require('../../../services/contentService');
const rentalService = require('../../../services/rentalService');
const userService = require('../../../services/userService');
const { MEMBER_COMPATIBLE_ROLES } = require('../auth/roleDestinations');
const { PageApplicationError, assertServiceSuccess } = require('./page.errors');
const {
  buildAccessPage,
  buildAccountPage,
  buildCatalogPage,
  buildMemberHomePage,
  buildPartnerDashboardPage,
  buildPublicCollectionPage,
  buildPublicDiscoveryPage,
  buildPublicProgramPage,
  buildRentalDetailPage,
  buildShortlistPage,
  buildTitleDetailPage,
  normalizeFilters,
  titlePath,
} = require('./pageViewModels');

const normalizeSlug = value => String(value || '').trim().toLowerCase();

const matchesSlugOrId = (content, slugOrId) => (
  normalizeSlug(content.slug) === normalizeSlug(slugOrId) ||
  content._id.toString() === String(slugOrId)
);

const filtersFromQuery = (query = {}) => {
  const filters = {};
  const normalized = normalizeFilters(query);
  if (normalized.type) {
    filters.type = normalized.type;
  }
  return filters;
};

const loadCatalogContent = async ({ query = {}, services }) => {
  const filters = filtersFromQuery(query);
  const normalized = normalizeFilters(query);
  const result = normalized.search
    ? await services.content.searchContent(normalized.search, filters)
    : await services.content.getAvailableContent(filters);
  return assertServiceSuccess(result, 'Failed to load catalog');
};

const loadAvailableContent = async ({ filters = {}, services }) => (
  assertServiceSuccess(await services.content.getAvailableContent(filters), 'Failed to load catalog')
);

const attachCapacity = async ({ titles, services }) => {
  const result = await services.rentals.attachCapacityToContents(titles || []);
  return result.success ? result.data : titles || [];
};

const createPageUseCases = ({
  services = {
    content: contentService,
    rentals: rentalService,
    user: userService,
  },
} = {}) => ({
  async memberCatalog({ user, query = {} }) {
    const titles = await loadCatalogContent({ query, services });
    const titlesWithCapacity = await attachCapacity({ titles, services });
    const shortlistResult = await services.user.getShortlist(user.id);
    const shortlistTitles = await attachCapacity({ titles: shortlistResult.data || [], services });
    const rentals = assertServiceSuccess(await services.rentals.getUserRentals(user.id), 'Failed to load rentals');
    return buildMemberHomePage({
      titles: titlesWithCapacity,
      query,
      shortlistTitles,
      rentals,
    });
  },

  async publicCatalog({ query = {} } = {}) {
    const titles = await loadCatalogContent({ query, services });
    const titlesWithCapacity = await attachCapacity({ titles, services });
    return buildCatalogPage({ titles: titlesWithCapacity, query, basePath: '/catalog', kind: 'public-catalog' });
  },

  async publicLanding({ user } = {}) {
    const titles = await loadAvailableContent({ services });
    const titlesWithCapacity = await attachCapacity({ titles, services });
    return buildPublicDiscoveryPage({ titles: titlesWithCapacity, user });
  },

  async publicProgram({ slug }) {
    const titles = await loadAvailableContent({ filters: { programKey: slug }, services });
    const titlesWithCapacity = await attachCapacity({ titles, services });
    return buildPublicProgramPage({ slug, titles: titlesWithCapacity });
  },

  async publicCollection({ slug }) {
    const titles = await loadAvailableContent({ filters: { collectionKeys: slug }, services });
    const titlesWithCapacity = await attachCapacity({ titles, services });
    return buildPublicCollectionPage({ slug, titles: titlesWithCapacity });
  },

  publicAccessExplanation() {
    const model = buildPublicDiscoveryPage({ titles: [] });
    return {
      ...model,
      page: {
        ...model.page,
        title: 'How StreamNexus Access Works',
        description: 'Transparent public explanation of StreamNexus fictional access windows, simulated capacity, and prototype limits.',
      },
    };
  },

  async publicTitle({ slugOrId, user }) {
    const contents = await loadAvailableContent({ services });
    const title = contents.find(item => matchesSlugOrId(item, slugOrId));
    if (!title) {
      throw new PageApplicationError('Title not found', 404, 'Title not found');
    }

    const titleWithCapacity = assertServiceSuccess(
      await services.rentals.attachCapacityToContent(title),
      'Failed to load title'
    );
    const similarResult = await services.content.getSimilarContent(title._id);
    const similarWithCapacity = await attachCapacity({ titles: similarResult.data || [], services });
    const activeMember = user && MEMBER_COMPATIBLE_ROLES.has(user.role);
    const isShortlisted = activeMember
      ? await services.user.isShortlisted(user.id, title._id)
      : false;

    return buildTitleDetailPage({
      title: titleWithCapacity,
      similar: similarWithCapacity,
      isShortlisted,
      canAccessMemberActions: Boolean(activeMember),
    });
  },

  async memberTitle({ id, user }) {
    const title = assertServiceSuccess(await services.content.getContentById(id), 'Content not found', 404);
    const titleWithCapacity = assertServiceSuccess(
      await services.rentals.attachCapacityToContent(title),
      'Failed to load title'
    );
    const similarResult = await services.content.getSimilarContent(id);
    const similarWithCapacity = await attachCapacity({ titles: similarResult.data || [], services });
    return buildTitleDetailPage({
      title: titleWithCapacity,
      similar: similarWithCapacity,
      isShortlisted: await services.user.isShortlisted(user.id, id),
      canAccessMemberActions: true,
    });
  },

  async rentalReview({ id }) {
    const title = assertServiceSuccess(await services.content.getContentById(id), 'Content not found', 404);
    const content = assertServiceSuccess(
      await services.rentals.attachCapacityToContent(title),
      'Failed to load title'
    );
    return {
      page: { kind: 'rental-review', title: `Confirm ${content.title}`, emptyState: null },
      content,
      capacity: content.capacity,
    };
  },

  async myList({ user }) {
    const titles = assertServiceSuccess(await services.user.getShortlist(user.id), 'Failed to load shortlist', 400);
    const titlesWithCapacity = await attachCapacity({ titles, services });
    return buildShortlistPage({ titles: titlesWithCapacity });
  },

  async myAccess({ user, query = {} }) {
    const rentals = assertServiceSuccess(await services.rentals.getUserRentals(user.id), 'Failed to load rentals');
    return buildAccessPage({ rentals, query });
  },

  async accessDetail({ publicReference, user }) {
    const rental = assertServiceSuccess(
      await services.rentals.getRentalByPublicReference(publicReference, user.id),
      'Rental not found',
      404
    );
    return buildRentalDetailPage({ rental });
  },

  account({ user }) {
    return buildAccountPage({ user });
  },

  partnerDashboard({ user }) {
    return buildPartnerDashboardPage({ user });
  },

  async canonicalTitlePath({ id }) {
    const title = assertServiceSuccess(await services.content.getContentById(id), 'Content not found', 404);
    const plain = title.toObject ? title.toObject() : title;
    return titlePath(plain);
  },
});

module.exports = {
  createPageUseCases,
  matchesSlugOrId,
};
