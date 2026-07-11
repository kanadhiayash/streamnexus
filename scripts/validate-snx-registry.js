const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'docs', 'qa', 'snx-validation-registry.json');

const APPROVED_AREAS = [
  'AUTH',
  'ACCESS',
  'CAPACITY',
  'FIXTURE',
  'IA',
  'UI',
  'A11Y',
  'SEC',
  'CI',
  'DATA',
  'PARTNER',
  'ADMIN',
  'RELEASE',
  'BRAND',
];

const REQUIRED_PROHIBITED_FIELDS = [
  'email',
  'password',
  'token',
  'cookie',
  'sessionId',
  'authorization',
];

function fail(message) {
  process.stderr.write(`SNX validation registry failed: ${message}\n`);
  process.exit(1);
}

function readRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    fail(`missing ${path.relative(ROOT, REGISTRY_PATH)}`);
  }

  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (error) {
    fail(`invalid JSON: ${error.message}`);
  }
}

function createFixtureIds(fixtureIds) {
  return Array.from(
    { length: fixtureIds.end - fixtureIds.start + 1 },
    (_, index) => {
      const value = fixtureIds.start + index;
      return `${fixtureIds.prefix}-${String(value).padStart(fixtureIds.padding, '0')}`;
    },
  );
}

const registry = readRegistry();

if (registry.productId !== 'SNX') {
  fail('productId must be SNX');
}

if (registry.schemaVersion !== '1.0.0') {
  fail('schemaVersion must be 1.0.0');
}

if (JSON.stringify(registry.approvedAreas) !== JSON.stringify(APPROVED_AREAS)) {
  fail('approvedAreas must match the canonical ordered SNX area list');
}

let validationPattern;
let testTitlePattern;
let auditEventPattern;

try {
  validationPattern = new RegExp(registry.validationPattern);
  testTitlePattern = new RegExp(registry.testTitlePattern);
  auditEventPattern = new RegExp(registry.diagnosticPolicy.auditEventPattern);
} catch (error) {
  fail(`invalid registry pattern: ${error.message}`);
}

if (!Array.isArray(registry.validations) || registry.validations.length === 0) {
  fail('validations must contain at least one entry');
}

const seenIds = new Set();
for (const entry of registry.validations) {
  if (!validationPattern.test(entry.id)) {
    fail(`invalid validation ID: ${entry.id}`);
  }

  if (seenIds.has(entry.id)) {
    fail(`duplicate validation ID: ${entry.id}`);
  }
  seenIds.add(entry.id);

  const area = entry.id.split('-')[1];
  if (entry.area !== area) {
    fail(`area mismatch for ${entry.id}`);
  }

  if (typeof entry.title !== 'string' || entry.title.trim() === '') {
    fail(`missing validation title: ${entry.id}`);
  }

  if (!Number.isInteger(entry.ownerIssue) || entry.ownerIssue <= 0) {
    fail(`invalid ownerIssue for ${entry.id}`);
  }

  if (!testTitlePattern.test(`[${entry.id}] ${entry.title}`)) {
    fail(`test title does not satisfy the canonical pattern: ${entry.id}`);
  }
}

const fixtureIds = registry.fixtureIds;
if (
  fixtureIds.prefix !== 'SNX-TITLE'
  || fixtureIds.start !== 1
  || fixtureIds.end !== 50
  || fixtureIds.padding !== 3
) {
  fail('fixtureIds must reserve SNX-TITLE-001 through SNX-TITLE-050');
}

const generatedFixtureIds = createFixtureIds(fixtureIds);
if (
  generatedFixtureIds.length !== 50
  || generatedFixtureIds[0] !== 'SNX-TITLE-001'
  || generatedFixtureIds.at(-1) !== 'SNX-TITLE-050'
  || new Set(generatedFixtureIds).size !== 50
) {
  fail('fixture ID range is incomplete or duplicated');
}

if (registry.ciCheckPrefix !== 'SNX / ') {
  fail('ciCheckPrefix must be "SNX / "');
}

if (!auditEventPattern.test('SNX.auth.login-succeeded')) {
  fail('auditEventPattern must accept canonical SNX audit events');
}

const prohibitedFields = new Set(registry.diagnosticPolicy.prohibitedFields);
for (const field of REQUIRED_PROHIBITED_FIELDS) {
  if (!prohibitedFields.has(field)) {
    fail(`diagnosticPolicy is missing prohibited field: ${field}`);
  }
}

process.stdout.write(
  `SNX validation registry passed: ${registry.validations.length} validations, ${generatedFixtureIds.length} reserved fixture IDs.\n`,
);
