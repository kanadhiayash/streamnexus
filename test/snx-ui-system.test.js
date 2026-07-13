const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CSS_PATH = path.join(ROOT, 'public', 'css', 'styles.css');
const BRAND_TOKENS_PATH = path.join(ROOT, 'public', 'brand', 'brand-tokens.json');
const DOC_PATH = path.join(ROOT, 'docs', 'brand', 'streamnexus-ui-system.md');
const REGISTRY_PATH = path.join(ROOT, 'docs', 'qa', 'snx-validation-registry.json');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

function assertCssContains(css, pattern, message) {
  assert.match(css, pattern, message);
}

test('[SNX-BRAND-010] approved palette maps to semantic tokens', () => {
  const css = read(CSS_PATH).toLowerCase();
  const brand = readJson(BRAND_TOKENS_PATH);

  assertCssContains(css, /--color-brand-primary:\s*var\(--snx-color-violet\)/);
  assertCssContains(css, /--color-brand-accent:\s*var\(--snx-color-cyan\)/);
  assertCssContains(css, /--color-bg-canvas:/);
  assertCssContains(css, /--color-text-primary:/);

  for (const value of Object.values(brand.colors)) {
    assert.ok(css.includes(value.toLowerCase()), `approved brand value must be mapped: ${value}`);
  }
});

test('[SNX-UI-100] shared buttons render all states', () => {
  const css = read(CSS_PATH);

  for (const className of [
    '.btn-primary',
    '.btn-secondary',
    '.btn-success',
    '.btn-danger',
    '.btn-sm',
    '.btn-block',
  ]) {
    assertCssContains(css, new RegExp(className.replace('.', '\\.')));
  }

  assertCssContains(css, /button:disabled,\n\.btn:disabled/);
  assertCssContains(css, /\.btn\.loading,\n\.btn\[aria-busy="true"\]/);
  assert.doesNotMatch(css, /font-weight:\s*(650|720|750|760|850)\b/);
});

test('[SNX-UI-101] shared form controls render validation states', () => {
  const css = read(CSS_PATH);
  const formTemplate = read(path.join(ROOT, 'views', 'admin', 'content-form.ejs'));

  assertCssContains(css, /input\.error,\ntextarea\.error,\nselect\.error,\n\[aria-invalid="true"\]/);
  assertCssContains(css, /\.form-panel/);
  assertCssContains(css, /\.form-fieldset/);
  assertCssContains(css, /\.form-help/);
  assertCssContains(css, /\.form-check/);
  assertCssContains(css, /input\[type="checkbox"\][\s\S]*accent-color: var\(--color-brand-primary\)/);

  assert.match(formTemplate, /class='form-panel'/);
  assert.match(formTemplate, /class='form-fieldset'/);
  assert.match(formTemplate, /class='required-marker'/);
  assert.doesNotMatch(formTemplate, /style=/);
});

test('[SNX-UI-102] title card variants remain consistent', () => {
  const css = read(CSS_PATH);
  const browse = read(path.join(ROOT, 'views', 'streamer', 'browse.ejs'));

  for (const selector of ['.card', '.poster-card', '.title-card', '.card-content', '.card-footer', '.capacity-meter', '.status']) {
    assertCssContains(css, new RegExp(selector.replace('.', '\\.')));
  }

  assert.match(browse, /class='card poster-card'/);
  assert.match(browse, /class='card-meta-row'/);
});

test('[SNX-UI-103] modal and toast states are reusable', () => {
  const css = read(CSS_PATH);
  const uiJs = read(path.join(ROOT, 'public', 'js', 'ui.js'));

  assertCssContains(css, /\.confirm-dialog,\n\.content-modal/);
  assertCssContains(css, /\.toast\.success/);
  assertCssContains(css, /\.toast\.error/);
  assertCssContains(css, /\.toast\.info/);
  assertCssContains(css, /\.toast\.warning/);
  assert.match(uiJs, /class ToastNotification/);
  assert.match(uiJs, /class ConfirmDialog/);
});

test('[SNX-A11Y-100] keyboard focus remains visible', () => {
  const css = read(CSS_PATH);

  assertCssContains(css, /--focus-outline:/);
  assertCssContains(css, /a:focus-visible,\nbutton:focus-visible/);
  assertCssContains(css, /outline: var\(--focus-outline\)/);
});

test('[SNX-A11Y-101] status does not rely on colour alone', () => {
  const css = read(CSS_PATH);
  const dashboard = read(path.join(ROOT, 'views', 'admin', 'dashboard.ejs'));

  assertCssContains(css, /\.status::before[\s\S]*background: currentColor/);
  assertCssContains(css, /\.alert-error::before[\s\S]*content: "Error"/);
  assertCssContains(css, /\.alert-success::before[\s\S]*content: "Success"/);
  assert.doesNotMatch(dashboard, /● Active|✓ Completed/);
});

test('[SNX-A11Y-102] reduced-motion preference is respected', () => {
  const css = read(CSS_PATH);

  assertCssContains(css, /@media \(prefers-reduced-motion: reduce\)/);
  assertCssContains(css, /animation-duration: 1ms !important/);
  assertCssContains(css, /transition-duration: 1ms !important/);
});

test('[SNX-UI-104] component documentation defines approved and prohibited usage', () => {
  const doc = read(DOC_PATH);

  assert.match(doc, /## Tokens/);
  assert.match(doc, /## Approved Components/);
  assert.match(doc, /## Prohibited Usage/);
  assert.match(doc, /Do not use unsupported font weights/);
  assert.match(doc, /Do not communicate status by colour alone/);
});

test('[SNX-UI-105] registry owns the pivot design system validation identifiers', () => {
  const registry = readJson(REGISTRY_PATH);
  const expectedIds = new Set([
    'SNX-BRAND-010',
    'SNX-UI-100',
    'SNX-UI-101',
    'SNX-UI-102',
    'SNX-UI-103',
    'SNX-UI-104',
    'SNX-UI-105',
    'SNX-A11Y-100',
    'SNX-A11Y-101',
    'SNX-A11Y-102',
  ]);

  const owned = registry.validations.filter((entry) => entry.ownerIssue === 45);
  assert.deepEqual(new Set(owned.map((entry) => entry.id)), expectedIds);
});
