require('dotenv').config();

const { createApp } = require('./src/app/createApp');
const { createServer } = require('./src/app/createServer');

const startServer = createServer;

if (require.main === module) {
  startServer().catch((error) => {
    const logger = require('./utils/logger');
    logger.error('Failed to start application:', error);
    process.exit(1);
  });
}

module.exports = { createApp, startServer };
