const assert = require('node:assert/strict');
const test = require('node:test');

const { createPageUseCases } = require('../src/modules/pages/page.useCases');
const {
  buildAccessState,
  buildAdminOperationsPage,
  buildCatalogPage,
  buildPagination,
  buildPublicErrorModel,
  buildTitleCard,
} = require('../src/modules/pages/pageViewModels');

const title = (overrides = {}) => ({
  _id: overrides._id || 'title-1',
  title: overrides.title || 'A Deterministic Title',
  slug: overrides.slug || 'a-deterministic-title',
  type: overrides.type || 'movie',
  price: overrides.price ?? 4.99,
  available: overrides.available ?? true,
  rentalLimit: overrides.rentalLimit ?? 20,
  activeLicenceCount: overrides.activeLicenceCount ?? 3,
  description: overrides.description || 'A fixture title',
  genre: overrides.genre || 'Drama',
  ...overrides,
});

test('[SNX-DATA-030] title view model is deterministic', () => {
  const input = title();
  assert.deepEqual(buildTitleCard(input), buildTitleCard(input));
  assert.equal(buildTitleCard(input).detailUrl, '/titles/a-deterministic-title');
});

test('[SNX-ACCESS-030] access state maps to one primary action', () => {
  const available = buildAccessState({ title: title(), canAccessMemberActions: true });
  const full = buildAccessState({ title: title({ activeLicenceCount: 20 }), canAccessMemberActions: true });
  const guest = buildAccessState({ title: title(), canAccessMemberActions: false });

  assert.equal(available.primaryAction, 'activate_access');
  assert.equal(full.primaryAction, 'unavailable');
  assert.equal(guest.primaryAction, 'sign_in');
});

test('[SNX-IA-020] route use case returns the correct page model', async () => {
  const services = {
    content: {
      getAvailableContent: async () => ({ success: true, data: [title()] }),
      searchContent: async () => ({ success: true, data: [title({ title: 'Neon Route' })] }),
    },
    rentals: {
      attachCapacityToContents: async titles => ({ success: true, data: titles }),
      getUserRentals: async () => ({ success: true, data: [] }),
    },
    user: {
      getShortlist: async () => ({ success: true, data: [title()] }),
    },
  };
  const useCases = createPageUseCases({ services });
  const page = await useCases.memberCatalog({
    user: { id: 'member-id', role: 'member' },
    query: { search: 'neon', sort: 'price_desc' },
  });

  assert.equal(page.page.kind, 'member-home');
  assert.equal(page.memberHome.state, 'populated');
  assert.equal(page.page.filters.search, 'neon');
  assert.equal(page.contents[0].isShortlisted, true);
});

test('[SNX-UI-010] empty-state model is explicit', () => {
  const page = buildCatalogPage({ titles: [], query: { search: 'missing' } });

  assert.equal(page.page.emptyState.kind, 'filtered');
  assert.equal(page.page.emptyState.message, 'No matching titles found. Try a different search or filter.');
});

test('[SNX-UI-011] pagination model preserves filters and sort', () => {
  const pagination = buildPagination({
    totalItems: 30,
    currentPage: 2,
    pageSize: 12,
    search: 'neon signal',
    type: 'movie',
    sort: 'price_desc',
    basePath: '/home',
  });

  assert.equal(pagination.previousHref, '/home?search=neon+signal&type=movie&sort=price_desc');
  assert.equal(pagination.nextHref, '/home?search=neon+signal&type=movie&sort=price_desc&page=3');
});

test('[SNX-SEC-111] public error model exposes no internal stack data', () => {
  const error = new Error('Database stack should stay private');
  error.stack = 'private stack frame';
  error.statusCode = 500;
  error.publicMessage = 'Something went wrong';

  assert.deepEqual(buildPublicErrorModel(error), {
    statusCode: 500,
    message: 'Something went wrong',
    stack: undefined,
  });
});

test('[SNX-ADMIN-010] admin operations view model respects role scope', () => {
  const admin = buildAdminOperationsPage({ user: { role: 'admin' }, stats: { active: 2 } });
  const partner = buildAdminOperationsPage({ user: { role: 'partner' }, stats: { active: 2 } });

  assert.equal(admin.page.roleScope, 'global');
  assert.equal(admin.page.canManageAll, true);
  assert.equal(partner.page.roleScope, 'restricted');
  assert.equal(partner.page.canManageAll, false);
});
