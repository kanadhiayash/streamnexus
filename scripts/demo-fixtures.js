require('dotenv').config();

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const connectDB = require('../config/db');
const { buildConfig, assertSandboxDatabase } = require('../src/config/environment');
const { inspectDemoFixtures, resetDemoFixtures, seedDemoFixtures } = require('../src/demo/fixtureCatalog');

const isLoopbackMongo = (mongoUrl = '') => (
  mongoUrl.startsWith('mongodb://127.0.0.1:')
  || mongoUrl.startsWith('mongodb://localhost:')
  || mongoUrl.includes('mongodb-memory-server')
);

let transientMongoServer;

const prepareDatabase = async () => {
  if (process.env.APP_RUNTIME === 'sandbox' && !isLoopbackMongo(process.env.MONGO_URI || '')) {
    transientMongoServer = await MongoMemoryServer.create();
    process.env.MONGO_URI = transientMongoServer.getUri('streamnexus_demo_fixtures');
  }

  const config = buildConfig();
  assertSandboxDatabase(config);
  await connectDB({ mongoUri: config.database.mongoUrl, throwOnError: true });
};

const main = async () => {
  const args = new Set(process.argv.slice(2));
  await prepareDatabase();

  let result;
  if (args.has('--reset')) {
    const reset = await resetDemoFixtures({ write: args.has('--write') });
    const seed = args.has('--write') ? await seedDemoFixtures() : null;
    result = { reset, seed };
  } else if (args.has('--repair') || args.has('--seed')) {
    result = await seedDemoFixtures();
  } else {
    result = await inspectDemoFixtures();
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};

main()
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    if (transientMongoServer) {
      await transientMongoServer.stop();
    }
  });
