'use strict';
const fs = require('node:fs');
const path = require('node:path');

const SKIP_DIRS = new Set(['node_modules', '.git', '.dart_tool', 'build', '.cleancode', 'coverage']);

/**
 * Where each stack marker was found, repo-relative and POSIX-separated (`''`
 * for a package at the project root). Discarding the directory and keeping only
 * the stack name is what forces the root-level `roots: ['src']` default, which
 * scopes zero files in a monorepo — every gate then runs over an empty file set
 * and the run reports pass having measured nothing. The single walk below feeds
 * both this and `detectStacks`; nothing traverses the tree twice.
 */
function walkMarkers(root) {
  const found = [];
  const pending = [root];
  while (pending.length) {
    const dir = pending.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    const names = new Set(entries.filter(e => e.isFile()).map(e => e.name));
    const rel = path.relative(root, dir).split(path.sep).join('/');
    if (names.has('pubspec.yaml')) found.push({ stack: 'dart-flutter', dir: rel });
    if (names.has('package.json') && names.has('tsconfig.json')) found.push({ stack: 'node-ts', dir: rel });
    for (const e of entries) {
      if (e.isDirectory() && !SKIP_DIRS.has(e.name)) pending.push(path.join(dir, e.name));
    }
  }
  return found;
}

function detectPackages(root) {
  return walkMarkers(root).sort((a, b) => a.stack.localeCompare(b.stack) || a.dir.localeCompare(b.dir));
}

function detectStacks(root) {
  return [...new Set(detectPackages(root).map(p => p.stack))].sort();
}

module.exports = { detectStacks, detectPackages };
