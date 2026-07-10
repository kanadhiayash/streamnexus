require('dotenv').config();

const mongoose = require('mongoose');

const connectDB = require('../config/db');
const { buildConfig, assertSandboxDatabase } = require('../src/config/environment');
const { inspectDataContracts } = require('../src/infrastructure/migrations/dataContractsMigration');

const main = async () => {
  const args = new Set(process.argv.slice(2));
  const dryRun = !args.has('--write');

  if (!dryRun) {
    throw new Error('S4 migration supports dry run only. Write mode is intentionally disabled.');
  }

  const config = buildConfig();
  assertSandboxDatabase(config);
  await connectDB({ mongoUri: config.database.mongoUrl, throwOnError: true });

  const report = await inspectDataContracts({ dryRun });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
};

main()
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
