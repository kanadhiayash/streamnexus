const { MongoMemoryServer } = require('mongodb-memory-server');

const DEFAULT_PORT = '3000';

async function startSandbox({ port = process.env.PORT || DEFAULT_PORT } = {}) {
  process.env.APP_RUNTIME = 'sandbox';
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  process.env.PORT = String(port);
  process.env.HOST = '127.0.0.1';
  process.env.SEED_DEMO_DATA = 'true';
  process.env.DEMO_ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'admin@gmail.com';
  process.env.DEMO_ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'admin';
  process.env.DEMO_STREAMER_EMAIL = process.env.DEMO_STREAMER_EMAIL || 'streamer@gmail.com';
  process.env.DEMO_STREAMER_PASSWORD = process.env.DEMO_STREAMER_PASSWORD || 'streamer';

  const mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri('streamnexus_sandbox');

  const { startServer } = require('../app');
  const runtime = await startServer();

  const shutdown = async () => {
    await runtime.shutdown();
    await mongoServer.stop();
  };

  return {
    ...runtime,
    mongoServer,
    url: `http://127.0.0.1:${port}`,
    credentials: {
      admin: {
        email: process.env.DEMO_ADMIN_EMAIL,
        password: process.env.DEMO_ADMIN_PASSWORD,
      },
      streamer: {
        email: process.env.DEMO_STREAMER_EMAIL,
        password: process.env.DEMO_STREAMER_PASSWORD,
      },
    },
    shutdown,
  };
}

if (require.main === module) {
  startSandbox()
    .then((runtime) => {
      process.stdout.write(`StreamNexus sandbox: ${runtime.url}\n`);
      process.stdout.write(`Admin: ${runtime.credentials.admin.email} / ${runtime.credentials.admin.password}\n`);
      process.stdout.write(`Streamer: ${runtime.credentials.streamer.email} / ${runtime.credentials.streamer.password}\n`);

      const stop = async () => {
        await runtime.shutdown();
        process.exit(0);
      };

      process.on('SIGINT', stop);
      process.on('SIGTERM', stop);
    })
    .catch((error) => {
      process.stderr.write(`${error.stack || error}\n`);
      process.exit(1);
    });
}

module.exports = { startSandbox };
