'use strict';
const fs = require('node:fs');
const path = require('node:path');

const SKIP_DIRS = new Set(['node_modules', '.git', '.dart_tool', 'build', '.cleancode', 'coverage']);

function walkMarkers(root) {
  const found = new Set();
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    const names = new Set(entries.filter(e => e.isFile()).map(e => e.name));
    if (names.has('pubspec.yaml')) found.add('dart-flutter');
    if (names.has('package.json') && names.has('tsconfig.json')) found.add('node-ts');
    for (const e of entries) {
      if (e.isDirectory() && !SKIP_DIRS.has(e.name)) stack.push(path.join(dir, e.name));
    }
  }
  return found;
}

function detectStacks(root) {
  return [...walkMarkers(root)].sort();
}

module.exports = { detectStacks };
