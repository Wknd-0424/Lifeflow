const { copyFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const destination = join(root, 'public', 'vendor');
mkdirSync(destination, { recursive: true });
for (const file of ['three.module.js', 'three.core.js']) {
  copyFileSync(join(root, 'node_modules', 'three', 'build', file), join(destination, file));
}
