require('dotenv').config();

const mongoose = require('mongoose');

const connectDB = require('../config/db');
const { buildConfig, assertSandboxDatabase } = require('../src/config/environment');
const { createRentalsService } = require('../src/modules/rentals/rentals.service');

const isLoopbackMongo = (mongoUrl = '') => (
  mongoUrl.startsWith('mongodb://127.0.0.1:')
  || mongoUrl.startsWith('mongodb://localhost:')
  || mongoUrl.includes('mongodb-memory-server')
);

let transientMongoServer;

const main = async () => {
  if (process.env.APP_RUNTIME === 'sandbox' && !isLoopbackMongo(process.env.MONGO_URI || '')) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    transientMongoServer = await MongoMemoryServer.create();
    process.env.MONGO_URI = transientMongoServer.getUri('streamnexus_capacity_reconcile');
  }

  const config = buildConfig();
  assertSandboxDatabase(config);
  await connectDB({ mongoUri: config.database.mongoUrl, throwOnError: true });

  const result = await createRentalsService().reconcileLicenceCounts();
  if (!result.success) {
    throw new Error(result.error || 'Capacity reconciliation failed');
  }

  process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
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
