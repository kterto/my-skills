const { test } = require('node:test');
const assert = require('node:assert');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { cssOnlyCommitRepo, docsOnlyCommitRepo } = require('./fixtures/empty-scope.cjs');

const BIN = path.join(__dirname, '..', 'bin', 'gates.cjs');

// The exit-code table (SKILL.md:33) and the two report artifacts (README.md:89)
// are the whole contract a CI job or an orchestrator consumes: it spawns the
// binary, branches on the process status, and reads `report.json` off disk.
// Every other suite calls `run()` in-process, so the `process.exit(exitCode)`
// propagation and the `--out <dir>` writer are exercised here and nowhere else.

function project() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-cli-'));
  fs.writeFileSync(path.join(d, 'package.json'), '{}');
  fs.writeFileSync(path.join(d, 'tsconfig.json'), '{}');
  fs.mkdirSync(path.join(d, 'src'), { recursive: true });
  fs.writeFileSync(path.join(d, 'src', 'a.ts'), 'export const a = 1;\n');
  return d;
}

/** A runner that exits 0 and writes no coverage summary: G1 gets no verdict. */
function withStubRunner(d) {
  const bin = path.join(d, 'node_modules', '.bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'jest'), '#!/bin/sh\nexit 0\n');
  fs.chmodSync(path.join(bin, 'jest'), 0o755);
  return d;
}

function cli(d, args) {
  return cp.spawnSync(process.execPath, [BIN, ...args], { cwd: d, encoding: 'utf8' });
}

function readReport(d, out) {
  return JSON.parse(fs.readFileSync(path.join(d, out, 'report.json'), 'utf8'));
}

test('a clean run exits 0 and writes both report artifacts to --out', () => {
  const d = project();
  const r = cli(d, ['--scope', 'files:src/a.ts', '--gates', 'G5', '--out', '.cleancode']);

  assert.strictEqual(r.status, 0);
  const report = readReport(d, '.cleancode');
  assert.strictEqual(report.summary.status, 'pass');
  assert.deepStrictEqual(report.summary.gatesRun, ['G5']);
  assert.strictEqual(report.schemaVersion, '1.0');

  const md = fs.readFileSync(path.join(d, '.cleancode', 'report.md'), 'utf8');
  assert.match(md, /# Clean Code Gates — PASS/);
  assert.match(r.stderr, /\.cleancode\/report\.json \(status: pass\)/);
});

test('a blocker exits 1 and the on-disk report names the offending file and line', () => {
  const d = project();
  fs.writeFileSync(path.join(d, 'src', 'b.ts'), 'export const b = 1; // disallowed\n');
  const r = cli(d, ['--scope', 'files:src/b.ts', '--gates', 'G5', '--out', '.cleancode']);

  assert.strictEqual(r.status, 1);
  const report = readReport(d, '.cleancode');
  assert.strictEqual(report.summary.status, 'blocked');
  assert.strictEqual(report.summary.blockers, 1);
  const [finding] = report.gates.flatMap((g) => g.findings || []);
  assert.strictEqual(finding.file, 'src/b.ts');
  assert.strictEqual(finding.line, 1);
  assert.strictEqual(finding.severity, 'blocker');

  const md = fs.readFileSync(path.join(d, '.cleancode', 'report.md'), 'utf8');
  assert.match(md, /# Clean Code Gates — BLOCKED/);
  assert.match(md, /\[blocker\] src\/b\.ts:1/);
});

test('--require-tools turns missing tooling into exit 2 and still writes the report', () => {
  const d = project();
  const without = cli(d, ['--scope', 'files:src/a.ts', '--out', '.cc-a']);
  assert.strictEqual(without.status, 0, 'missing tooling alone is not a failure');

  const r = cli(d, ['--scope', 'files:src/a.ts', '--out', '.cc-b', '--require-tools']);
  assert.strictEqual(r.status, 2);
  const report = readReport(d, '.cc-b');
  assert.ok(report.summary.gatesMissingTool.includes('G1'));
  assert.strictEqual(report.summary.blockers, 0);
});

test('a gate that produces no verdict exits 4, independent of --require-tools', () => {
  const d = withStubRunner(project());

  const r = cli(d, ['--scope', 'files:src/a.ts', '--gates', 'G1', '--out', '.cc-a']);
  assert.strictEqual(r.status, 4);
  const report = readReport(d, '.cc-a');
  assert.strictEqual(report.summary.status, 'error');
  assert.deepStrictEqual(report.summary.gatesErrored, ['G1']);
  assert.deepStrictEqual(report.summary.gatesRun, [], 'an errored gate is not a gate that ran');

  const forced = cli(d, ['--scope', 'files:src/a.ts', '--gates', 'G1', '--out', '.cc-b', '--require-tools']);
  assert.strictEqual(forced.status, 4, 'exit 4 outranks the opt-in exit 2');
});

test('--scaffold exits 0, prints install commands, and changes nothing', () => {
  const d = project();
  const before = fs.readdirSync(d).sort();

  const r = cli(d, ['--scaffold']);
  assert.strictEqual(r.status, 0);
  assert.match(r.stdout, /advice only, no changes made/);
  assert.match(r.stdout, /\[node-ts\]/);
  assert.match(r.stdout, /npm i -D/);
  assert.deepStrictEqual(fs.readdirSync(d).sort(), before, 'advice mode must not write');
});

// The CR's reproduction, run against the real binary: a docs-only commit gated
// with `--scope diff:HEAD~1` returned exit 0 and `status: pass` having measured
// no source file at all.
test('a docs-only diff scope exits non-zero and never reports pass', () => {
  const d = docsOnlyCommitRepo();
  const r = cli(d, ['--scope', 'diff:HEAD~1', '--out', '-']);

  assert.notStrictEqual(r.status, 0);
  assert.strictEqual(r.status, 3);
  assert.doesNotMatch(r.stdout, /"status": "pass"/);
  assert.match(r.stderr, /zero gateable files/i);
  assert.match(r.stderr, /HEAD~1/);
});

// The harder half of the same reproduction, and the one the first fix missed: a
// commit touching only `src/theme.css` resolves to a NON-empty scope — the file
// is under a stack root — so the run reported `pass` with `gatesRun: ["G5"]`
// having scanned nothing, which not even a `gatesRun` consumer could detect.
test('a diff scope of only non-source files under a stack root exits 3 and never reports pass', () => {
  const d = cssOnlyCommitRepo();
  const r = cli(d, ['--scope', 'diff:HEAD~1', '--out', '-']);

  assert.strictEqual(r.status, 3);
  assert.doesNotMatch(r.stdout, /"status": "pass"/);
  assert.match(r.stderr, /zero gateable files/i);
  assert.match(r.stderr, /HEAD~1/);
});

test('--out - streams JSON to stdout and writes no report directory', () => {
  const d = project();
  const r = cli(d, ['--scope', 'files:src/a.ts', '--gates', 'G5', '--out', '-']);

  assert.strictEqual(r.status, 0);
  assert.strictEqual(JSON.parse(r.stdout).summary.status, 'pass');
  assert.strictEqual(fs.existsSync(path.join(d, '.cleancode')), false);
});
