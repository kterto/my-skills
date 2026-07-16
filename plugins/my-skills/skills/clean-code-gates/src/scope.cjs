'use strict';
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Repo-relative paths are compared and matched across the pipeline (scope vs
 * coverage keys, exemption globs, finding IDs). Git emits `/`, but Node's
 * `path.relative`/`path.join` emit `\` on Windows, so a raw file list mixes
 * separators and every lookup misses. Everything downstream assumes `/`.
 */
function toPosix(file) {
  return file.replace(/\\/g, '/');
}

function fileStack(file, cfg) {
  for (const [stack, sc] of Object.entries(cfg.stacks || {})) {
    for (const root of sc.roots || []) {
      if (file === root || file.startsWith(root.endsWith('/') ? root : root + '/')) return stack;
    }
  }
  return null;
}

function globToRe(glob) {
  const re = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\0')
    .replace(/\*/g, '[^/]*')
    .replace(/\0/g, '.*');
  return new RegExp('^' + re + '$');
}

function isExcluded(file, cfg) {
  const stack = fileStack(file, cfg);
  if (!stack) return false;
  const globs = (cfg.stacks[stack] || {}).exclude || [];
  return globs.some(g => globToRe(g).test(file));
}

/**
 * Files changed since `baseRef`, including work that is not committed yet.
 *
 * Deliberately compares the base to the WORKING TREE rather than using
 * `base..HEAD`. A two-dot range only sees committed history, so on the tree an
 * agent is actually working on — uncommitted, often with HEAD at the base — it
 * resolves to zero files and the run reports `pass` with no gates run: a
 * vacuous green rather than a passing gate. Untracked files are included for
 * the same reason; a brand-new source file is exactly what most needs gating.
 */
function realGitDiff(root) {
  return (baseRef) => {
    const base = baseRef || `$(git -C "${root}" merge-base HEAD origin/main 2>/dev/null || echo HEAD)`;
    const run = (cmd) => {
      try {
        return cp.execSync(cmd, { encoding: 'utf8' }).split('\n');
      } catch {
        return [];
      }
    };
    // Refresh first: build tooling (flutter/dart/jest) rewrites mtimes, leaving
    // stat-dirty index entries. Without this the same tree yields a different
    // file set run to run, so the scope — and therefore the verdict — is not
    // reproducible.
    run(`git -C "${root}" update-index --refresh`);
    const tracked = run(`git -C "${root}" diff --name-only ${base}`);
    const untracked = run(`git -C "${root}" ls-files --others --exclude-standard`);
    return [...new Set([...tracked, ...untracked].map(s => s.trim()).filter(Boolean))];
  };
}

function realListFiles(root) {
  return (target) => {
    const abs = path.join(root, target);
    const acc = [];
    (function walk(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else acc.push(path.relative(root, p));
      }
    })(abs);
    return acc;
  };
}

function projectFiles(cfg, listFiles) {
  const files = [];
  for (const sc of Object.values(cfg.stacks || {})) for (const r of sc.roots || []) files.push(...listFiles(r));
  return files;
}

function resolveScope(options, cfg, io) {
  const { scope } = options;
  const gitDiff = io.gitDiff || realGitDiff(io.root);
  const listFiles = io.listFiles || realListFiles(io.root);
  let files = [];
  if (scope.kind === 'project') files = projectFiles(cfg, listFiles);
  else if (scope.kind === 'diff') files = gitDiff(scope.baseRef);
  else if (scope.kind === 'module') files = listFiles(scope.target);
  else if (scope.kind === 'files') files = scope.files;

  files = files.map(toPosix);
  const kept = files.filter(f => fileStack(f, cfg) && !isExcluded(f, cfg));
  const stacks = [...new Set(kept.map(f => fileStack(f, cfg)))].sort();
  const result = { kind: scope.kind, files: kept, stacks };
  if (scope.kind === 'diff') result.baseRef = scope.baseRef;
  return result;
}

module.exports = { resolveScope, fileStack, realGitDiff, toPosix };
