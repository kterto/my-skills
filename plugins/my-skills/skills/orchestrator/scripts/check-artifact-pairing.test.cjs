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

// sec-1 regression: the `.html` sibling gets the SAME fail-closed guard as the `.md`
// target. A bare existsSync follows symlinks and accepts a directory, so a `foo.html/`
// dir or a link pointing anywhere satisfied the pairing gate.
const FM = '---\nid: X\nstatus: DONE\ncreated_at: t\nupdated_at: t\ncycle: 1\n---\n# x\n';
const pairCase = (name, mkHtml, expect) => {
  const dir = fs.mkdtempSync(path.join(root, 'pair-'));
  const md = path.join(dir, 'a.md');
  fs.writeFileSync(md, FM);
  try {
    mkHtml(path.join(dir, 'a.html'));
  } catch (e) {
    if (e && (e.code === 'EPERM' || e.code === 'ENOSYS')) { pass(`${name}: skipped (unsupported here)`); return; }
    throw e;
  }
  const r = run(['--', md]);
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0 && expect.test(out)) pass(`${name}: fail-closed`);
  else fail(`${name}: expected fail-closed, got status=${r.status} out=${JSON.stringify(out.trim())}`);
};

pairCase('html sibling directory', (html) => fs.mkdirSync(html), /html sibling: not a regular file/i);
pairCase('html sibling symlink', (html) => {
  const outside = path.join(root, 'outside.html');
  fs.writeFileSync(outside, '<html></html>\n');
  fs.symlinkSync(outside, html);
}, /html sibling: not a regular file/i);
pairCase('html sibling absent', () => {}, /html sibling: missing target/i);

// A regular `.html` sibling still passes (the guard is not over-tight).
{
  const dir = fs.mkdtempSync(path.join(root, 'pair-ok-'));
  const md = path.join(dir, 'a.md');
  fs.writeFileSync(md, FM);
  fs.writeFileSync(path.join(dir, 'a.html'), '<html></html>\n');
  const r = run(['--', md]);
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status === 0 && /artifact-pairing: OK/.test(out)) pass('html sibling regular file: OK');
  else fail(`html sibling regular file: expected OK, got status=${r.status} out=${JSON.stringify(out.trim())}`);
}

// A MAINTAINED legacy artifact does not deadlock the run. The layout freezes the seven
// kind directories but keeps maintaining what already lives there — a coder flips a
// checkbox, a reviewer appends to a progress log — and that edit puts the `.md` into
// branch scope. Demanding the `.html` sibling an md-mode artifact never had would stop
// the run with no legal remedy: rendering one writes into the frozen tree, and moving
// the file is the bulk migration the layout rules out. Measured before the exemption:
// `artifact-pairing: 2 violation(s)`, exit 1, on one checkbox flip.
{
  const repo = fs.mkdtempSync(path.join(root, 'legacy-repo-'));
  const legacy = path.join(repo, 'plans', 'feat');
  fs.mkdirSync(legacy, { recursive: true });
  const md = path.join(legacy, 'FEAT-20260701T085900Z-bb22-legacy-plan.md');
  fs.writeFileSync(md, `${FM}\n- [ ] task\n`);
  // The gate resolves its ROOT from its own location, so it has to run from inside the
  // fixture the way a bootstrapped project runs it: out of `.orchestrator/`.
  const orch = path.join(repo, '.orchestrator');
  fs.mkdirSync(orch, { recursive: true });
  for (const f of ['check-artifact-pairing.cjs', 'gate-scope.cjs']) {
    fs.copyFileSync(path.join(__dirname, f), path.join(orch, f));
  }
  const GATE_IN_REPO = path.join(orch, 'check-artifact-pairing.cjs');
  const git = (...args) => spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  git('add', '-A');
  git('commit', '-qm', 'base');
  git('checkout', '-qb', 'work');
  fs.writeFileSync(md, `${FM}\n- [x] task\n`);
  const r = spawnSync(NODE, [GATE_IN_REPO, 'main'], { cwd: repo, encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status === 0 && /artifact-pairing: OK/.test(out)) pass('a maintained legacy artifact needs no html sibling');
  else fail(`maintained legacy artifact: expected OK, got status=${r.status} out=${JSON.stringify(out.trim())}`);

  // Naming the path explicitly is asking about that path, so the exemption lifts.
  const explicit = spawnSync(NODE, [GATE_IN_REPO, '--', md], { cwd: repo, encoding: 'utf8' });
  const eout = (explicit.stdout || '') + (explicit.stderr || '');
  if (explicit.status !== 0 && /html sibling: missing target/i.test(eout)) pass('an explicit audit of a legacy artifact is not exempt');
  else fail(`explicit legacy audit: expected fail-closed, got status=${explicit.status} out=${JSON.stringify(eout.trim())}`);
}

if (failures) { console.error(`\ncheck-artifact-pairing: ${failures} failure(s)`); process.exit(1); }
console.log('\ncheck-artifact-pairing: OK');
