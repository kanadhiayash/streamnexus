const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  DEMO_FIXTURE_COUNT,
  TITLE_FIXTURES,
  fixtureIds,
} = require('../src/demo/fixtureCatalog');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'docs', 'qa', 'snx-validation-registry.json');
const REPORT_PATH = path.join(ROOT, 'docs', 'qa', 's14-release-verification-report.md');
const CI_WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'ci.yml');
const CODEQL_WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'codeql.yml');
const RELEASE_WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'release-verify.yml');

const requiredReleaseIds = [
  'SNX-RELEASE-100',
  'SNX-RELEASE-101',
  'SNX-RELEASE-102',
  'SNX-RELEASE-103',
  'SNX-RELEASE-104',
  'SNX-CI-100',
  'SNX-A11Y-300',
  'SNX-SEC-200',
  'SNX-DATA-100',
];

function readText(filePath) {
  assert.equal(fs.existsSync(filePath), true, `${path.relative(ROOT, filePath)} must exist`);
  return fs.readFileSync(filePath, 'utf8');
}

function readRegistry() {
  return JSON.parse(readText(REGISTRY_PATH));
}

test('[SNX-RELEASE-100] complete validation registry passes', () => {
  const registry = readRegistry();
  const ids = registry.validations.map(entry => entry.id);

  for (const id of requiredReleaseIds) {
    assert.ok(ids.includes(id), `${id} must be registered`);
  }
  assert.equal(new Set(ids).size, ids.length);
});

test('[SNX-RELEASE-101] final dev commit is reproducibly verified', () => {
  const report = readText(REPORT_PATH);

  for (const command of [
    'npm ci',
    'npm run snx:validate',
    'npm run snx:test',
    'npm run test:ejs',
    'npm run sandbox:smoke',
    'npm run test:load',
    'npm audit --audit-level=moderate',
    'npm run scan:secrets',
    'npm run release:verify',
    'git diff --check',
  ]) {
    assert.match(report, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(report, /Base `dev` commit: `[a-f0-9]{40}`/);
});

test('[SNX-RELEASE-102] 50-title fixture count and identity pass', () => {
  const ids = fixtureIds();

  assert.equal(DEMO_FIXTURE_COUNT, 50);
  assert.equal(TITLE_FIXTURES.length, 50);
  assert.equal(ids.length, 50);
  assert.equal(ids[0], 'SNX-TITLE-001');
  assert.equal(ids.at(-1), 'SNX-TITLE-050');
  assert.equal(new Set(ids).size, 50);
  for (const fixture of TITLE_FIXTURES) {
    assert.equal(fixture.rentalLimit, 20);
    assert.equal(fixture.licenceLimit, 20);
  }
});

test('[SNX-RELEASE-103] all role journeys pass browser acceptance', () => {
  const report = readText(REPORT_PATH);

  for (const role of ['guest', 'member', 'partner', 'admin', 'system']) {
    assert.match(report, new RegExp(role));
  }
  assert.match(report, /route/i);
});

test('[SNX-RELEASE-104] capture assets reference the verified commit', () => {
  const report = readText(REPORT_PATH);
  const registry = readRegistry();
  const entry = registry.validations.find(validation => validation.id === 'SNX-RELEASE-104');

  assert.equal(entry.status, 'deferred-until-yash-review');
  assert.match(report, /No final portfolio screenshots, video files, or thumbnails were captured/);
  assert.match(report, /capture from the verified commit/);
});

test('[SNX-CI-100] final required checks are green', () => {
  const report = readText(REPORT_PATH);
  const workflows = [
    readText(CI_WORKFLOW_PATH),
    readText(CODEQL_WORKFLOW_PATH),
    readText(RELEASE_WORKFLOW_PATH),
  ].join('\n');

  assert.match(report, /SNX \/ verify/);
  assert.match(report, /SNX \/ codeql/);
  assert.match(report, /CodeQL/);
  assert.match(workflows, /name: SNX \/ verify/);
  assert.match(workflows, /name: SNX \/ codeql/);
});

test('[SNX-A11Y-300] manual accessibility acceptance passes', () => {
  const report = readText(REPORT_PATH);
  const registry = readRegistry();
  const entry = registry.validations.find(validation => validation.id === 'SNX-A11Y-300');

  assert.equal(entry.status, 'deferred-until-yash-review');
  for (const requirement of ['keyboard', 'focus', 'status', 'label', 'reduced-motion']) {
    assert.match(report, new RegExp(requirement, 'i'));
  }
});

test('[SNX-SEC-200] no unresolved high-severity security finding remains', () => {
  const report = readText(REPORT_PATH);

  assert.match(report, /npm audit --audit-level=moderate/);
  assert.match(report, /npm run scan:secrets/);
  assert.match(report, /no high-severity finding left unresolved/i);
});

test('[SNX-DATA-100] reconciliation and fixture reset are repeatable', () => {
  const report = readText(REPORT_PATH);

  assert.match(report, /Fixture reset/i);
  assert.match(report, /fixture idempotency/i);
  assert.match(report, /capacity reconciliation/i);
});
