process.env.NODE_ENV = 'test';
process.env.SEED_DEMO_DATA = 'false';
process.env.SESSION_SECRET = 'test-session-secret-with-enough-entropy';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Content = require('../models/Content');
const Rental = require('../models/Rental');
const User = require('../models/User');
const { inspectDataContracts } = require('../src/infrastructure/migrations/dataContractsMigration');
const { buildRentalWindow } = require('../src/modules/rentals/rentals.service');

const main = async () => {
  const mongoServer = await MongoMemoryServer.create();
  try {
    await mongoose.connect(mongoServer.getUri('streamnexus_migration_fixture'));

    const user = await User.create({
      email: 'fixture-member@example.com',
      password: 'fixture-password-hash',
      role: 'streamer',
      shortlist: [],
      rented: [],
    });
    const title = await Content.create({
      title: 'Fixture Title',
      type: 'tv',
      description: 'Fixture migration title',
      price: 4.99,
      available: true,
      genre: 'Drama',
    });
    user.shortlist.push(title._id);
    await user.save();

    const window = buildRentalWindow(new Date('2026-07-10T00:00:00.000Z'));
    await Rental.create({
      userId: user._id,
      contentId: title._id,
      status: 'active',
      date: window.rentedAt,
      rentedAt: window.rentedAt,
      expiresAt: window.expiresAt,
    });

    const report = await inspectDataContracts({ dryRun: true });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
};

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
