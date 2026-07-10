const mongoose = require('mongoose');

const connectDB = require('../../config/db');
const logger = require('../../utils/logger');
const { seedDatabase } = require('../demo/demoSeed');
const { buildConfig, assertSandboxDatabase } = require('../config/environment');
const { createApp } = require('./createApp');

const createServer = async (options = {}) => {
  const config = options.config || buildConfig();
  assertSandboxDatabase(config);

  await connectDB({ mongoUri: config.database.mongoUrl, throwOnError: config.runtime.isSandbox });

  if (config.demo.seed) {
    await seedDatabase({ isProduction: config.runtime.isProduction });
  } else {
    logger.info('Demo seed data skipped');
  }

  const app = createApp({ config });
  const server = app.listen(config.server.port, config.server.host, () => {
    logger.info(`StreamNexus running on http://${config.server.host || 'localhost'}:${config.server.port}`);
  });

  const shutdown = async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await mongoose.disconnect();
  };

  return { app, server, shutdown };
};

module.exports = { createServer };
