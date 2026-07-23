#!/usr/bin/env node
/**
 * Gate: in html-mode every canonical `.md` planning artifact must have its
 * `.html` sibling, and eval/spec/plan/report frontmatter must carry the
 * required keys (`id`, `status`, `created_at`, `updated_at`, `cycle`).
 * Exits non-zero on any violation so it can gate a commit.
 *
 * Scope is the artifacts this branch introduces or edits (added/modified `.md`
 * under `plans/` vs the merge-base with the base branch), NOT the whole
 * historical corpus — legacy md-mode artifacts predate the html contract and are
 * not migrated here. Pass explicit `.md` paths to check just those instead.
 *
 *   node .orchestrator/check-artifact-pairing.cjs [base-ref] [--allow-empty] [-- file.md ...]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { branchScope, targetProblem } = require('./gate-scope.cjs');

const ROOT = path.resolve(__dirname, '..');
const PLANS = path.join(ROOT, 'plans');
const REQUIRED_FM = ['id', 'status', 'created_at', 'updated_at', 'cycle'];

function frontmatterKeys(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return new Set();
  return new Set(
    m[1].split('\n')
      .map((l) => (l.match(/^([A-Za-z0-9_]+):/) || [])[1])
      .filter(Boolean)
  );
}

const argv = process.argv.slice(2);
const dashDash = argv.indexOf('--');
const flags = dashDash >= 0 ? argv.slice(0, dashDash) : argv;
const explicit = dashDash >= 0 ? argv.slice(dashDash + 1) : [];
const allowEmpty = flags.includes('--allow-empty');
const baseRef = flags.find((a) => !a.startsWith('--'));
// Explicit mode is the PRESENCE of `--`, not a non-empty list (bug-3): a bare `--`
// (empty audit list) must be rejected, not silently fall through to branch scope.
const explicitMode = dashDash >= 0;
if (explicitMode && explicit.length === 0) {
  console.error('artifact-pairing: no targets after `--` (empty explicit audit list). Pass one or more files, or omit `--` for branch scope.');
  process.exit(1);
}

// The no-plans shortcut applies ONLY to automatic branch scope: a project without
// plans/ has no branch artifacts to audit, so exit OK. It must NOT short-circuit an
// EXPLICIT audit list — a `-- missing.md` / symlink target must still fail closed
// even when plans/ is absent (bug-2: the check ran before argv parsing / the guard).
if (!explicitMode && !fs.existsSync(PLANS)) process.exit(0);

// Do not existsSync-filter explicit paths (that follows symlinks and silently drops
// a typo'd path); resolve them all and let the shared guard fail closed (sec-1).
const targets = explicitMode
  ? explicit.map((f) => path.resolve(ROOT, f))
  : branchScope({ root: ROOT, auditPath: 'plans', ext: '.md', baseRef, label: 'artifact-pairing', allowEmpty });

const problems = [];
for (const md of targets) {
  const rel = path.relative(ROOT, md);
  // Fail closed on a symlink / non-regular / missing / oversized / escaping target
  // BEFORE reading it — branchScope surfaces such paths (sec-1).
  const bad = targetProblem(md, { root: ROOT, auditPath: 'plans', ext: '.md', enforceContainment: !explicitMode });
  if (bad) { problems.push(`${rel}: ${bad}`); continue; }
  const html = md.replace(/\.md$/, '.html');
  if (!fs.existsSync(html)) problems.push(`missing html sibling: ${rel}`);
  // Progress logs are append-logs, not frontmatter artifacts — pairing only.
  if (/\.progress\.md$/.test(md)) continue;
  const keys = frontmatterKeys(fs.readFileSync(md, 'utf8'));
  for (const k of REQUIRED_FM) {
    if (!keys.has(k)) problems.push(`frontmatter missing "${k}": ${rel}`);
  }
}

if (problems.length) {
  console.error(`artifact-pairing: ${problems.length} violation(s)`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('artifact-pairing: OK');
