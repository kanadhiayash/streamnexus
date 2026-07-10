const { spawnSync } = require('node:child_process');

const gates = [
  ['git', ['status', '--short']],
  ['npm', ['test']],
  ['npm', ['run', 'test:ejs']],
  ['npm', ['run', 'sandbox:smoke']],
  ['npm', ['audit', '--audit-level=moderate']],
  ['npm', ['run', 'scan:secrets']],
  ['npm', ['run', 'test:load']],
  ['git', ['diff', '--check']],
];

for (const [command, args] of gates) {
  const label = [command, ...args].join(' ');
  process.stdout.write(`\n> ${label}\n`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    process.stderr.write(`Release verification failed at: ${label}\n`);
    process.exit(result.status || 1);
  }
}

process.stdout.write('\nRelease verification passed.\n');
