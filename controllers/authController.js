const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Content = require('../models/Content');
const { catchAsync } = require('../middleware/errorHandler');
const { validateEmail, validatePassword } = require('../utils/validators');
const logger = require('../utils/logger');

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

const seedDatabase = async ({ isProduction = process.env.NODE_ENV === 'production' } = {}) => {
  try {
    const { adminEmail, adminPassword, streamerEmail, streamerPassword } = getDemoUsers(isProduction);
    const existingAdmin = await User.findOne({ email: adminEmail });
    const existingStreamer = await User.findOne({ email: streamerEmail });

    if (!existingAdmin) {
      const hash = await bcrypt.hash(adminPassword, 10);
      await User.create({
        email: adminEmail,
        password: hash,
        role: 'admin',
        shortlist: [],
        rented: [],
      });
      logger.info('Admin user seeded');
    }

    if (!existingStreamer) {
      const hash = await bcrypt.hash(streamerPassword, 10);
      await User.create({
        email: streamerEmail,
        password: hash,
        role: 'streamer',
        shortlist: [],
        rented: [],
      });
      logger.info('Streamer user seeded');
    }

    const count = await Content.countDocuments();
    if (count < 10) {
      const sampleContent = [
        {
          title: 'Neon Chase',
          type: 'movie',
          description: 'Fast-paced thriller with neon cityscapes and high-stakes action',
          price: 4.99,
          image: '/images/neon-chase.jpg',
          available: true,
          rating: 8.2,
          genre: 'Thriller',
          duration: '2h 15m',
          cast: 'Keanu Reeves, Zoe Kravitz',
        },
        {
          title: 'Space Odyssey',
          type: 'movie',
          description: 'Deep space drama and survival in the vastness of the universe',
          price: 5.99,
          image: '/images/space-odyssey.jpg',
          available: true,
          rating: 8.8,
          genre: 'Sci-Fi',
          duration: '2h 45m',
          cast: 'Matthew McConaughey, Anne Hathaway',
        },
        {
          title: 'Cyber City',
          type: 'tv',
          description: 'Futuristic crime anthology set in neon-lit metropolis',
          price: 2.99,
          image: '/images/cyber-city.jpg',
          available: true,
          rating: 8.0,
          genre: 'Crime',
          duration: '45m per episode',
          cast: 'Oscar Isaac, Tatiana Maslany',
        },
        {
          title: 'Wild Frontier',
          type: 'tv',
          description: 'Adventure series across untamed lands and undiscovered territories',
          price: 3.99,
          image: '/images/wild-frontier.jpg',
          available: true,
          rating: 7.9,
          genre: 'Adventure',
          duration: '50m per episode',
          cast: 'Pedro Pascal, Bella Ramsey',
        },
        {
          title: 'Mystic Falls',
          type: 'movie',
          description: 'Supernatural romantic mystery in a small mountain town',
          price: 4.49,
          image: '/images/mystic-falls.jpg',
          available: true,
          rating: 7.5,
          genre: 'Romance',
          duration: '2h',
          cast: 'Timothée Chalamet, Florence Pugh',
        },
        {
          title: 'Heist Masters',
          type: 'movie',
          description: 'Heist in a high-tech vault with a crew of specialized thieves',
          price: 6.49,
          image: '/images/heist-masters.jpg',
          available: true,
          rating: 8.4,
          genre: 'Crime',
          duration: '2h 30m',
          cast: 'Ryan Gosling, Margot Robbie',
          trending: true,
        },
        {
          title: 'Quantum Dawn',
          type: 'tv',
          description: 'Sci-fi thriller with parallel timelines and quantum mechanics',
          price: 3.49,
          image: '/images/quantum-dawn.jpg',
          available: true,
          rating: 8.7,
          genre: 'Sci-Fi',
          duration: '55m per episode',
          cast: 'Olivia Wilde, Rami Malek',
          trending: true,
        },
        {
          title: 'Forgotten Legends',
          type: 'movie',
          description: 'Epic historical drama spanning continents and centuries',
          price: 5.49,
          image: '/images/forgotten-legends.jpg',
          available: true,
          rating: 8.1,
          genre: 'Drama',
          duration: '3h',
          cast: 'Cillian Murphy, Emily Blunt',
        },
        {
          title: 'Aqua Squad',
          type: 'tv',
          description: 'Underwater action and family adventure with cutting-edge visuals',
          price: 2.49,
          image: '/images/aqua-squad.jpg',
          available: true,
          rating: 7.6,
          genre: 'Adventure',
          duration: '40m per episode',
          cast: 'Jason Momoa, Amber Heard',
        },
        {
          title: 'Midnight Code',
          type: 'movie',
          description: 'Hackers vs corporates in a battle for digital supremacy',
          price: 4.79,
          image: '/images/midnight-code.jpg',
          available: true,
          rating: 8.3,
          genre: 'Thriller',
          duration: '2h 10m',
          cast: 'Saoirse Ronan, Daniel Kaluuya',
          trending: true,
        },
      ];

      await Content.insertMany(sampleContent);
      logger.info('Sample content seeded');
    }
    logger.info('Seed data ensured');
  } catch (error) {
    logger.error('Error seeding database:', error);
    throw error;
  }
};

const showLogin = (req, res) => {
  res.render('login', { message: null, error: null });
};

const showSignup = (req, res) => {
  res.render('signup', { message: null, error: null, form: {} });
};

const signup = catchAsync(async (req, res) => {
  const { email, password, confirmPassword } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();
  const form = { email: normalizedEmail || '' };

  if (!normalizedEmail || !password?.trim() || !confirmPassword?.trim()) {
    return res.status(400).render('signup', {
      message: null,
      error: 'Email, password, and confirmation are required',
      form,
    });
  }

  if (!validateEmail(normalizedEmail)) {
    return res.status(400).render('signup', {
      message: null,
      error: 'Invalid email format',
      form,
    });
  }

  if (!validatePassword(password)) {
    return res.status(400).render('signup', {
      message: null,
      error: 'Password must be at least 3 characters for the local demo',
      form,
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).render('signup', {
      message: null,
      error: 'Passwords do not match',
      form,
    });
  }

  const existingUser = await User.findOne({ email: normalizedEmail }).lean();
  if (existingUser) {
    return res.status(409).render('signup', {
      message: null,
      error: 'An account with that email already exists',
      form,
    });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    email: normalizedEmail,
    password: hash,
    role: 'streamer',
    shortlist: [],
    rented: [],
  });

  req.session.user = {
    id: user._id,
    email: user.email,
    role: user.role,
  };

  logger.info(`Streamer account created: ${normalizedEmail}`);
  res.redirect('/streamer/browse?signedup=true');
});

const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password?.trim()) {
    return res.status(400).render('login', { message: null, error: 'Email and password are required' });
  }

  if (!validateEmail(email)) {
    return res.status(400).render('login', { message: null, error: 'Invalid email format' });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    logger.warn(`Login attempt with non-existent email: ${email}`);
    return res.status(401).render('login', { message: null, error: 'Invalid email or password' });
  }

  const matched = await bcrypt.compare(password, user.password);
  if (!matched) {
    logger.warn(`Failed login attempt for: ${email}`);
    return res.status(401).render('login', { message: null, error: 'Invalid email or password' });
  }

  req.session.user = {
    id: user._id,
    email: user.email,
    role: user.role,
  };

  logger.info(`User logged in: ${email} (${user.role})`);

  if (user.role === 'admin') {
    return res.redirect('/admin/dashboard');
  }
  return res.redirect('/streamer/browse');
});

const logout = catchAsync(async (req, res) => {
  const userEmail = req.session.user?.email;
  req.session.destroy((err) => {
    if (err) {
      logger.error('Error destroying session:', err);
      return res.status(500).render('error', { message: 'Failed to logout' });
    }
    logger.info(`User logged out: ${userEmail}`);
    res.redirect('/login');
  });
});

module.exports = { seedDatabase, showLogin, showSignup, signup, login, logout };
