#!/usr/bin/env node
'use strict';
/**
 * Integration test (bug-2): in a project WITHOUT a plans/ directory, an EXPLICIT
 * `-- <target>` audit must still be validated and fail closed on a missing or
 * symlinked target — the no-plans shortcut applies only to automatic branch scope,
 * not to an explicit audit list. Runs a copy of check-artifact-pairing.cjs +
 * gate-scope.cjs in a temp ROOT that has no plans/ dir (so PLANS is absent), and
 * drives it in explicit mode.
 *
 *   node scripts/check-artifact-pairing.test.cjs
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const NODE = process.execPath;
const SRC = __dirname;

let failures = 0;
const fail = (m) => { failures++; console.error('FAIL: ' + m); };
const pass = (m) => console.log('pass: ' + m);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'no-plans-'));
const scripts = path.join(root, 'scripts');
fs.mkdirSync(scripts);
fs.copyFileSync(path.join(SRC, 'check-artifact-pairing.cjs'), path.join(scripts, 'check-artifact-pairing.cjs'));
fs.copyFileSync(path.join(SRC, 'gate-scope.cjs'), path.join(scripts, 'gate-scope.cjs'));
const GATE = path.join(scripts, 'check-artifact-pairing.cjs');
// deliberately no `plans/` dir under root → PLANS is absent

const run = (args) => spawnSync(NODE, [GATE, ...args], { cwd: root, encoding: 'utf8', env: process.env });

// explicit missing target → fail closed (NOT an OK-exit from the no-plans shortcut).
{
  const r = run(['--', path.join(root, 'missing.md')]);
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0 && /missing target/i.test(out)) pass('no-plans explicit missing: fail-closed');
  else fail(`no-plans explicit missing: expected fail-closed, got status=${r.status} out=${JSON.stringify(out.trim())}`);
}

// explicit symlink target → fail closed (rejected, not followed).
const ext = path.join(root, 'external.md');
fs.writeFileSync(ext, '# external\n');
const link = path.join(root, 'link.md');
try {
  fs.symlinkSync(ext, link);
  const r = run(['--', link]);
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0 && /not a regular file/i.test(out)) pass('no-plans explicit symlink: fail-closed');
  else fail(`no-plans explicit symlink: expected fail-closed, got status=${r.status} out=${JSON.stringify(out.trim())}`);
} catch (e) {
  if (e && (e.code === 'EPERM' || e.code === 'ENOSYS')) pass('no-plans explicit symlink: skipped (unsupported here)');
  else throw e;
}

// bug-3: a bare `--` (empty explicit audit list) is rejected, not silently fallen
// through to branch scope (which would need git and mis-audit).
{
  const r = run(['--']);
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0 && /empty explicit audit list/i.test(out)) pass('no-plans empty-explicit: fail-closed');
  else fail(`no-plans empty-explicit: expected fail-closed, got status=${r.status} out=${JSON.stringify(out.trim())}`);
}

if (failures) { console.error(`\ncheck-artifact-pairing: ${failures} failure(s)`); process.exit(1); }
console.log('\ncheck-artifact-pairing: OK');
