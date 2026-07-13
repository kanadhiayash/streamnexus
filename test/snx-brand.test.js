const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const BRAND_ROOT = path.join(ROOT, 'public', 'brand');
const REGISTRY_PATH = path.join(ROOT, 'docs', 'qa', 'snx-validation-registry.json');

const REQUIRED_ASSETS = [
  'streamnexus-mark.svg',
  'streamnexus-mark-mono-light.svg',
  'streamnexus-mark-mono-dark.svg',
  'streamnexus-wordmark-dark.svg',
  'streamnexus-wordmark-light.svg',
  'streamnexus-lockup-horizontal-dark.svg',
  'streamnexus-lockup-horizontal-light.svg',
  'streamnexus-lockup-stacked-dark.svg',
  'streamnexus-lockup-stacked-light.svg',
  'favicon.svg',
  'favicon.ico',
  'apple-touch-icon.png',
  'app-icon-192.png',
  'app-icon-512.png',
  'app-icon-1024.png',
  'social-preview.png',
  'readme-banner.png',
  'brand.css',
  'brand-tokens.json',
  'site.webmanifest',
];

const SVG_ASSETS = REQUIRED_ASSETS.filter((file) => file.endsWith('.svg'));

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readPngDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  const signature = '89504e470d0a1a0a';
  assert.equal(buffer.subarray(0, 8).toString('hex'), signature, `${filePath} must be a PNG`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test('[SNX-BRAND-001] required production brand assets exist and are non-empty', () => {
  for (const relativePath of REQUIRED_ASSETS) {
    const filePath = path.join(BRAND_ROOT, relativePath);
    assert.equal(fs.existsSync(filePath), true, `missing brand asset: ${relativePath}`);
    assert.ok(fs.statSync(filePath).size > 0, `empty brand asset: ${relativePath}`);
  }
});

test('[SNX-BRAND-002] shared and auth surfaces contain no temporary SN placeholder', () => {
  const header = read(path.join(ROOT, 'views', 'partials', 'header.ejs'));
  const login = read(path.join(ROOT, 'views', 'login.ejs'));
  const signup = read(path.join(ROOT, 'views', 'signup.ejs'));

  assert.doesNotMatch(header, />\s*SN\s*</);
  assert.match(header, /\/brand\/streamnexus-lockup-horizontal-dark\.svg/);
  assert.match(header, /\/brand\/streamnexus-mark\.svg/);
  assert.match(login, /\/brand\/streamnexus-lockup-horizontal-dark\.svg/);
  assert.match(signup, /\/brand\/streamnexus-lockup-horizontal-dark\.svg/);
});

test('[SNX-BRAND-003] favicon manifest social and token references resolve from the layout', () => {
  const layout = read(path.join(ROOT, 'views', 'layout.ejs'));

  for (const reference of [
    '/brand/favicon.svg',
    '/brand/favicon.ico',
    '/brand/apple-touch-icon.png',
    '/brand/site.webmanifest',
    '/brand/social-preview.png',
    '/brand/brand.css',
  ]) {
    assert.match(layout, new RegExp(reference.replaceAll('/', '\\/').replace('.', '\\.')));
    const localPath = path.join(ROOT, 'public', reference);
    assert.equal(fs.existsSync(localPath), true, `layout reference does not resolve: ${reference}`);
  }

  assert.match(layout, /name="theme-color" content="#0F172A"/);
  assert.match(layout, /property="og:image" content="\/brand\/social-preview\.png"/);
});

test('[SNX-BRAND-004] approved dark and light variants are present', () => {
  for (const relativePath of [
    'streamnexus-mark-mono-light.svg',
    'streamnexus-mark-mono-dark.svg',
    'streamnexus-wordmark-dark.svg',
    'streamnexus-wordmark-light.svg',
    'streamnexus-lockup-horizontal-dark.svg',
    'streamnexus-lockup-horizontal-light.svg',
    'streamnexus-lockup-stacked-dark.svg',
    'streamnexus-lockup-stacked-light.svg',
  ]) {
    assert.equal(fs.existsSync(path.join(BRAND_ROOT, relativePath)), true, `missing variant: ${relativePath}`);
  }
});

test('[SNX-A11Y-001] logo links have an accessible StreamNexus home name', () => {
  const header = read(path.join(ROOT, 'views', 'partials', 'header.ejs'));
  const login = read(path.join(ROOT, 'views', 'login.ejs'));
  const signup = read(path.join(ROOT, 'views', 'signup.ejs'));

  assert.match(header, /aria-label="StreamNexus home"/);
  assert.match(login, /aria-label=['"]StreamNexus home['"]/);
  assert.match(signup, /aria-label=['"]StreamNexus home['"]/);
});

test('[SNX-SEC-002] committed SVG assets contain no scripts or unsafe external references', () => {
  for (const relativePath of SVG_ASSETS) {
    const svg = read(path.join(BRAND_ROOT, relativePath));
    assert.doesNotMatch(svg, /<script\b/i, `script element found in ${relativePath}`);
    assert.doesNotMatch(svg, /<foreignObject\b/i, `foreignObject found in ${relativePath}`);
    assert.doesNotMatch(svg, /(?:href|xlink:href)=["']https?:/i, `external reference found in ${relativePath}`);
    assert.doesNotMatch(svg, /javascript:/i, `javascript URL found in ${relativePath}`);
  }
});

test('[SNX-BRAND-005] application and social PNG dimensions match the production contract', () => {
  const expectations = new Map([
    ['app-icon-192.png', [192, 192]],
    ['app-icon-512.png', [512, 512]],
    ['app-icon-1024.png', [1024, 1024]],
    ['apple-touch-icon.png', [180, 180]],
    ['social-preview.png', [1200, 630]],
    ['readme-banner.png', [1600, 840]],
  ]);

  for (const [relativePath, expected] of expectations) {
    const dimensions = readPngDimensions(path.join(BRAND_ROOT, relativePath));
    assert.deepEqual([dimensions.width, dimensions.height], expected, `unexpected dimensions: ${relativePath}`);
  }
});

test('[SNX-BRAND-006] registry owns the approved brand validation identifiers', () => {
  const registry = JSON.parse(read(REGISTRY_PATH));
  const expectedIds = new Set([
    'SNX-BRAND-001',
    'SNX-BRAND-002',
    'SNX-BRAND-003',
    'SNX-BRAND-004',
    'SNX-BRAND-005',
    'SNX-BRAND-006',
    'SNX-A11Y-001',
    'SNX-SEC-002',
  ]);

  const owned = registry.validations.filter((entry) => entry.ownerIssue === 34);
  assert.deepEqual(new Set(owned.map((entry) => entry.id)), expectedIds);
});
