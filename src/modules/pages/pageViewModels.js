const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 12;
const DEFAULT_CAPACITY_LIMIT = 20;

const toPlain = value => (value && typeof value.toObject === 'function' ? value.toObject() : value);

const asString = value => String(value || '');

const titleId = title => asString(title?._id);

const titleSlugOrId = title => encodeURIComponent(title?.slug || titleId(title));

const titlePath = title => `/titles/${titleSlugOrId(title)}`;

const reviewPath = title => `/titles/${titleId(title)}/review`;

const shortlistPath = (title, isShortlisted = false) => (
  `/titles/${titleId(title)}/${isShortlisted ? 'shortlist/remove' : 'shortlist'}`
);

const normalizeCapacity = (title = {}) => {
  const source = title.capacity || {};
  const rentalLimit = Number(source.rentalLimit || title.rentalLimit || title.licenceLimit || DEFAULT_CAPACITY_LIMIT);
  const activeRentals = Number(source.activeRentals || title.activeLicenceCount || 0);
  const remaining = Math.max(Number(source.remaining ?? (rentalLimit - activeRentals)), 0);
  return {
    rentalLimit,
    activeRentals,
    remaining,
    isFull: Boolean(source.isFull || remaining <= 0),
  };
};

const buildAccessState = ({ title, isShortlisted = false, canAccessMemberActions = true }) => {
  const capacity = normalizeCapacity(title);
  const available = Boolean(title?.available) && !capacity.isFull;
  let primaryAction = 'sign_in';
  let primaryLabel = 'Sign In';
  let primaryHref = '/login';
  let method = 'get';

  if (canAccessMemberActions) {
    primaryAction = available ? 'activate_access' : 'unavailable';
    primaryLabel = available ? 'Activate Rental' : 'Full or unavailable';
    primaryHref = reviewPath(title);
  }

  return {
    available,
    canAccessMemberActions,
    capacity,
    isShortlisted: Boolean(isShortlisted),
    primaryAction,
    primaryLabel,
    primaryHref,
    method,
    shortlist: canAccessMemberActions
      ? {
          action: isShortlisted ? 'remove' : 'add',
          label: isShortlisted ? 'Remove from My List' : 'Add to My List',
          href: shortlistPath(title, isShortlisted),
          returnTo: titlePath(title),
        }
      : null,
  };
};

const buildTitleCard = (title, options = {}) => {
  const plain = toPlain(title) || {};
  const access = buildAccessState({
    title: plain,
    isShortlisted: options.isShortlisted ?? plain.isShortlisted,
    canAccessMemberActions: options.canAccessMemberActions ?? true,
  });
  return {
    ...plain,
    capacity: access.capacity,
    isShortlisted: access.isShortlisted,
    primaryAction: access.primaryAction,
    primaryLabel: access.primaryLabel,
    detailUrl: titlePath(plain),
    rentUrl: reviewPath(plain),
    shortlistUrl: access.shortlist?.href || null,
    access,
  };
};

const buildTitleDetailPage = ({ title, similar = [], isShortlisted = false, canAccessMemberActions = true }) => {
  const content = buildTitleCard(title, { isShortlisted, canAccessMemberActions });
  return {
    page: {
      kind: 'title-detail',
      title: content.title,
      emptyState: null,
      primaryAction: content.access,
    },
    content,
    isShortlisted: content.isShortlisted,
    similar: similar.map(item => buildTitleCard(item, { canAccessMemberActions })),
    canAccessMemberActions,
  };
};

const normalizeFilters = (query = {}) => {
  const type = ['movie', 'tv'].includes(query.type) ? query.type : '';
  const search = asString(query.search).trim();
  const sort = ['title', 'newest', 'price_asc', 'price_desc'].includes(query.sort) ? query.sort : 'title';
  const currentPage = Math.max(1, Number.parseInt(query.page, 10) || 1);
  return { type, search, sort, currentPage, pageSize: DEFAULT_PAGE_SIZE };
};

const sortTitles = (titles = [], sort = 'title') => [...titles].sort((a, b) => {
  if (sort === 'price_asc') return Number(a.price || 0) - Number(b.price || 0);
  if (sort === 'price_desc') return Number(b.price || 0) - Number(a.price || 0);
  if (sort === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  return asString(a.title).localeCompare(asString(b.title));
});

const buildQueryString = ({ search = '', type = '', sort = 'title', page = 1 } = {}) => {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (type) params.set('type', type);
  if (sort && sort !== 'title') params.set('sort', sort);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `?${query}` : '';
};

const buildPagination = ({ totalItems, currentPage, pageSize, search, type, sort, basePath = '/home' }) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const previousPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);
  return {
    currentPage,
    totalPages,
    totalItems,
    hasPrevious: currentPage > 1,
    hasNext: currentPage < totalPages,
    previousPage,
    nextPage,
    previousHref: `${basePath}${buildQueryString({ search, type, sort, page: previousPage })}`,
    nextHref: `${basePath}${buildQueryString({ search, type, sort, page: nextPage })}`,
  };
};

const emptyStateForCatalog = ({ search = '', type = '' } = {}) => {
  if (search || type) {
    return {
      kind: 'filtered',
      message: 'No matching titles found. Try a different search or filter.',
      actionHref: '/home',
      actionLabel: 'Reset',
    };
  }
  return {
    kind: 'empty',
    message: 'No titles available at the moment. Check back soon.',
    actionHref: null,
    actionLabel: null,
  };
};

const buildCatalogPage = ({ titles = [], query = {}, shortlistIds = new Set(), basePath = '/home', kind = 'member-catalog' }) => {
  const filters = normalizeFilters(query);
  const sorted = sortTitles(titles.map(toPlain), filters.sort);
  const pagination = buildPagination({
    totalItems: sorted.length,
    currentPage: filters.currentPage,
    pageSize: filters.pageSize,
    search: filters.search,
    type: filters.type,
    sort: filters.sort,
    basePath,
  });
  const pageItems = sorted.slice((filters.currentPage - 1) * filters.pageSize, filters.currentPage * filters.pageSize);
  const contents = pageItems.map(title => buildTitleCard(title, {
    isShortlisted: shortlistIds.has(titleId(title)),
    canAccessMemberActions: kind !== 'public-catalog',
  }));
  const heroItems = sorted.slice(0, 5).map(title => buildTitleCard(title, {
    isShortlisted: shortlistIds.has(titleId(title)),
    canAccessMemberActions: kind !== 'public-catalog',
  }));

  return {
    page: {
      kind,
      title: kind === 'public-catalog' ? 'Curated Screenings' : 'Browse Titles',
      filters: {
        type: filters.type,
        search: filters.search,
        sort: filters.sort,
      },
      pagination,
      emptyState: contents.length === 0 ? emptyStateForCatalog(filters) : null,
    },
    contents,
    heroItems,
    type: filters.type,
    search: filters.search,
    sort: filters.sort,
    pagination,
  };
};

const buildShortlistPage = ({ titles = [] }) => ({
  page: {
    kind: 'my-list',
    title: 'My List',
    emptyState: titles.length === 0
      ? { kind: 'empty', message: 'My List is empty. Browse titles and save a few for later.', actionHref: '/home', actionLabel: 'Browse Titles' }
      : null,
  },
  contents: titles.map(title => buildTitleCard(title, { isShortlisted: true })),
});

const rentalEndedAt = rental => rental.endedAt || rental.expiresAt || rental.updatedAt || rental.createdAt;

const buildRentalCard = rental => {
  const plain = toPlain(rental) || {};
  const content = toPlain(plain.contentId) || null;
  const status = plain.status || 'active';
  const isActive = status === 'active';
  const expiresAt = plain.expiresAt ? new Date(plain.expiresAt) : null;
  return {
    ...plain,
    content,
    title: content?.title || plain.titleSnapshot?.title || 'Content Deleted',
    image: content?.image || content?.posterReference || plain.titleSnapshot?.posterReference || '/images/default.svg',
    status,
    statusLabel: status === 'returned' ? 'Access returned' : status === 'active' ? 'Active rental' : status,
    isActive,
    confirmationHref: plain.publicReference ? `/my-access/ref/${encodeURIComponent(plain.publicReference)}` : null,
    expiresWithinSevenDays: Boolean(isActive && expiresAt && (expiresAt.getTime() - Date.now()) <= (7 * DAY_IN_MS)),
    endedAt: rentalEndedAt(plain),
  };
};

const buildAccessPage = ({ rentals = [], query = {} }) => {
  const cards = rentals.map(buildRentalCard);
  const active = cards.filter(rental => rental.isActive);
  const completed = cards.filter(rental => !rental.isActive);
  return {
    page: {
      kind: 'my-access',
      title: 'My Rentals',
      emptyState: cards.length === 0
        ? { kind: 'empty', message: 'No rentals yet. Browse and activate rental access for your first title.', actionHref: '/home', actionLabel: 'Browse Titles' }
        : null,
    },
    rentals: cards,
    active,
    completed,
    rented: query.rented === 'true',
    reference: query.ref || '',
  };
};

const buildRentalDetailPage = ({ rental }) => ({
  page: {
    kind: 'access-detail',
    title: 'Rental confirmation',
    emptyState: null,
  },
  rental: buildRentalCard(rental),
});

const buildAccountPage = ({ user }) => ({
  page: {
    kind: 'account',
    title: 'Account',
    emptyState: null,
  },
  account: {
    email: user.email,
    role: user.role === 'streamer' ? 'member' : user.role,
    status: user.status || 'active',
  },
});

const buildPartnerDashboardPage = ({ user }) => ({
  page: {
    kind: 'partner-dashboard',
    title: 'Partner Dashboard',
    emptyState: {
      kind: 'pending-operations',
      message: 'Scoped partner programs, title windows, and access activity will appear here as the operations workspace lands.',
    },
  },
  partnerUser: user,
});

const buildAdminOperationsPage = ({ user, stats = {} }) => ({
  page: {
    kind: 'admin-operations',
    title: 'Operations',
    roleScope: user?.role === 'admin' ? 'global' : 'restricted',
    canManageAll: user?.role === 'admin',
    emptyState: null,
  },
  stats,
});

const buildPublicErrorModel = (error) => ({
  statusCode: error?.statusCode || 500,
  message: error?.publicMessage || error?.message || 'Something went wrong',
  stack: undefined,
});

module.exports = {
  buildAdminOperationsPage,
  buildAccessPage,
  buildAccessState,
  buildAccountPage,
  buildCatalogPage,
  buildPagination,
  buildPartnerDashboardPage,
  buildPublicErrorModel,
  buildRentalDetailPage,
  buildShortlistPage,
  buildTitleCard,
  buildTitleDetailPage,
  emptyStateForCatalog,
  normalizeCapacity,
  normalizeFilters,
  sortTitles,
  titlePath,
};
