const contentService = require('../../../services/contentService');
const rentalService = require('../../../services/rentalService');
const { RENTAL_POLICY } = require('../../config/rentalPolicy');

const createAdminUseCases = ({
  catalog = contentService,
  rentals = rentalService,
} = {}) => ({
  async loadDashboard() {
    const contentResult = await catalog.getAllContent();
    const rentalsResult = await rentals.getAllRentals();
    const statsResult = await rentals.getRentalStats();

    if (!contentResult.success || !rentalsResult.success) {
      return {
        success: false,
        error: 'Failed to load dashboard',
        data: {
          contents: [],
          rentals: [],
          stats: { totalRentals: 0, activeRentals: 0, completedRentals: 0 },
        },
      };
    }

    const capacityResult = await rentals.attachCapacityToContents(contentResult.data || []);
    const contents = capacityResult.success ? capacityResult.data : contentResult.data || [];
    const capacityStats = contents.reduce((totals, item) => {
      const capacity = item.capacity || {
        rentalLimit: item.rentalLimit || RENTAL_POLICY.defaultTitleLicenceLimit,
        activeRentals: 0,
        remaining: item.rentalLimit || RENTAL_POLICY.defaultTitleLicenceLimit,
      };
      totals.totalSlots += capacity.rentalLimit;
      totals.activeSlots += capacity.activeRentals;
      totals.remainingSlots += capacity.remaining;
      return totals;
    }, { totalSlots: 0, activeSlots: 0, remainingSlots: 0 });

    return {
      success: true,
      data: {
        contents,
        rentals: rentalsResult.data || [],
        stats: { ...(statsResult.data || {}), ...capacityStats },
      },
    };
  },

  async loadContentList() {
    return catalog.getAllContent();
  },
});

module.exports = { createAdminUseCases };
