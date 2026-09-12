const { test } = require('node:test');
const assert = require('node:assert');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseArgs } = require('../src/args.cjs');
const { run } = require('../src/run.cjs');
const { toMarkdown } = require('../src/report.cjs');

const BIN = path.join(__dirname, '..', 'bin', 'gates.cjs');

/** One source file with a disallowed comment: G5 finds one blocker at hardened. */
function project(cfg) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-rrun-'));
  fs.writeFileSync(path.join(d, 'package.json'), '{}');
  fs.writeFileSync(path.join(d, 'tsconfig.json'), '{}');
  fs.mkdirSync(path.join(d, 'src'), { recursive: true });
  fs.writeFileSync(path.join(d, 'src', 'a.ts'), 'export const a = 1; // nope\n');
  if (cfg) fs.writeFileSync(path.join(d, '.cleancode-gates.json'), JSON.stringify(cfg));
  return d;
}

test('hardened blocks on the comment and exits 1 — the pre-rigor behaviour', () => {
  const d = project(null);
  const { report, exitCode } = run({ root: d, options: parseArgs(['--scope', 'files:src/a.ts', '--gates', 'G5']), io: {} });
  assert.strictEqual(report.summary.status, 'blocked');
  assert.strictEqual(exitCode, 1);
  assert.strictEqual(report.rigor.level, 'hardened');
  assert.strictEqual(report.rigor.source, 'default');
});

test('sketch keeps the finding, demotes it, and does not stop the run', () => {
  const d = project(null);
  const { report, exitCode } = run({ root: d, options: parseArgs(['--scope', 'files:src/a.ts', '--gates', 'G5', '--rigor', 'sketch']), io: {} });
  assert.strictEqual(exitCode, 0);
  assert.strictEqual(report.summary.status, 'warn');
  assert.strictEqual(report.summary.blockers, 0);
  assert.strictEqual(report.summary.warnings, 1);
  const f = report.gates[0].findings[0];
  assert.strictEqual(f.severity, 'warning');
  assert.strictEqual(f.demotedFrom, 'blocker');
  assert.strictEqual(f.file, 'src/a.ts');
  assert.deepStrictEqual(report.rigor.demoted, { G5: 1 });
});

test('the level comes from the config when no flag is given', () => {
  const d = project({ schemaVersion: '1.0', rigor: 'delivery', stacks: {} });
  const { report } = run({ root: d, options: parseArgs(['--scope', 'files:src/a.ts', '--gates', 'G5']), io: {} });
  assert.strictEqual(report.rigor.level, 'delivery');
  assert.strictEqual(report.rigor.source, 'config');
  assert.strictEqual(report.gates[0].findings[0].severity, 'warning');
});

test('below hardened, G6 is skipped and reported UNMEASURED rather than passed', () => {
  const d = project(null);
  const { report } = run({ root: d, options: parseArgs(['--scope', 'files:src/a.ts', '--gates', 'G5,G6', '--rigor', 'delivery']), io: {} });
  const g6 = report.gates.find(g => g.gate === 'G6');
  assert.strictEqual(g6.status, 'skipped');
  assert.strictEqual(g6.measurement.state, 'unmeasured');
  assert.strictEqual(g6.measurement.reason, 'rigor-delivery');
  assert.ok(!report.summary.gatesRun.includes('G6'), 'a skipped gate did not run');
  assert.deepStrictEqual(report.rigor.skipped, ['G6']);
});

test('a run whose exit code is 0 because of its level says so, on stderr and in the report', () => {
  const d = project(null);
  const r = cp.spawnSync(process.execPath, [BIN, '--scope', 'files:src/a.ts', '--gates', 'G5,G6', '--rigor', 'sketch', '--out', '.cleancode'],
    { cwd: d, encoding: 'utf8' });
  assert.strictEqual(r.status, 0);
  assert.match(r.stderr, /^RIGOR sketch — 1 blocker demoted to warning \(G5\); G6 skipped$/m);
  const md = fs.readFileSync(path.join(d, '.cleancode', 'report.md'), 'utf8');
  assert.match(md, /Rigor: sketch/);
  assert.match(md, /1 blocker demoted/);
});

test('a hardened run prints no rigor line at all — the default is silent', () => {
  const d = project(null);
  const r = cp.spawnSync(process.execPath, [BIN, '--scope', 'files:src/a.ts', '--gates', 'G5', '--out', '-'], { cwd: d, encoding: 'utf8' });
  assert.doesNotMatch(r.stderr, /RIGOR/);
  const md = toMarkdown(JSON.parse(r.stdout));
  assert.doesNotMatch(md, /demoted/);
});

test('a level that demoted nothing still stamps the report — silence is not hardened', () => {
  const d = project(null);
  fs.writeFileSync(path.join(d, 'src', 'a.ts'), 'export const a = 1;\n');
  const { report } = run({ root: d, options: parseArgs(['--scope', 'files:src/a.ts', '--gates', 'G5', '--rigor', 'sketch']), io: {} });
  assert.strictEqual(report.rigor.level, 'sketch');
  assert.deepStrictEqual(report.rigor.demoted, {});
  assert.strictEqual(report.summary.status, 'pass');
});
