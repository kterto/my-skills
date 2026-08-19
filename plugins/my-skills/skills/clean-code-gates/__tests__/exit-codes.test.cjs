const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run, registerAdapter } = require('../src/run.cjs');

// A gate that could not execute has an unknown result. Folding it into 0 makes a
// run that measured nothing indistinguishable from a run that measured
// everything and found it clean, so `error` needs an exit code of its own.
registerAdapter('node-ts', {
  supports: (gate) => gate === 'G2',
  run: (gate) => ({ gate, name: 'stub', stack: 'node-ts', status: 'error', tool: 'stub', findings: [] }),
});

function project() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-exit-'));
  fs.writeFileSync(path.join(d, 'package.json'), '{}');
  fs.writeFileSync(path.join(d, 'tsconfig.json'), '{}');
  fs.mkdirSync(path.join(d, 'src'), { recursive: true });
  fs.writeFileSync(path.join(d, 'src', 'a.ts'), 'export const a = 1;\n');
  return d;
}

function invoke(d, options) {
  return run({
    root: d,
    options: { scope: { kind: 'files', files: ['src/a.ts'] }, gates: null, skip: [], out: '-', scaffold: false, requireTools: false, ...options },
    io: { now: 'n', version: 'v' },
  });
}

test('an errored gate exits 4, not 0', () => {
  const { report, exitCode } = invoke(project(), { gates: ['G2'] });
  assert.strictEqual(report.summary.status, 'error');
  assert.strictEqual(exitCode, 4);
});

test('exit 4 is independent of --require-tools', () => {
  assert.strictEqual(invoke(project(), { gates: ['G2'], requireTools: true }).exitCode, 4);
});

test('missing_tool still exits 0 without --require-tools and 2 with it', () => {
  assert.strictEqual(invoke(project(), { gates: ['G1'] }).exitCode, 0);
  assert.strictEqual(invoke(project(), { gates: ['G1'], requireTools: true }).exitCode, 2);
});

test('a clean run still exits 0', () => {
  assert.strictEqual(invoke(project(), { gates: ['G5'] }).exitCode, 0);
});
