const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('sandbox runtime refuses remote MongoDB URIs', () => {
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      [
        "process.env.APP_RUNTIME = 'sandbox';",
        "process.env.MONGO_URI = ['mongodb', '+srv://example.invalid/streamnexus'].join('');",
        "try {",
        "  require('./app').createApp();",
        "  process.exit(1);",
        "} catch (error) {",
        "  process.exit(error.message.includes('refuses remote MongoDB URIs') ? 0 : 2);",
        "}",
      ].join(' '),
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
