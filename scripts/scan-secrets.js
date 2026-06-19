const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const IGNORE_DIRS = new Set(['.git', 'node_modules', 'logs', '_private', 'coverage', 'dist', 'build']);
const IGNORE_FILES = new Set(['package-lock.json', '.env']);
const PATTERNS = [
  { name: 'MongoDB Atlas URI', regex: /mongodb\+srv:\/\//i },
  { name: 'SESSION_SECRET assignment', regex: /SESSION_SECRET=.+[A-Za-z0-9]{12}/ },
  { name: 'API key assignment', regex: /api[_-]?key\s*[:=]\s*['"]?[A-Za-z0-9_\-]{16,}/i },
  { name: 'Service account assignment', regex: /serviceAccount\s*[:=]/i },
  { name: 'Private key field', regex: /private_key\s*[:=]/i },
  { name: 'Private key block', regex: /BEGIN (RSA|OPENSSH|PRIVATE)/ },
  { name: 'AWS access key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'OpenAI style key', regex: /sk-[A-Za-z0-9]{20,}/ },
];

const findings = [];

const shouldSkip = (fullPath, entry) => {
  if (entry.isDirectory()) {
    return IGNORE_DIRS.has(entry.name);
  }
  if (IGNORE_FILES.has(entry.name)) {
    return true;
  }
  return entry.name.endsWith('.jpg') || entry.name.endsWith('.png') || entry.name.endsWith('.gif');
};

const scanFile = (filePath) => {
  const rel = path.relative(ROOT, filePath);
  if (rel === 'scripts/scan-secrets.js') {
    return;
  }
  const text = fs.readFileSync(filePath, 'utf8');
  text.split(/\r?\n/).forEach((line, index) => {
    if (/SESSION_SECRET=.*(replace|placeholder|test|dev)/i.test(line)) {
      return;
    }
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(line)) {
        findings.push(`${rel}:${index + 1}: ${pattern.name}`);
      }
    }
  });
};

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (shouldSkip(full, entry)) {
      continue;
    }
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile()) {
      scanFile(full);
    }
  }
};

walk(ROOT);

if (findings.length > 0) {
  process.stderr.write(`Potential secrets found:\n${findings.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('No tracked secret-pattern matches found\n');
