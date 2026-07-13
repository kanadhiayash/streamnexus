const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('[SNX-DATA-001] canonical domain vocabulary is complete', () => {
  const contract = read('docs/product-contract.md');

  assert.match(contract, /curated screening and access platform/i);
  assert.doesNotMatch(contract, /role-based digital entertainment rental prototype/i);

  for (const term of [
    'Title',
    'Program',
    'Collection',
    'Partner',
    'Release Window',
    'Access Policy',
    'Access Entitlement',
  ]) {
    assert.match(contract, new RegExp(`\\b${term}\\b`), `missing canonical term: ${term}`);
  }
});

test('[SNX-IA-001] public and authenticated surfaces are distinct', () => {
  const contract = read('docs/product-contract.md');
  const flows = read('docs/user-flows.md');
  const inventory = read('docs/current-state-inventory.md');
  const combined = `${contract}\n${flows}\n${inventory}`;

  for (const surface of ['Public', 'Member', 'Partner', 'Administrator']) {
    assert.match(combined, new RegExp(`\\b${surface}\\b`), `missing surface: ${surface}`);
  }

  assert.match(combined, /Issue #31 is superseded/i);
  assert.match(combined, /\/streamer\/\*/);
  assert.match(combined, /\/member\/\*/);
});

test('[SNX-ACCESS-001] entitlement states are defined', () => {
  const contract = read('docs/product-contract.md');
  const traceability = read('docs/traceability.md');
  const combined = `${contract}\n${traceability}`;

  for (const transition of [
    'requested -> active',
    'requested -> denied',
    'active -> returned',
    'active -> expired',
    'active -> cancelled',
  ]) {
    assert.match(combined, new RegExp(transition), `missing access transition: ${transition}`);
  }

  assert.match(combined, /Terminal states never return to active/i);
});

test('[SNX-PARTNER-001] partner ownership boundaries are defined', () => {
  const contract = read('docs/product-contract.md');
  const architecture = read('docs/architecture.md');
  const targetArchitecture = read('docs/architecture-target.md');
  const combined = `${contract}\n${architecture}\n${targetArchitecture}`;

  assert.match(combined, /Partner \| Organization or owner/i);
  assert.match(combined, /partner-owned titles/i);
  assert.match(combined, /Not implemented/i);
  assert.match(combined, /partner-facing read models/i);
});

test('[SNX-RELEASE-001] public claims remain evidence-bounded', () => {
  const contract = read('docs/product-contract.md');
  const adr = read('docs/decisions/ADR-0001-product-contract.md');
  const combined = `${contract}\n${adr}`;

  for (const prohibitedClaim of [
    'real users',
    'real partner participation',
    'real payment processing',
    'real media playback',
    'compliance certification',
    'production scale',
  ]) {
    assert.match(combined, new RegExp(prohibitedClaim, 'i'), `missing public-safe limit: ${prohibitedClaim}`);
  }
});
