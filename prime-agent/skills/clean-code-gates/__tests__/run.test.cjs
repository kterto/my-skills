const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { run } = require('../src/run.cjs');

test('end-to-end: G5 blocker on a changed file → exit 1, report written shape', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-run-'));
  fs.writeFileSync(path.join(d, 'package.json'), '{}');
  fs.writeFileSync(path.join(d, 'tsconfig.json'), '{}');
  fs.mkdirSync(path.join(d, 'src'), { recursive: true });
  fs.writeFileSync(path.join(d, 'src/a.ts'), 'function a(){\n  // bad\n  return 1;\n}\n');
  const { report, exitCode } = run({
    root: d,
    options: { scope: { kind: 'files', files: ['src/a.ts'] }, gates: ['G5'], skip: [], out: './.cleancode', scaffold: false, requireTools: false },
    io: { now: '2026-05-31T00:00:00Z', version: '0.1.0' },
  });
  assert.strictEqual(report.summary.status, 'blocked');
  assert.strictEqual(exitCode, 1);
  assert.strictEqual(report.gates.find(g => g.gate === 'G5').findings.length, 1);
});

test('non-G5 gate with no adapter yet reports missing_tool, not crash', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-run2-'));
  fs.writeFileSync(path.join(d, 'package.json'), '{}'); fs.writeFileSync(path.join(d, 'tsconfig.json'), '{}');
  fs.mkdirSync(path.join(d, 'src')); fs.writeFileSync(path.join(d, 'src/a.ts'), 'export const a=1;\n');
  const { report } = run({ root: d, options: { scope: { kind: 'files', files: ['src/a.ts'] }, gates: ['G2'], skip: [], scaffold: false, requireTools: false }, io: { now: 'n', version: 'v' } });
  assert.strictEqual(report.gates.find(g => g.gate === 'G2').status, 'missing_tool');
});
