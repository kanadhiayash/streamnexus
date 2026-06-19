const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const getTimestamp = () => {
  const now = new Date();
  return now.toISOString();
};

const log = (level, message, error = null) => {
  const timestamp = getTimestamp();
  const logMessage = error ? `${timestamp} [${level}] ${message}: ${error.stack || error}` : `${timestamp} [${level}] ${message}`;

  process.stdout.write(`${logMessage}\n`);

  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const logFile = path.join(logsDir, `${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logMessage + '\n', { encoding: 'utf8' });
};

module.exports = {
  info: (message) => log('INFO', message),
  error: (message, error) => log('ERROR', message, error),
  warn: (message) => log('WARN', message),
  debug: (message) => log('DEBUG', message),
};
