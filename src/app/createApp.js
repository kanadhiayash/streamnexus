const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const helmet = require('helmet');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const methodOverride = require('method-override');
const path = require('path');

const authRoutes = require('../../routes/auth');
const adminRoutes = require('../../routes/admin');
const streamerRoutes = require('../../routes/streamer');
const contentRoutes = require('../../routes/content');
const memberRoutes = require('../../routes/member');
const partnerRoutes = require('../../routes/partner');
const publicRoutes = require('../../routes/public');
const contentService = require('../../services/contentService');
const rentalService = require('../../services/rentalService');
const { errorHandler, AppError } = require('../../middleware/errorHandler');
const { csrfProtection } = require('../../middleware/csrf');
const { queryLengthGuard } = require('../../middleware/requestGuards');
const { buildConfig, assertSandboxDatabase } = require('../config/environment');
const { getRoleDestination } = require('../modules/auth/roleDestinations');

const registerMiddleware = (app, config) => {
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
          upgradeInsecureRequests: config.runtime.isProduction ? [] : null,
        },
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: config.security.bodyLimit }));
  app.use(express.json({ limit: config.security.bodyLimit }));
  app.use(queryLengthGuard(config.security.queryMaxLength));
  app.use(methodOverride('_method'));
  app.use(express.static(path.join(__dirname, '..', '..', 'public')));
  app.get('/favicon.ico', (req, res) => res.status(204).end());
  app.use(expressLayouts);

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', '..', 'views'));
  app.set('layout', 'layout');

  const sessionConfig = {
    name: config.session.name,
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.runtime.isProduction,
      maxAge: config.session.cookieMaxAgeMs,
    },
  };

  if (!config.runtime.isTest && !config.runtime.isSandbox) {
    sessionConfig.store = MongoStore.create({
      mongoUrl: config.database.mongoUrl,
      ttl: config.session.ttlSeconds,
    });
  }

  app.use(session(sessionConfig));

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      runtime: config.runtime.profile,
      database: config.runtime.isSandbox || config.runtime.isTest ? 'ephemeral' : 'configured',
    });
  });

  app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
  });
  app.use(csrfProtection);
};

const registerRoutes = (app) => {
  app.use('/', authRoutes);
  app.use('/', memberRoutes);
  app.use('/partner', partnerRoutes);
  app.use('/', publicRoutes);
  app.use('/admin', adminRoutes);
  app.use('/streamer', streamerRoutes);
  app.use('/content', contentRoutes);

  app.get('/', async (req, res, next) => {
    if (req.session.user) {
      const destination = getRoleDestination(req.session.user.role);
      if (destination !== '/') {
        return res.redirect(destination);
      }
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
};

const createApp = (options = {}) => {
  const config = options.config || buildConfig();
  assertSandboxDatabase(config);

  const app = express();
  app.disable('x-powered-by');
  registerMiddleware(app, config);
  registerRoutes(app);
  return app;
};

module.exports = { createApp, registerMiddleware, registerRoutes };
