#!/usr/bin/env node
'use strict';
/**
 * Contract tests for the shared fail-closed target guard `targetProblem`
 * (gate-scope.cjs, sec-1). branchScope now SURFACES missing / type-changed /
 * symlinked paths instead of existsSync-dropping them, so every consumer
 * (check-artifact-links, check-artifact-pairing, and the roadmap parity gate via
 * its own equivalent guard) must reject an unsafe target before reading it. These
 * cases pin that a type-changed / untracked symlink, a missing path, a wrong
 * extension, and a containment escape all fail closed — in branch (contained) and
 * explicit modes.
 *
 *   node scripts/gate-target-guard.test.cjs
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { targetProblem } = require('./gate-scope.cjs');

let failures = 0;
const fail = (m) => { failures++; console.error('FAIL: ' + m); };
const pass = (m) => console.log('pass: ' + m);
const assertBad = (label, file, opts, re) => {
  const r = targetProblem(file, opts);
  if (r && (!re || re.test(r))) return pass(`${label}: rejected (${r})`);
  fail(`${label}: expected rejection${re ? ' matching ' + re : ''}, got ${JSON.stringify(r)}`);
};
const assertOk = (label, file, opts) => {
  const r = targetProblem(file, opts);
  if (r === null) return pass(`${label}: accepted`);
  fail(`${label}: expected accept, got ${JSON.stringify(r)}`);
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-guard-'));
const plans = path.join(tmp, 'plans');
fs.mkdirSync(plans);
const opts = { root: tmp, auditPath: 'plans', ext: '.html', enforceContainment: true };
const explicitOpts = { root: tmp, auditPath: 'plans', ext: '.html', enforceContainment: false };

// A regular, contained .html file → accepted.
const good = path.join(plans, 'good.html');
fs.writeFileSync(good, '<!doctype html>\n');
assertOk('regular-contained', good, opts);

// Missing target → rejected (not silently dropped).
assertBad('missing', path.join(plans, 'nope.html'), opts, /missing target/i);

// A plans artifact type-changed / added as a symlink pointing OUTSIDE the repo →
// rejected, never followed — in BOTH branch and explicit modes.
const external = path.join(tmp, 'external-secret.html');
fs.writeFileSync(external, '<!doctype html>secret\n');
const link = path.join(plans, 'evil.html');
try {
  fs.symlinkSync(external, link);
  assertBad('symlink-external-branch', link, opts, /not a regular file/i);
  assertBad('symlink-external-explicit', link, explicitOpts, /not a regular file/i);
} catch (e) {
  if (e && (e.code === 'EPERM' || e.code === 'ENOSYS')) pass('symlink cases: skipped (unsupported here)');
  else throw e;
}

// Wrong extension → rejected.
const wrongExt = path.join(plans, 'note.txt');
fs.writeFileSync(wrongExt, 'x\n');
assertBad('wrong-ext', wrongExt, opts, /not a \.html file/i);

// A regular file OUTSIDE plans/ → containment rejects it in branch mode …
const outside = path.join(tmp, 'outside.html');
fs.writeFileSync(outside, '<!doctype html>\n');
assertBad('escapes-plans-branch', outside, opts, /escapes plans/i);
// … but explicit mode (a deliberate audit list, no containment) accepts a regular
// out-of-tree file, so the tmp-fixture harnesses still work.
assertOk('outside-explicit-ok', outside, explicitOpts);

if (failures) { console.error(`\ngate-target-guard: ${failures} failure(s)`); process.exit(1); }
console.log('\ngate-target-guard: OK');
