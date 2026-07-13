const bcrypt = require('bcryptjs');

const Content = require('../../models/Content');
const User = require('../../models/User');
const logger = require('../../utils/logger');
const { RENTAL_POLICY } = require('../config/rentalPolicy');
const { TITLE_FIXTURES, seedDemoFixtures } = require('./fixtureCatalog');

const LEGACY_DEMO_LICENCE_LIMIT = 5;
const DEMO_CONTENT_FIXTURES = TITLE_FIXTURES;
const LEGACY_DEMO_CONTENT_FIXTURES = [
  { title: 'Neon Chase', image: '/images/neon-chase.jpg' },
  { title: 'Space Odyssey', image: '/images/space-odyssey.jpg' },
  { title: 'Cyber City', image: '/images/cyber-city.jpg' },
  { title: 'Wild Frontier', image: '/images/wild-frontier.jpg' },
  { title: 'Mystic Falls', image: '/images/mystic-falls.jpg' },
  { title: 'Heist Masters', image: '/images/heist-masters.jpg' },
  { title: 'Quantum Dawn', image: '/images/quantum-dawn.jpg' },
  { title: 'Forgotten Legends', image: '/images/forgotten-legends.jpg' },
  { title: 'Aqua Squad', image: '/images/aqua-squad.jpg' },
  { title: 'Midnight Code', image: '/images/midnight-code.jpg' },
];

const getDemoUsers = (isProduction = false) => {
  const adminEmail = process.env.DEMO_ADMIN_EMAIL || 'admin@gmail.com';
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD || 'admin';
  const streamerEmail = process.env.DEMO_STREAMER_EMAIL || 'streamer@gmail.com';
  const streamerPassword = process.env.DEMO_STREAMER_PASSWORD || 'streamer';

  if (isProduction && (adminPassword.length < 12 || streamerPassword.length < 12)) {
    throw new Error('Production demo seed passwords must be set with at least 12 characters');
  }

  return { adminEmail, adminPassword, streamerEmail, streamerPassword };
};

const buildDemoRepair = (user, expectedRole) => {
  const repair = {};
  const validRoles = expectedRole === 'streamer' ? ['streamer', 'member'] : [expectedRole];

  if (!validRoles.includes(user.role)) {
    repair.role = expectedRole;
  }

  if (user.status == null) {
    repair.status = 'active';
  }

  if (user.sessionVersion == null) {
    repair.sessionVersion = 1;
  }

  if (!Array.isArray(user.shortlist)) {
    repair.shortlist = [];
  }

  if (!Array.isArray(user.rented)) {
    repair.rented = [];
  }

  return repair;
};

const repairDemoUser = async ({ email, expectedRole }) => {
  const user = await User.findOne({ email }).lean();
  if (!user) return false;

  const repair = buildDemoRepair(user, expectedRole);
  if (Object.keys(repair).length === 0) return false;

  await User.updateOne({ _id: user._id }, { $set: repair });
  logger.info(`Demo ${expectedRole} account repaired`);
  return true;
};

const repairLegacyDemoCapacity = async ({ ContentModel = Content } = {}) => {
  let updated = 0;

  for (const fixture of [...LEGACY_DEMO_CONTENT_FIXTURES, ...DEMO_CONTENT_FIXTURES]) {
    const result = await ContentModel.updateOne(
      {
        title: fixture.title,
        image: fixture.image,
        rentalLimit: LEGACY_DEMO_LICENCE_LIMIT,
        licenceLimit: LEGACY_DEMO_LICENCE_LIMIT,
        $or: [{ createdBy: null }, { createdBy: { $exists: false } }],
      },
      {
        $set: {
          rentalLimit: RENTAL_POLICY.defaultTitleLicenceLimit,
          licenceLimit: RENTAL_POLICY.defaultTitleLicenceLimit,
        },
      }
    );
    updated += result.modifiedCount || 0;
  }

  if (updated > 0) {
    logger.info(`Demo title licence capacity repaired for ${updated} title${updated === 1 ? '' : 's'}`);
  }

  return { updated, scanned: DEMO_CONTENT_FIXTURES.length };
};

const seedDatabase = async ({ isProduction = process.env.NODE_ENV === 'production' } = {}) => {
  try {
    const { adminEmail, adminPassword, streamerEmail, streamerPassword } = getDemoUsers(isProduction);
    const existingAdmin = await User.findOne({ email: adminEmail });
    const existingStreamer = await User.findOne({ email: streamerEmail });

    if (!existingAdmin) {
      const hash = await bcrypt.hash(adminPassword, 10);
      await User.create({ email: adminEmail, password: hash, role: 'admin', status: 'active', sessionVersion: 1, shortlist: [], rented: [] });
      logger.info('Admin user seeded');
    } else {
      await repairDemoUser({ email: adminEmail, expectedRole: 'admin' });
    }

    if (!existingStreamer) {
      const hash = await bcrypt.hash(streamerPassword, 10);
      await User.create({ email: streamerEmail, password: hash, role: 'streamer', status: 'active', sessionVersion: 1, shortlist: [], rented: [] });
      logger.info('Streamer user seeded');
    } else {
      await repairDemoUser({ email: streamerEmail, expectedRole: 'streamer' });
    }

    const fixtureResult = await seedDemoFixtures();
    logger.info(`Sample content fixtures ensured: ${fixtureResult.titles.expected}`);
    await repairLegacyDemoCapacity();
    logger.info('Seed data ensured');
  } catch (error) {
    logger.error('Error seeding database:', error);
    throw error;
  }
};

module.exports = {
  DEMO_CONTENT_FIXTURES,
  LEGACY_DEMO_LICENCE_LIMIT,
  buildDemoRepair,
  getDemoUsers,
  repairDemoUser,
  repairLegacyDemoCapacity,
  seedDatabase,
};
