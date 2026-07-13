const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'docs', 'qa', 'snx-validation-registry.json');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'ci.yml');
const CODEQL_WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'codeql.yml');
const RELEASE_WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'release-verify.yml');

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

  const validationPattern = new RegExp(registry.validationPattern);
  for (const entry of registry.validations) {
    assert.ok(validationPattern.test(entry.id), `invalid validation ID: ${entry.id}`);
    const area = entry.id.split('-')[1];
    assert.ok(allowedAreas.has(area), `unsupported SNX area: ${area}`);
    assert.equal(entry.area, area, `area mismatch: ${entry.id}`);
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
  assert.match(workflow, /name: SNX \/ verify/);
  assert.match(workflow, /name: SNX \/ Validate identifiers/);
  assert.match(workflow, /run: npm run snx:validate/);
});

test('[SNX-CI-010] PR workflow runs all required gates', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  for (const required of [
    'npm ci',
    'npm run test:syntax',
    'npm run snx:validate',
    'npm run snx:test',
    'npm run test:ejs',
    'npm run sandbox:smoke',
    'npm run fixtures:demo',
    'npm audit --audit-level=moderate',
    'npm run scan:secrets',
    'npm run test:load',
    'npm run release:verify',
    'git diff --check',
  ]) {
    assert.match(workflow, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('[SNX-CI-011] workflow names use SNX prefix', () => {
  for (const workflowPath of [WORKFLOW_PATH, CODEQL_WORKFLOW_PATH, RELEASE_WORKFLOW_PATH]) {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const nameLines = workflow
      .split('\n')
      .filter(line => /^( {0}| {4}| {6})name: /.test(line));
    assert.ok(nameLines.length > 0, `${workflowPath} must contain name lines`);
    for (const line of nameLines) {
      assert.match(line.trim(), /^name: SNX \//);
    }
  }
});

test('[SNX-CI-012] third-party actions are SHA-pinned', () => {
  for (const workflowPath of [WORKFLOW_PATH, CODEQL_WORKFLOW_PATH, RELEASE_WORKFLOW_PATH]) {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const usesLines = workflow.split('\n').filter(line => line.trim().startsWith('uses: '));
    assert.ok(usesLines.length > 0, `${workflowPath} must use pinned actions`);
    for (const line of usesLines) {
      assert.match(line.trim(), /@[a-f0-9]{40}$/);
      assert.doesNotMatch(line.trim(), /@(v\d+|main|master)$/);
    }
  }
});

test('[SNX-CI-013] workflow permissions are least-privilege', () => {
  const ciWorkflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  const releaseWorkflow = fs.readFileSync(RELEASE_WORKFLOW_PATH, 'utf8');
  const codeqlWorkflow = fs.readFileSync(CODEQL_WORKFLOW_PATH, 'utf8');

  assert.match(ciWorkflow, /permissions:\n  contents: read/);
  assert.match(releaseWorkflow, /permissions:\n  contents: read/);
  assert.match(codeqlWorkflow, /permissions:\n  contents: read\n  security-events: write/);
  assert.doesNotMatch(ciWorkflow, /contents: write|actions: write|id-token: write/);
  assert.doesNotMatch(releaseWorkflow, /contents: write|actions: write|id-token: write/);
});

test('[SNX-CI-014] superseded runs are cancelled', () => {
  for (const workflowPath of [WORKFLOW_PATH, CODEQL_WORKFLOW_PATH, RELEASE_WORKFLOW_PATH]) {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    assert.match(workflow, /concurrency:/);
    assert.match(workflow, /cancel-in-progress: true/);
  }
});

test('[SNX-CI-015] untrusted PR code cannot reach privileged context', () => {
  for (const workflowPath of [WORKFLOW_PATH, CODEQL_WORKFLOW_PATH, RELEASE_WORKFLOW_PATH]) {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    assert.doesNotMatch(workflow, /pull_request_target/);
  }
});

test('[SNX-CI-016] release workflow accepts dev as source and main as target', () => {
  const workflow = fs.readFileSync(RELEASE_WORKFLOW_PATH, 'utf8');

  assert.match(workflow, /pull_request:\n    branches: \[main\]/);
  assert.match(workflow, /github\.event\.pull_request\.head\.ref == 'dev'/);
  assert.match(workflow, /run: npm run release:verify/);
});

test('[SNX-SEC-120] workflow artifacts contain no secrets', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  const artifactBlock = workflow.slice(workflow.indexOf('SNX / Write verification artifact'));

  assert.match(artifactBlock, /verification-summary\.md/);
  assert.doesNotMatch(artifactBlock, /\$env|printenv|process\.env|secrets\./i);
  assert.match(artifactBlock, /no environment values, secrets, tokens, cookies, or private payloads/);
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

  assert.match(registry.diagnosticPolicy.auditEventPattern, /^\^SNX\\\./);
});
