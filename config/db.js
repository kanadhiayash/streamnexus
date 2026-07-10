const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async (options = {}) => {
  const mongoUri = options.mongoUri || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/streamnexus';

  try {
    const conn = await mongoose.connect(mongoUri);
    logger.info(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error('MongoDB connection failed', error);
    if (options.throwOnError) {
      throw error;
    }
    process.exit(1);
  }
};

module.exports = connectDB;
