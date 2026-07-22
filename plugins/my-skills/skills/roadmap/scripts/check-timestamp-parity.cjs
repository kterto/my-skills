#!/usr/bin/env node
/**
 * Gate: a roadmap `.html` page's machine-readable `data-updated-at` and its
 * visible `updated:` metadata value must be the same timestamp, so automated
 * and human readers see one update history (bug-6: the two disagreed on a
 * story page after an in-place re-render touched one and not the other).
 *
 * Applies to HTML-mode roadmaps only — the `.md` variants carry `updated_at`
 * once (frontmatter), so there is nothing to diverge. A roadmap built in md
 * mode simply has no `.html` pages and the gate passes (empty scope).
 *
 * Scope is the branch's added/modified `roadmap/**.html` vs the base merge-base
 * (plus untracked), so the long tail of legacy pages generated before the fix
 * is not re-audited. Pass explicit `.html` paths after `--` to check just those,
 * or `--all` to audit every roadmap page. The default (branch) scope is the only
 * mode that needs the orchestrator's shared `.orchestrator/gate-scope.cjs`; the
 * `--all` and explicit-`--` modes are self-contained, so a standalone roadmap
 * (no orchestrator bootstrap) can still run the gate over `--all`.
 *
 *   node roadmap/check-timestamp-parity.cjs [base-ref] [--all] [--allow-empty] [-- file.html ...]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ROADMAP = path.join(ROOT, 'roadmap');

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

const argv = process.argv.slice(2);
const dashDash = argv.indexOf('--');
const flags = (dashDash >= 0 ? argv.slice(0, dashDash) : argv);
const explicit = dashDash >= 0 ? argv.slice(dashDash + 1) : [];
const baseRef = flags.find((a) => !a.startsWith('--'));
const all = flags.includes('--all');
const allowEmpty = flags.includes('--allow-empty');

const targets = explicit.length
  ? explicit.map((f) => path.resolve(ROOT, f)).filter((f) => fs.existsSync(f))
  : all ? walk(ROADMAP, [])
  // Branch scope only: lazy-require the orchestrator's shared gate-scope so the
  // self-contained modes above never depend on `.orchestrator/` being present.
  : require('../.orchestrator/gate-scope.cjs').branchScope({
      root: ROOT, auditPath: 'roadmap', ext: '.html', baseRef, label: 'roadmap-timestamp-parity', allowEmpty,
    });

const problems = [];
for (const file of targets) {
  const s = fs.readFileSync(file, 'utf8');
  const data = (s.match(/data-updated-at="([^"]*)"/) || [])[1];
  const visible = (s.match(/updated:<\/span>\s*<span class="meta__val">([^<]*)</) || [])[1];
  const rel = path.relative(ROOT, file);
  if (data == null && visible == null) {
    continue;
  }
  if (data == null) {
    problems.push(`${rel}: missing data-updated-at attribute`);
  } else if (visible == null) {
    problems.push(`${rel}: missing visible updated value`);
  } else if (data !== visible) {
    problems.push(`${rel}: data-updated-at=${data} but visible updated=${visible}`);
  }
}

if (problems.length) {
  console.error(`roadmap-timestamp-parity: ${problems.length} mismatch(es)`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('roadmap-timestamp-parity: OK');
