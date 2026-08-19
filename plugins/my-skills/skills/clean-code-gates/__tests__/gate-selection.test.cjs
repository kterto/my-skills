const { test } = require('node:test');
const assert = require('node:assert');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run } = require('../src/run.cjs');
const { docsOnlyProject } = require('./fixtures/empty-scope.cjs');

const BIN = path.join(__dirname, '..', 'bin', 'gates.cjs');

function cli(d, args) {
  return cp.spawnSync(process.execPath, [BIN, ...args], { cwd: d, encoding: 'utf8' });
}

function project(configuredGates) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-gates-'));
  fs.writeFileSync(path.join(d, 'package.json'), '{}');
  fs.writeFileSync(path.join(d, 'tsconfig.json'), '{}');
  fs.mkdirSync(path.join(d, 'src'), { recursive: true });
  fs.writeFileSync(path.join(d, 'src', 'a.ts'), 'export const a = 1;\n');
  if (configuredGates) {
    fs.writeFileSync(path.join(d, '.cleancode-gates.json'), JSON.stringify({
      schemaVersion: '1.0',
      stacks: { 'node-ts': { roots: ['src'], gates: configuredGates } },
    }));
  }
  return d;
}

function invoke(d, options) {
  return run({
    root: d,
    options: { scope: { kind: 'files', files: ['src/a.ts'] }, gates: null, skip: [], out: '-', scaffold: false, requireTools: false, ...options },
    io: { now: 'n', version: 'v' },
  });
}

test('an explicitly requested unknown gate id is a usage error', () => {
  assert.throws(() => invoke(project(), { gates: ['G9'] }), /unknown gate id/i);
});

test('an explicitly requested known-but-unsupported gate is a usage error', () => {
  // G3 is a real gate id, deliberately folded into G2 — no stack runs it.
  assert.throws(() => invoke(project(), { gates: ['G3'] }), /not supported/i);
});

test('the unknown and the unsupported cases are distinguishable in the message', () => {
  let unknown = '';
  let unsupported = '';
  try { invoke(project(), { gates: ['G9'] }); } catch (e) { unknown = e.message; }
  try { invoke(project(), { gates: ['G3'] }); } catch (e) { unsupported = e.message; }
  assert.match(unknown, /unknown gate id/i);
  assert.match(unsupported, /not supported/i);
  assert.notStrictEqual(unknown, unsupported);
});

test('a gate set emptied by --gates/--skip is a usage error, not an empty pass', () => {
  assert.throws(() => invoke(project(), { gates: ['G5'], skip: ['G5'] }), /no gates/i);
});

// No --gates given means "whatever applies here". A stack that simply lacks a
// gate is not something the caller asked for, so it stays silent.
test('an implicitly dropped gate keeps its silent behaviour', () => {
  const d = project({ G5: { tool: 'builtin' } });
  const { report, exitCode } = invoke(d, {});
  assert.deepStrictEqual(report.summary.gatesRun, ['G5']);
  assert.strictEqual(exitCode, 0);
});

test('--skip still drops a gate silently when it leaves others behind', () => {
  const { report } = invoke(project(), { skip: ['G6'] });
  assert.ok(!report.summary.gatesRun.includes('G6'));
  assert.ok(report.summary.gatesRun.includes('G5'));
});

test('a usage error in gate selection exits 3 from the CLI', () => {
  const d = project();
  const r = cp.spawnSync(process.execPath, [BIN, '--gates', 'G9', '--out', '-'], { cwd: d, encoding: 'utf8' });
  assert.strictEqual(r.status, 3);
  assert.match(r.stderr, /unknown gate id/i);
  assert.doesNotMatch(r.stdout, /"status": "pass"/);
});

// A typo'd gate id in a CI config used to succeed silently whenever the scope
// happened to be empty: `scope.stacks` was empty, so `resolveGatePlan`
// early-returned above both assertions. The empty-scope guard now runs BEFORE
// gate selection, so what these two prove is the ordering — the deeper cause
// (nothing to measure) is reported rather than the gate id, and either way the
// run is exit 3 instead of a silent pass. The stderr assertion is what pins it;
// `"status": "pass"` could not appear on a path that writes no stdout at all.
test('an empty files: scope exits 3 even with a gate id that would also be rejected', () => {
  const r = cli(docsOnlyProject(), ['--scope', 'files:', '--gates', 'G9', '--out', '-']);
  assert.strictEqual(r.status, 3);
  assert.match(r.stderr, /zero gateable files/i);
});

test('an empty module: scope exits 3 even with a gate id that would also be rejected', () => {
  const r = cli(docsOnlyProject(), ['--scope', 'module:docs', '--gates', 'G9', '--out', '-']);
  assert.strictEqual(r.status, 3);
  assert.match(r.stderr, /zero gateable files/i);
});

// Controls: the non-empty path keeps reporting the gate id itself as the fault,
// and a scope that did resolve files still gets its verdict.
test('a non-empty scope with an unknown gate id still names the gate id', () => {
  const r = cli(docsOnlyProject(), ['--scope', 'files:src/a.ts', '--gates', 'G9', '--out', '-']);
  assert.strictEqual(r.status, 3);
  assert.match(r.stderr, /unknown gate id/i);
});

test('a non-empty scope with a valid selection still exits 0', () => {
  const r = cli(docsOnlyProject(), ['--scope', 'files:src/a.ts', '--gates', 'G5', '--out', '-']);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /"status": "pass"/);
});
