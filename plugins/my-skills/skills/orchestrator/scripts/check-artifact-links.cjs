#!/usr/bin/env node
/**
 * Gate: every local (relative, non-anchor, non-external) href in a generated
 * plan `.html` artifact must resolve to a file that exists on disk. Catches a
 * final/eval/plan report that links to a sibling artifact which was never
 * rendered (bug-5: the final report linked to an eval HTML that did not exist).
 *
 * Scope is the branch's added/modified `plans/**.html` vs the base merge-base,
 * plus untracked ones — the same scope as check-artifact-pairing.cjs — so
 * legacy artifacts are not re-audited. Pass explicit `.html` paths after `--`
 * to check just those.
 *
 *   node .orchestrator/check-artifact-links.cjs [base-ref] [--allow-empty] [-- file.html ...]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { branchScope, targetProblem } = require('./gate-scope.cjs');

const ROOT = path.resolve(__dirname, '..');

function localHrefs(html) {
  const hrefs = [];
  const re = /(?:href|src)="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1];
    if (/^(https?:|mailto:|data:|#|\/\/)/.test(raw)) continue;
    hrefs.push(raw.split('#')[0]);
  }
  return hrefs.filter(Boolean);
}

const argv = process.argv.slice(2);
const dashDash = argv.indexOf('--');
const flags = dashDash >= 0 ? argv.slice(0, dashDash) : argv;
const explicit = dashDash >= 0 ? argv.slice(dashDash + 1) : [];
const allowEmpty = flags.includes('--allow-empty');
const baseRef = flags.find((a) => !a.startsWith('--'));
const explicitMode = explicit.length > 0;
// Do not existsSync-filter explicit paths (that follows symlinks and silently drops
// a typo'd path); resolve them all and let the shared guard fail closed (sec-1).
const targets = explicitMode
  ? explicit.map((f) => path.resolve(ROOT, f))
  : branchScope({ root: ROOT, auditPath: 'plans', ext: '.html', baseRef, label: 'artifact-links', allowEmpty });

const problems = [];
for (const file of targets) {
  const rel = path.relative(ROOT, file);
  // Fail closed on a symlink / non-regular / missing / oversized / escaping target
  // BEFORE reading it — branchScope surfaces such paths (sec-1).
  const bad = targetProblem(file, { root: ROOT, auditPath: 'plans', ext: '.html', enforceContainment: !explicitMode });
  if (bad) { problems.push(`${rel}: ${bad}`); continue; }
  const dir = path.dirname(file);
  for (const href of localHrefs(fs.readFileSync(file, 'utf8'))) {
    const resolved = path.resolve(dir, href);
    if (!fs.existsSync(resolved)) {
      problems.push(`${rel} -> ${href} (missing)`);
    }
  }
}

if (problems.length) {
  console.error(`artifact-links: ${problems.length} broken local link(s)`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('artifact-links: OK');
