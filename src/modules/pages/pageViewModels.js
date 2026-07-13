const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 12;
const DEFAULT_CAPACITY_LIMIT = 20;
const ACCESS_DURATION_DAYS = 45;
const ACCESS_CURRENCY = 'CAD';

const PROGRAM_LABELS = {
  'program-northstar': 'Northstar Program',
  'program-afterlight': 'Afterlight Program',
  'program-signal-lab': 'Signal Lab Program',
  'program-harbor': 'Harbor Program',
};

const COLLECTION_LABELS = {
  'collection-featured': 'Featured Screenings',
  'collection-new-voices': 'New Voices',
  'collection-weekend-screening': 'Weekend Screening',
  'collection-staff-picks': 'Staff Picks',
  'collection-catalog': 'Open Catalog',
};

const toPlain = value => (value && typeof value.toObject === 'function' ? value.toObject() : value);

const asString = value => String(value || '');

const humanizeKey = value => asString(value)
  .replace(/^(program|collection)-/, '')
  .split('-')
  .filter(Boolean)
  .map(part => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

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

const releaseWindowState = (title = {}, now = new Date()) => {
  const window = title.releaseWindow || {};
  const opensAt = window.opensAt ? new Date(window.opensAt) : null;
  const closesAt = window.closesAt ? new Date(window.closesAt) : null;
  if (opensAt && now < opensAt) {
    return {
      status: 'upcoming',
      label: 'Access window not open yet',
      message: `Access opens ${opensAt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}.`,
      opensAt,
      closesAt,
    };
  }
  if (closesAt && now > closesAt) {
    return {
      status: 'expired',
      label: 'Access window closed',
      message: `Access closed ${closesAt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}.`,
      opensAt,
      closesAt,
    };
  }
  if (opensAt || closesAt) {
    return {
      status: 'open',
      label: 'Access window open',
      message: closesAt
        ? `Access closes ${closesAt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}.`
        : 'Access window is open.',
      opensAt,
      closesAt,
    };
  }
  return {
    status: 'open',
    label: 'Access window open',
    message: 'Standard access window is open.',
    opensAt: null,
    closesAt: null,
  };
};

const buildAccessState = ({ title, isShortlisted = false, canAccessMemberActions = true }) => {
  const capacity = normalizeCapacity(title);
  const windowState = releaseWindowState(title);
  const available = Boolean(title?.available) && !capacity.isFull && windowState.status === 'open';
  let primaryAction = 'sign_in';
  let primaryLabel = 'Sign In';
  let primaryHref = '/login';
  let method = 'get';

  if (canAccessMemberActions) {
    primaryAction = available ? 'activate_access' : 'unavailable';
    primaryLabel = available ? 'Activate Access' : 'Unavailable';
    primaryHref = reviewPath(title);
  }

  return {
    available,
    canAccessMemberActions,
    capacity,
    releaseWindow: windowState,
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
    accessMode: plain.accessMode || 'screening',
    programKey: plain.programKey || null,
    collectionKeys: Array.isArray(plain.collectionKeys) ? plain.collectionKeys : [],
    releaseWindow: plain.releaseWindow || null,
    shortDescription: plain.shortDescription || plain.description || '',
    releaseYear: plain.releaseYear || null,
    ageRating: plain.ageRating || '',
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

const groupByProgram = (cards = []) => {
  const grouped = new Map();
  for (const card of cards) {
    if (!card.programKey) continue;
    const group = grouped.get(card.programKey) || {
      key: card.programKey,
      label: PROGRAM_LABELS[card.programKey] || humanizeKey(card.programKey) || 'Screening Program',
      href: `/programs/${encodeURIComponent(card.programKey)}`,
      titles: [],
    };
    group.titles.push(card);
    grouped.set(card.programKey, group);
  }
  return Array.from(grouped.values())
    .sort((a, b) => b.titles.length - a.titles.length || a.label.localeCompare(b.label))
    .slice(0, 4);
};

const groupByCollection = (cards = []) => {
  const grouped = new Map();
  for (const card of cards) {
    for (const key of card.collectionKeys || []) {
      const group = grouped.get(key) || {
        key,
        label: COLLECTION_LABELS[key] || humanizeKey(key) || 'Screening Collection',
        href: `/collections/${encodeURIComponent(key)}`,
        titles: [],
      };
      group.titles.push(card);
      grouped.set(key, group);
    }
  }
  return Array.from(grouped.values())
    .sort((a, b) => b.titles.length - a.titles.length || a.label.localeCompare(b.label))
    .slice(0, 5);
};

const buildPublicCta = ({ user } = {}) => {
  if (!user) {
    return {
      kind: 'guest',
      primaryLabel: 'Explore Catalog',
      primaryHref: '/catalog',
      secondaryLabel: 'Create Member Account',
      secondaryHref: '/signup',
      supportingText: 'Create a member account only when you want to save titles or activate simulated access.',
    };
  }
  if (user.role === 'admin') {
    return {
      kind: 'admin',
      primaryLabel: 'Open Admin Dashboard',
      primaryHref: '/admin/dashboard',
      secondaryLabel: 'View Public Catalog',
      secondaryHref: '/catalog',
      supportingText: 'Admin access stays separate from guest discovery.',
    };
  }
  return {
    kind: 'member',
    primaryLabel: 'Continue to Member Catalog',
    primaryHref: '/home',
    secondaryLabel: 'View My Access',
    secondaryHref: '/my-access',
    supportingText: 'Member actions stay in the authenticated workspace.',
  };
};

const buildAccessExplanation = () => ({
  headline: 'How access works in this prototype',
  summary: 'StreamNexus uses fictional titles, simulated licence capacity, and 45-day access windows for portfolio demonstration only.',
  steps: [
    {
      title: 'Discover a screening',
      body: 'Guests can inspect published fictional titles, programs, collections, and access availability without signing in.',
    },
    {
      title: 'Create member access',
      body: 'Members can save titles and create simulated rental records. No payment, playback, or commercial licence is processed.',
    },
    {
      title: 'Track the window',
      body: 'The member workspace shows the public reference, active status, expiry window, and return action for each simulated access pass.',
    },
  ],
  limitations: [
    'No real payment processing',
    'No real media playback',
    'No real commercial licensing claim',
    'Fictional metadata and local demo assets only',
  ],
});

const buildPublicDiscoveryPage = ({ titles = [], user = null } = {}) => {
  const cards = titles.map(title => buildTitleCard(toPlain(title), { canAccessMemberActions: false }));
  const ranked = [...cards].sort((a, b) => {
    const aRank = Number(a.featuredRank || a.editorialRank || 999);
    const bRank = Number(b.featuredRank || b.editorialRank || 999);
    return aRank - bRank || asString(a.title).localeCompare(asString(b.title));
  });

  return {
    page: {
      kind: 'public-landing',
      title: 'StreamNexus Screening Access',
      description: 'Curated fictional screenings with transparent simulated access windows and licence availability.',
      emptyState: ranked.length === 0
        ? {
            kind: 'empty-public-discovery',
            message: 'No public screenings are available right now.',
            actionHref: '/catalog',
            actionLabel: 'Check Catalog',
          }
        : null,
    },
    heroItems: ranked.slice(0, 5),
    featured: ranked.slice(0, 8),
    programs: groupByProgram(ranked),
    collections: groupByCollection(ranked),
    accessExplanation: buildAccessExplanation(),
    cta: buildPublicCta({ user }),
  };
};

const buildPublicProgramPage = ({ slug, titles = [] }) => {
  const page = buildCatalogPage({ titles, query: {}, basePath: `/programs/${encodeURIComponent(slug)}`, kind: 'program' });
  const label = PROGRAM_LABELS[slug] || humanizeKey(slug) || slug;
  return {
    ...page,
    page: {
      ...page.page,
      title: `${label} Screening Program`,
      description: `Public fictional screening program for ${label} with simulated access availability.`,
    },
    slug,
    label,
    accessExplanation: buildAccessExplanation(),
  };
};

const buildPublicCollectionPage = ({ slug, titles = [] }) => {
  const page = buildCatalogPage({ titles, query: {}, basePath: `/collections/${encodeURIComponent(slug)}`, kind: 'collection' });
  const label = COLLECTION_LABELS[slug] || humanizeKey(slug) || slug;
  return {
    ...page,
    page: {
      ...page.page,
      title: `${label} Screening Collection`,
      description: `Public fictional screening collection for ${label} with simulated access availability.`,
    },
    slug,
    label,
    accessExplanation: buildAccessExplanation(),
  };
};

const daysUntil = (value) => {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / DAY_IN_MS);
};

const byEditorialOrder = (a, b) => {
  const aRank = Number(a.editorialRank || a.featuredRank || 999);
  const bRank = Number(b.editorialRank || b.featuredRank || 999);
  return aRank - bRank || asString(a.title).localeCompare(asString(b.title));
};

const groupByGenre = (cards = []) => {
  const grouped = new Map();
  for (const card of cards) {
    const genre = card.genre || 'General';
    const group = grouped.get(genre) || {
      key: genre.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      label: genre,
      href: `/home?search=${encodeURIComponent(genre)}`,
      titles: [],
    };
    group.titles.push(card);
    grouped.set(genre, group);
  }
  return Array.from(grouped.values())
    .sort((a, b) => b.titles.length - a.titles.length || a.label.localeCompare(b.label))
    .slice(0, 3)
    .map(group => ({
      ...group,
      titles: group.titles.sort(byEditorialOrder).slice(0, 4),
    }));
};

const buildMemberHomePage = ({ titles = [], query = {}, shortlistTitles = [], rentals = [] }) => {
  const catalog = buildCatalogPage({
    titles,
    query,
    shortlistIds: new Set(shortlistTitles.map(title => titleId(title))),
    basePath: '/home',
    kind: 'member-home',
  });
  const titleCards = titles.map(title => buildTitleCard(title, { canAccessMemberActions: true })).sort(byEditorialOrder);
  const myListPreview = shortlistTitles
    .map(title => buildTitleCard(title, { isShortlisted: true, canAccessMemberActions: true }))
    .sort(byEditorialOrder)
    .slice(0, 4);
  const rentalCards = rentals.map(buildRentalCard);
  const activeAccess = rentalCards
    .filter(rental => rental.isActive)
    .sort((a, b) => new Date(a.expiresAt || 0) - new Date(b.expiresAt || 0));
  const expiringSoon = activeAccess
    .filter(rental => rental.expiresWithinSevenDays)
    .slice(0, 4);
  const newTitles = [...titleCards]
    .sort((a, b) => new Date(b.publishedAt || b.createdAt || 0) - new Date(a.publishedAt || a.createdAt || 0) || byEditorialOrder(a, b))
    .slice(0, 6);
  const programs = groupByProgram(titleCards);
  const genreRails = groupByGenre(titleCards);
  const spotlight = titleCards.find(card => card.collectionKeys.includes('collection-featured')) || titleCards[0] || null;
  const isFresh = activeAccess.length === 0 && myListPreview.length === 0;

  return {
    ...catalog,
    page: {
      ...catalog.page,
      kind: 'member-home',
      title: 'Member Home',
      description: 'Authenticated StreamNexus member workspace with access state, saved titles, and deterministic screening discovery.',
    },
    memberHome: {
      state: isFresh ? 'fresh' : 'populated',
      activeAccess: activeAccess.slice(0, 4).map(rental => ({
        ...rental,
        daysRemaining: daysUntil(rental.expiresAt),
      })),
      expiringSoon: expiringSoon.map(rental => ({
        ...rental,
        daysRemaining: daysUntil(rental.expiresAt),
      })),
      myListPreview,
      programs,
      newTitles,
      genreRails,
      sponsoredScreening: spotlight
        ? {
            eyebrow: 'Sponsored screening',
            title: spotlight.title,
            body: 'Fictional placement used to show how a partner-supported screening module would be labeled in the member workspace.',
            href: spotlight.detailUrl,
            meta: `${spotlight.genre || 'General'} / ${spotlight.capacity.remaining} licences open`,
          }
        : null,
    },
  };
};

const buildAccessReviewPage = ({ title, accessError = null }) => {
  const content = buildTitleCard(title, { canAccessMemberActions: true });
  const capacity = content.capacity;
  const conflict = accessError
    ? {
        code: accessError.code || 'ACCESS_CONFLICT',
        message: accessError.error || accessError.message || 'Access could not be confirmed.',
      }
    : content.access.releaseWindow.status !== 'open'
      ? { code: 'WINDOW_CLOSED', message: content.access.releaseWindow.message }
    : !content.available
      ? { code: 'UNAVAILABLE', message: 'This title is not available for access activation right now.' }
      : capacity.isFull
        ? { code: 'AT_CAPACITY', message: 'All simulated access seats are currently active for this title.' }
        : null;

  return {
    page: {
      kind: 'access-review',
      title: `Review access for ${content.title}`,
      emptyState: null,
    },
    content,
    capacity,
    accessPolicy: {
      durationDays: ACCESS_DURATION_DAYS,
      currencyCode: content.currencyCode || ACCESS_CURRENCY,
      simulatedAmount: Number(content.price || 0).toFixed(2),
      version: 'rental-v1',
      limitations: [
        'No real payment is processed.',
        'No protected playback is enabled.',
        'Returning access releases one simulated title licence.',
      ],
    },
    conflict,
    recoveryActions: [
      { href: '/my-access', label: 'Open My Access' },
      { href: '/home#browse-titles', label: 'Browse available titles' },
      { href: content.detailUrl, label: 'Back to title details' },
    ],
    canConfirm: !conflict,
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
  const startedAt = plain.rentedAt || plain.startedAt || plain.date || plain.createdAt;
  const endedAt = rentalEndedAt(plain);
  const statusLabel = status === 'returned'
    ? 'Access returned'
    : status === 'expired'
      ? 'Access expired'
      : status === 'cancelled'
        ? 'Access cancelled'
        : status === 'active'
          ? 'Active access'
          : status;
  return {
    ...plain,
    content,
    title: content?.title || plain.titleSnapshot?.title || 'Content Deleted',
    image: content?.image || content?.posterReference || plain.titleSnapshot?.posterReference || '/images/default.svg',
    status,
    statusLabel,
    isActive,
    confirmationHref: plain.publicReference ? `/my-access/ref/${encodeURIComponent(plain.publicReference)}` : null,
    expiresWithinSevenDays: Boolean(isActive && expiresAt && (expiresAt.getTime() - Date.now()) <= (7 * DAY_IN_MS)),
    daysRemaining: isActive && expiresAt ? Math.max(daysUntil(expiresAt), 0) : null,
    endedAt,
    lifecycle: [
      { label: 'Confirmed', date: startedAt, isComplete: true },
      { label: 'Expires', date: plain.expiresAt, isComplete: !endedAt },
      { label: statusLabel, date: endedAt, isComplete: Boolean(endedAt) },
    ],
  };
};

const buildAccessPage = ({ rentals = [], query = {} }) => {
  const cards = rentals.map(buildRentalCard);
  const active = cards.filter(rental => rental.isActive);
  const completed = cards.filter(rental => !rental.isActive);
  return {
    page: {
      kind: 'my-access',
      title: 'My Access',
      emptyState: cards.length === 0
        ? { kind: 'empty', message: 'No access passes yet. Browse titles and activate a simulated access pass for your first title.', actionHref: '/home', actionLabel: 'Browse Titles' }
        : null,
    },
    rentals: cards,
    active,
    completed,
    rented: query.rented === 'true',
    returned: query.returned === 'true' || query.checkout === 'success',
    reference: query.ref || '',
  };
};

const buildRentalDetailPage = ({ rental }) => ({
  page: {
    kind: 'access-detail',
    title: 'Access pass details',
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
  buildAccessReviewPage,
  buildAccessState,
  buildAccountPage,
  buildCatalogPage,
  buildPagination,
  buildPartnerDashboardPage,
  buildMemberHomePage,
  buildPublicCollectionPage,
  buildPublicDiscoveryPage,
  buildPublicErrorModel,
  buildPublicProgramPage,
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
