const bcrypt = require('bcryptjs');

const Content = require('../../models/Content');
const User = require('../../models/User');
const logger = require('../../utils/logger');
const { RENTAL_POLICY } = require('../config/rentalPolicy');

const LEGACY_DEMO_LICENCE_LIMIT = 5;

const demoTitle = (title) => ({
  ...title,
  rentalLimit: RENTAL_POLICY.defaultTitleLicenceLimit,
  licenceLimit: RENTAL_POLICY.defaultTitleLicenceLimit,
});

const DEMO_CONTENT_FIXTURES = [
  demoTitle({ title: 'Neon Chase', type: 'movie', description: 'Fast-paced thriller with neon cityscapes and high-stakes action', price: 4.99, image: '/images/neon-chase.jpg', available: true, rating: 8.2, genre: 'Thriller', duration: '2h 15m', cast: 'Keanu Reeves, Zoe Kravitz' }),
  demoTitle({ title: 'Space Odyssey', type: 'movie', description: 'Deep space drama and survival in the vastness of the universe', price: 5.99, image: '/images/space-odyssey.jpg', available: true, rating: 8.8, genre: 'Sci-Fi', duration: '2h 45m', cast: 'Matthew McConaughey, Anne Hathaway' }),
  demoTitle({ title: 'Cyber City', type: 'tv', description: 'Futuristic crime anthology set in neon-lit metropolis', price: 2.99, image: '/images/cyber-city.jpg', available: true, rating: 8.0, genre: 'Crime', duration: '45m per episode', cast: 'Oscar Isaac, Tatiana Maslany' }),
  demoTitle({ title: 'Wild Frontier', type: 'tv', description: 'Adventure series across untamed lands and undiscovered territories', price: 3.99, image: '/images/wild-frontier.jpg', available: true, rating: 7.9, genre: 'Adventure', duration: '50m per episode', cast: 'Pedro Pascal, Bella Ramsey' }),
  demoTitle({ title: 'Mystic Falls', type: 'movie', description: 'Supernatural romantic mystery in a small mountain town', price: 4.49, image: '/images/mystic-falls.jpg', available: true, rating: 7.5, genre: 'Romance', duration: '2h', cast: 'Timothee Chalamet, Florence Pugh' }),
  demoTitle({ title: 'Heist Masters', type: 'movie', description: 'Heist in a high-tech vault with a crew of specialized thieves', price: 6.49, image: '/images/heist-masters.jpg', available: true, rating: 8.4, genre: 'Crime', duration: '2h 30m', cast: 'Ryan Gosling, Margot Robbie', trending: true }),
  demoTitle({ title: 'Quantum Dawn', type: 'tv', description: 'Sci-fi thriller with parallel timelines and quantum mechanics', price: 3.49, image: '/images/quantum-dawn.jpg', available: true, rating: 8.7, genre: 'Sci-Fi', duration: '55m per episode', cast: 'Olivia Wilde, Rami Malek', trending: true }),
  demoTitle({ title: 'Forgotten Legends', type: 'movie', description: 'Epic historical drama spanning continents and centuries', price: 5.49, image: '/images/forgotten-legends.jpg', available: true, rating: 8.1, genre: 'Drama', duration: '3h', cast: 'Cillian Murphy, Emily Blunt' }),
  demoTitle({ title: 'Aqua Squad', type: 'tv', description: 'Underwater action and family adventure with cutting-edge visuals', price: 2.49, image: '/images/aqua-squad.jpg', available: true, rating: 7.6, genre: 'Adventure', duration: '40m per episode', cast: 'Jason Momoa, Amber Heard' }),
  demoTitle({ title: 'Midnight Code', type: 'movie', description: 'Hackers vs corporates in a battle for digital supremacy', price: 4.79, image: '/images/midnight-code.jpg', available: true, rating: 8.3, genre: 'Thriller', duration: '2h 10m', cast: 'Saoirse Ronan, Daniel Kaluuya', trending: true }),
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

  for (const fixture of DEMO_CONTENT_FIXTURES) {
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

    const count = await Content.countDocuments();
    if (count < 10) {
      await Content.insertMany(DEMO_CONTENT_FIXTURES);
      logger.info('Sample content seeded');
    }
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
