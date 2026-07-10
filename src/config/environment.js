const crypto = require('crypto');

const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/streamnexus';

const resolveRuntimeProfile = (env = process.env) => {
  if (env.APP_RUNTIME) return env.APP_RUNTIME;
  if (env.NODE_ENV === 'test') return 'test';
  if (env.NODE_ENV === 'production') return 'production';
  return 'development';
};

const buildConfig = (env = process.env) => {
  const nodeEnv = env.NODE_ENV || 'development';
  const runtimeProfile = resolveRuntimeProfile(env);
  const isProduction = nodeEnv === 'production';
  const isSandbox = runtimeProfile === 'sandbox';
  const mongoUrl = env.MONGO_URI || DEFAULT_MONGO_URI;
  const sessionSecret = env.SESSION_SECRET || (
    isSandbox ? crypto.randomBytes(32).toString('hex') : isProduction ? null : 'dev-session-secret-change-me'
  );

  if (!sessionSecret) {
    throw new Error('SESSION_SECRET is required when NODE_ENV=production');
  }

  return {
    runtime: {
      profile: runtimeProfile,
      nodeEnv,
      isProduction,
      isSandbox,
      isTest: nodeEnv === 'test',
    },
    server: {
      port: env.PORT || 3000,
      host: isSandbox ? '127.0.0.1' : env.HOST,
    },
    database: {
      mongoUrl,
    },
    session: {
      name: 'streamnexus.sid',
      secret: sessionSecret,
      ttlSeconds: 14 * 24 * 60 * 60,
      cookieMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
    },
    demo: {
      seed: env.SEED_DEMO_DATA === 'true' || (!isProduction && env.SEED_DEMO_DATA !== 'false'),
    },
  };
};

const assertSandboxDatabase = (config) => {
  if (!config.runtime.isSandbox) return;

  const mongoUrl = config.database.mongoUrl;
  const isLoopbackMongo =
    mongoUrl.startsWith('mongodb://127.0.0.1:') ||
    mongoUrl.startsWith('mongodb://localhost:') ||
    mongoUrl.includes('mongodb-memory-server');

  if (!isLoopbackMongo) {
    throw new Error('Sandbox runtime refuses remote MongoDB URIs');
  }
};

module.exports = { buildConfig, assertSandboxDatabase };
