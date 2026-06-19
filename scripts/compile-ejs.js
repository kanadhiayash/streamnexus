const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const files = [];

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile() && entry.name.endsWith('.ejs')) {
      files.push(full);
    }
  }
};

walk(path.join(process.cwd(), 'views'));

for (const file of files) {
  ejs.compile(fs.readFileSync(file, 'utf8'), { filename: file });
}

process.stdout.write(`Compiled ${files.length} EJS templates\n`);
