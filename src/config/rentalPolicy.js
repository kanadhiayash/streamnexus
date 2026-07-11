const RENTAL_POLICY = Object.freeze({
  version: 'rental-v1',
  durationDays: 45,
  maxActiveRentalsPerMember: 10,
  earlyReturnAllowed: true,
  currencyCode: 'CAD',
});

module.exports = { RENTAL_POLICY };
