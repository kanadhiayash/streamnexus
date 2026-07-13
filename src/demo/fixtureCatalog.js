const bcrypt = require('bcryptjs');

const Content = require('../../models/Content');
const User = require('../../models/User');
const { RENTAL_POLICY } = require('../config/rentalPolicy');

const DEMO_FIXTURE_OWNER = 'streamnexus-demo';
const DEMO_FIXTURE_COUNT = 50;
const DEFAULT_DEMO_PASSWORD = 'streamnexus-demo';

const TITLE_NAMES = [
  'Glass Harbor Signal',
  'Afterlight Meridian',
  'Copper Sky Relay',
  'Northstar Commons',
  'Velvet Circuit',
  'Juniper Gate',
  'Horizon Orchard',
  'Silent Atlas',
  'Blue Lantern Run',
  'Ivory Signal House',
  'Rainline Protocol',
  'Crimson Lattice',
  'Soft Orbit',
  'The Kestrel Archive',
  'Silver Current',
  'Paper Moon District',
  'Lanterns of Vale Nine',
  'The Marigold Test',
  'Signal Over Briar',
  'Cinder Bloom',
  'Echoes at Halcyon Pier',
  'The Quiet Voltage',
  'Mosslight Assembly',
  'Riverglass Index',
  'Saffron Weather',
  'Twelve Notes for Orla',
  'Cobalt Room',
  'The Distant Orchard',
  'Violet Line Committee',
  'Low Tide Algorithm',
  'Golden Finch Method',
  'The Ember Registry',
  'Cloudline Borough',
  'Midnight Cartographer',
  'Pine Needle Future',
  'The Aster Bureau',
  'Saltwind Equation',
  'Lumen Field',
  'Wavelength of June',
  'The Small Planet Office',
  'Harbor Without Maps',
  'Neon Orchard Choir',
  'The Kindling Loop',
  'Verdant Parallax',
  'Rookstone Summer',
  'Frosted Circuitry',
  'The Paloma Interval',
  'Amber Static',
  'Oxbow Constellation',
  'The Seventh Greenhouse',
];

const GENRES = ['Drama', 'Sci-Fi', 'Thriller', 'Documentary', 'Mystery', 'Adventure', 'Comedy', 'Romance'];
const PROGRAM_KEYS = ['program-northstar', 'program-afterlight', 'program-signal-lab', 'program-harbor'];
const COLLECTION_KEYS = ['collection-featured', 'collection-new-voices', 'collection-weekend-screening', 'collection-staff-picks'];
const ACCESS_MODES = ['screening', 'festival', 'partner_preview'];

const slugify = (value) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const fixtureIdForIndex = (index) => `SNX-TITLE-${String(index + 1).padStart(3, '0')}`;

const buildTitleFixtures = () => TITLE_NAMES.map((title, index) => {
  const fixtureId = fixtureIdForIndex(index);
  const type = index % 3 === 1 ? 'tv' : 'movie';
  const genre = GENRES[index % GENRES.length];
  const programKey = PROGRAM_KEYS[index % PROGRAM_KEYS.length];
  const collectionKey = COLLECTION_KEYS[index % COLLECTION_KEYS.length];
  const releaseMonth = String((index % 12) + 1).padStart(2, '0');

  return {
    schemaVersion: 2,
    fixtureId,
    fixtureOwner: DEMO_FIXTURE_OWNER,
    programKey,
    collectionKeys: [collectionKey, index % 5 === 0 ? 'collection-featured' : 'collection-catalog'],
    accessMode: ACCESS_MODES[index % ACCESS_MODES.length],
    featuredRank: index < 8 ? index + 1 : null,
    releaseWindow: {
      opensAt: new Date(`2026-${releaseMonth}-01T00:00:00.000Z`),
      closesAt: new Date(`2026-${releaseMonth}-28T23:59:59.000Z`),
    },
    slug: `${slugify(title)}-${fixtureId.toLowerCase()}`,
    title,
    type,
    shortDescription: `${title} is a fictional ${genre.toLowerCase()} selection curated for StreamNexus access testing.`,
    synopsis: `${title} follows a fictional ensemble through a contained screening scenario built for demo data validation.`,
    releaseYear: 2026 - (index % 6),
    ageRating: index % 4 === 0 ? 'PG' : index % 4 === 1 ? 'PG-13' : '14A',
    runtimeMinutes: type === 'movie' ? 88 + (index % 42) : 46 + (index % 18),
    description: `${title} is fictional StreamNexus demo content with stable metadata and public-safe copy.`,
    price: Number((2.99 + (index % 7)).toFixed(2)),
    rentalPriceMinor: 299 + ((index % 7) * 100),
    currencyCode: RENTAL_POLICY.currencyCode,
    image: '/images/default.svg',
    posterReference: '/images/default.svg',
    backdropReference: '/images/default.svg',
    posterAlt: `${title} fictional demo poster`,
    available: true,
    lifecycle: 'published',
    rating: Number((7.1 + ((index % 18) / 10)).toFixed(1)),
    genre,
    genres: [genre],
    tags: ['fictional', 'demo', programKey],
    duration: type === 'movie' ? `${Math.floor((88 + (index % 42)) / 60)}h ${(88 + (index % 42)) % 60}m` : 'Limited series',
    cast: `Fictional Ensemble ${String.fromCharCode(65 + (index % 26))}`,
    castMembers: [`Fictional Performer ${String.fromCharCode(65 + (index % 26))}`, `Fictional Performer ${String.fromCharCode(75 + (index % 16))}`],
    trending: index < 10,
    rentalLimit: RENTAL_POLICY.defaultTitleLicenceLimit,
    licenceLimit: RENTAL_POLICY.defaultTitleLicenceLimit,
    activeLicenceCount: 0,
    editorialRank: index + 1,
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
});

const TITLE_FIXTURES = Object.freeze(buildTitleFixtures());
const fixtureIds = () => TITLE_FIXTURES.map((fixture) => fixture.fixtureId);

const DEMO_PERSONAS = Object.freeze([
  {
    key: 'demo-admin',
    email: process.env.DEMO_ADMIN_EMAIL || 'admin@gmail.com',
    password: process.env.DEMO_ADMIN_PASSWORD || 'admin',
    role: 'admin',
    displayName: 'StreamNexus Admin',
  },
  {
    key: 'demo-populated-member',
    email: process.env.DEMO_POPULATED_MEMBER_EMAIL || 'member.populated@streamnexus.test',
    password: process.env.DEMO_POPULATED_MEMBER_PASSWORD || DEFAULT_DEMO_PASSWORD,
    role: 'streamer',
    displayName: 'Demo Populated Member',
    shortlistFixtureIds: ['SNX-TITLE-001', 'SNX-TITLE-002', 'SNX-TITLE-003'],
  },
  {
    key: 'demo-fresh-member',
    email: process.env.DEMO_FRESH_MEMBER_EMAIL || 'member.fresh@streamnexus.test',
    password: process.env.DEMO_FRESH_MEMBER_PASSWORD || DEFAULT_DEMO_PASSWORD,
    role: 'streamer',
    displayName: 'Demo Fresh Member',
    shortlistFixtureIds: [],
  },
]);

const seedTitleFixtures = async ({ ContentModel = Content } = {}) => {
  let upserted = 0;
  let matched = 0;

  for (const fixture of TITLE_FIXTURES) {
    const result = await ContentModel.updateOne(
      {
        $or: [
          { fixtureId: fixture.fixtureId },
          {
            title: fixture.title,
            image: fixture.image,
            $or: [{ createdBy: null }, { createdBy: { $exists: false } }],
          },
        ],
      },
      { $set: fixture },
      { upsert: true }
    );
    upserted += result.upsertedCount || 0;
    matched += result.matchedCount || 0;
  }

  return { upserted, matched, expected: DEMO_FIXTURE_COUNT };
};

const seedDemoPersonas = async ({ UserModel = User, ContentModel = Content } = {}) => {
  const byFixtureId = new Map(
    (await ContentModel.find({ fixtureOwner: DEMO_FIXTURE_OWNER }).select('_id fixtureId').lean())
      .map((content) => [content.fixtureId, content._id])
  );
  const seeded = [];

  for (const persona of DEMO_PERSONAS) {
    const password = await bcrypt.hash(persona.password, 10);
    const shortlist = (persona.shortlistFixtureIds || [])
      .map((fixtureId) => byFixtureId.get(fixtureId))
      .filter(Boolean);

    await UserModel.updateOne(
      { email: persona.email },
      {
        $set: {
          schemaVersion: 2,
          email: persona.email,
          password,
          role: persona.role,
          displayName: persona.displayName,
          status: 'active',
          sessionVersion: 1,
          shortlist,
        },
        $setOnInsert: { rented: [] },
      },
      { upsert: true }
    );

    seeded.push({ key: persona.key, role: persona.role });
  }

  return { personas: seeded };
};

const seedDemoFixtures = async (options = {}) => {
  const titles = await seedTitleFixtures(options);
  const personas = await seedDemoPersonas(options);
  return { titles, personas };
};

const resetDemoFixtures = async ({ ContentModel = Content, write = false } = {}) => {
  const filter = { fixtureOwner: DEMO_FIXTURE_OWNER };
  const ownedCount = await ContentModel.countDocuments(filter);
  if (!write) {
    return { dryRun: true, deleted: 0, matched: ownedCount };
  }
  const result = await ContentModel.deleteMany(filter);
  return { dryRun: false, deleted: result.deletedCount || 0, matched: ownedCount };
};

const inspectDemoFixtures = async ({ ContentModel = Content } = {}) => {
  const records = await ContentModel.find({ fixtureOwner: DEMO_FIXTURE_OWNER }).select('fixtureId slug title').lean();
  return {
    count: records.length,
    ids: records.map((record) => record.fixtureId).sort(),
    duplicateIds: records
      .map((record) => record.fixtureId)
      .filter((fixtureId, index, ids) => ids.indexOf(fixtureId) !== index),
  };
};

module.exports = {
  DEMO_FIXTURE_COUNT,
  DEMO_FIXTURE_OWNER,
  DEMO_PERSONAS,
  TITLE_FIXTURES,
  fixtureIds,
  inspectDemoFixtures,
  resetDemoFixtures,
  seedDemoFixtures,
  seedDemoPersonas,
  seedTitleFixtures,
};
