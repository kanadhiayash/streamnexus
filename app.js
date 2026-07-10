require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const helmet = require('helmet');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const methodOverride = require('method-override');
const path = require('path');
const crypto = require('crypto');

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const streamerRoutes = require('./routes/streamer');
const contentRoutes = require('./routes/content');
const { seedDatabase } = require('./controllers/authController');
const contentService = require('./services/contentService');
const rentalService = require('./services/rentalService');
const { errorHandler, AppError } = require('./middleware/errorHandler');
const { csrfProtection } = require('./middleware/csrf');
const logger = require('./utils/logger');

const isProduction = process.env.NODE_ENV === 'production';
const runtimeProfile = process.env.APP_RUNTIME || (process.env.NODE_ENV === 'test' ? 'test' : isProduction ? 'production' : 'development');
const isSandbox = runtimeProfile === 'sandbox';
const mongoUrl = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/streamnexus';
const sessionSecret = process.env.SESSION_SECRET || (isSandbox ? crypto.randomBytes(32).toString('hex') : isProduction ? null : 'dev-session-secret-change-me');
const shouldSeedDemoData = process.env.SEED_DEMO_DATA === 'true' || (!isProduction && process.env.SEED_DEMO_DATA !== 'false');

if (!sessionSecret) {
  throw new Error('SESSION_SECRET is required when NODE_ENV=production');
}

const assertSandboxDatabase = () => {
  if (!isSandbox) return;

  const isLoopbackMongo =
    mongoUrl.startsWith('mongodb://127.0.0.1:') ||
    mongoUrl.startsWith('mongodb://localhost:') ||
    mongoUrl.includes('mongodb-memory-server');

  if (!isLoopbackMongo) {
    throw new Error('Sandbox runtime refuses remote MongoDB URIs');
  }
};

const createApp = () => {
  assertSandboxDatabase();
  const app = express();
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          imgSrc: ["'self'"],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(methodOverride('_method'));
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('/favicon.ico', (req, res) => res.status(204).end());
  app.use(expressLayouts);

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.set('layout', 'layout');

  const sessionConfig = {
    name: 'streamnexus.sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  };

  if (process.env.NODE_ENV !== 'test' && !isSandbox) {
    sessionConfig.store = MongoStore.create({
      mongoUrl,
      ttl: 14 * 24 * 60 * 60,
    });
  }

  app.use(session(sessionConfig));

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      runtime: runtimeProfile,
      database: isSandbox || process.env.NODE_ENV === 'test' ? 'ephemeral' : 'configured',
    });
  });

  app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
  });
  app.use(csrfProtection);

  app.use('/', authRoutes);
  app.use('/admin', adminRoutes);
  app.use('/streamer', streamerRoutes);
  app.use('/content', contentRoutes);

  app.get('/', async (req, res, next) => {
    if (req.session.user?.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    if (req.session.user?.role === 'streamer') {
      return res.redirect('/streamer/browse');
    }

    try {
      const contentResult = await contentService.getAvailableContent();
      const capacityResult = await rentalService.attachCapacityToContents(contentResult.data || []);
      const featured = capacityResult.success ? capacityResult.data.slice(0, 8) : [];
      res.render('index', { featured });
    } catch (error) {
      next(error);
    }
  });

  app.use((req, res, next) => {
    const error = new AppError(`Cannot find ${req.originalUrl} on this server!`, 404);
    next(error);
  });

  app.use(errorHandler);

  return app;
};

const startServer = async () => {
  assertSandboxDatabase();
  await connectDB({ throwOnError: isSandbox });

  if (shouldSeedDemoData) {
    await seedDatabase({ isProduction });
  } else {
    logger.info('Demo seed data skipped');
  }

  const PORT = process.env.PORT || 3000;
  const HOST = isSandbox ? '127.0.0.1' : process.env.HOST;
  const app = createApp();
  const server = app.listen(PORT, HOST, () => {
    logger.info(`StreamNexus running on http://${HOST || 'localhost'}:${PORT}`);
  });

  const shutdown = async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await require('mongoose').disconnect();
  };

  return { app, server, shutdown };
};

if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Failed to start application:', error);
    process.exit(1);
  });
}

module.exports = { createApp, startServer };
