const Content = require('../../../models/Content');
const Rental = require('../../../models/Rental');
const SavedTitle = require('../../../models/SavedTitle');
const User = require('../../../models/User');
const {
  mapRentalToV2,
  mapTitleToV2,
  mapUserToV2,
} = require('../../modules/data/compatibility');

const createEmptyReport = () => ({
  dryRun: true,
  users: { scanned: 0, wouldBackfill: 0, ambiguous: 0 },
  titles: { scanned: 0, wouldBackfill: 0, ambiguous: 0 },
  rentals: { scanned: 0, wouldBackfill: 0, ambiguous: 0 },
  savedTitles: { scannedUsers: 0, wouldUpsert: 0 },
  warnings: [],
});

const inspectDataContracts = async ({ dryRun = true } = {}) => {
  const report = createEmptyReport();
  report.dryRun = dryRun;

  const users = await User.find({}).lean();
  report.users.scanned = users.length;
  for (const user of users) {
    const mapped = mapUserToV2(user);
    if (!mapped.email || !mapped.passwordHash || !mapped.role) {
      report.users.ambiguous += 1;
      continue;
    }
    if (user.schemaVersion !== 2 || user.role === 'streamer' || !user.status || !user.sessionVersion) {
      report.users.wouldBackfill += 1;
    }
    if (Array.isArray(user.shortlist)) {
      report.savedTitles.scannedUsers += 1;
      report.savedTitles.wouldUpsert += user.shortlist.length;
    }
  }

  const activeRentalCounts = await Rental.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: '$contentId', count: { $sum: 1 } } },
  ]);
  const activeCountMap = new Map(activeRentalCounts.map(item => [item._id.toString(), item.count]));

  const titles = await Content.find({}).lean();
  report.titles.scanned = titles.length;
  for (const title of titles) {
    const mapped = mapTitleToV2(title, activeCountMap.get(title._id.toString()) || 0);
    if (mapped.rentalPriceMinor === null) {
      report.titles.ambiguous += 1;
      report.warnings.push('At least one title has an unmappable price.');
      continue;
    }
    if (title.schemaVersion !== 2 || !title.slug || title.rentalPriceMinor === null || !title.lifecycle) {
      report.titles.wouldBackfill += 1;
    }
  }

  const rentals = await Rental.find({}).lean();
  report.rentals.scanned = rentals.length;
  for (const rental of rentals) {
    const title = titles.find(item => item._id.toString() === rental.contentId?.toString());
    const mapped = mapRentalToV2(rental, title);
    if (!mapped.publicReference || !mapped.titleId || !mapped.startedAt || !mapped.expiresAt) {
      report.rentals.ambiguous += 1;
      continue;
    }
    if (rental.schemaVersion !== 2 || !rental.publicReference || !rental.startedAt || !rental.titleId) {
      report.rentals.wouldBackfill += 1;
    }
  }

  if (!dryRun) {
    throw new Error('Write migration is not enabled in S4. Use dry run only.');
  }

  report.savedTitles.current = await SavedTitle.countDocuments();
  return report;
};

module.exports = { inspectDataContracts };
