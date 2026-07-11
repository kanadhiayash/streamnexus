const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'docs', 'qa', 'snx-validation-registry.json');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'ci.yml');

function readJson(filePath, label) {
  assert.equal(fs.existsSync(filePath), true, `${label} must exist`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

test('[SNX-CI-001] validation registry contains unique IDs in approved areas', () => {
  const registry = readJson(REGISTRY_PATH, 'SNX validation registry');
  const allowedAreas = new Set([
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
  ]);

  assert.equal(registry.productId, 'SNX');
  assert.ok(Array.isArray(registry.validations));

  const ids = registry.validations.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'validation IDs must be unique');

  for (const entry of registry.validations) {
    const match = /^SNX-([A-Z]+)-(\d{3})$/.exec(entry.id);
    assert.ok(match, `invalid validation ID: ${entry.id}`);
    assert.ok(allowedAreas.has(match[1]), `unsupported SNX area: ${match[1]}`);
    assert.equal(typeof entry.title, 'string');
    assert.ok(entry.title.trim().length > 0, `validation title is required: ${entry.id}`);
  }
});

test('[SNX-CI-002] npm SNX aliases resolve to canonical gates', () => {
  const packageJson = readJson(PACKAGE_PATH, 'package.json');

  assert.equal(packageJson.scripts['snx:test'], 'npm test');
  assert.equal(packageJson.scripts['snx:validate'], 'node scripts/validate-snx-registry.js');
  assert.equal(
    packageJson.scripts['snx:verify'],
    'npm run snx:validate && npm run release:verify',
  );
});

test('[SNX-CI-003] CI workflow uses SNX display identity and validates identifiers', () => {
  assert.equal(fs.existsSync(WORKFLOW_PATH), true, 'CI workflow must exist');
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  assert.match(workflow, /^name: SNX \/ CI$/m);
  assert.match(workflow, /branches: \[main, dev\]/);
  assert.match(workflow, /name: SNX \/ Validate identifiers/);
  assert.match(workflow, /run: npm run snx:validate/);
});

test('[SNX-FIXTURE-001] fixture range reserves exactly SNX-TITLE-001 through SNX-TITLE-050', () => {
  const registry = readJson(REGISTRY_PATH, 'SNX validation registry');
  const fixtureIds = createFixtureIds(registry.fixtureIds);

  assert.equal(registry.fixtureIds.prefix, 'SNX-TITLE');
  assert.equal(registry.fixtureIds.start, 1);
  assert.equal(registry.fixtureIds.end, 50);
  assert.equal(registry.fixtureIds.padding, 3);
  assert.equal(fixtureIds.length, 50);
  assert.equal(fixtureIds[0], 'SNX-TITLE-001');
  assert.equal(fixtureIds.at(-1), 'SNX-TITLE-050');
  assert.equal(new Set(fixtureIds).size, 50);
});

test('[SNX-SEC-001] diagnostic policy excludes sensitive payload fields', () => {
  const registry = readJson(REGISTRY_PATH, 'SNX validation registry');
  const prohibited = new Set(registry.diagnosticPolicy.prohibitedFields);

  for (const requiredField of [
    'email',
    'password',
    'token',
    'cookie',
    'sessionId',
    'authorization',
  ]) {
    assert.ok(prohibited.has(requiredField), `missing prohibited field: ${requiredField}`);
  }

  assert.match(registry.diagnosticPolicy.auditEventPattern, '^SNX\\.');
}