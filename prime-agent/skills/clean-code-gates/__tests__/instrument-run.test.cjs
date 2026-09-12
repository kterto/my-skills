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

/**
 * A repo whose merge-base carries a strict config and whose working tree has
 * quietly widened it — the shape R2 exists for.
 */
function repo({ baseCfg, workingCfg }) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-instr-'));
  const git = (args) => cp.execFileSync('git', ['-C', d, ...args], { stdio: 'ignore' });
  git(['init', '-q']);
  git(['config', 'user.email', 't@t.t']);
  git(['config', 'user.name', 't']);
  fs.mkdirSync(path.join(d, 'src'), { recursive: true });
  fs.writeFileSync(path.join(d, 'package.json'), '{}');
  fs.writeFileSync(path.join(d, 'tsconfig.json'), '{}');
  fs.writeFileSync(path.join(d, 'src', 'a.ts'), 'export const a = 1;\n');
  if (baseCfg) fs.writeFileSync(path.join(d, '.cleancode-gates.json'), JSON.stringify(baseCfg, null, 2));
  git(['add', '-A']);
  git(['commit', '-qm', 'base']);
  if (workingCfg) fs.writeFileSync(path.join(d, '.cleancode-gates.json'), JSON.stringify(workingCfg, null, 2));
  fs.writeFileSync(path.join(d, 'src', 'b.ts'), 'export const b = 2; // widened\n');
  return d;
}

const cfgWith = (exclude) => ({ schemaVersion: '1.0', stacks: { 'node-ts': { exclude } } });

test('--base-ref is parsed and defaults to null', () => {
  assert.strictEqual(parseArgs([]).baseRef, null);
  assert.strictEqual(parseArgs(['--base-ref', 'origin/main']).baseRef, 'origin/main');
});

test('a diff scope anchors the instrument to the ref the diff is measured against', () => {
  const d = repo({ baseCfg: cfgWith([]), workingCfg: cfgWith(['src/b.ts']) });
  const { report } = run({ root: d, options: parseArgs(['--scope', 'diff:HEAD', '--gates', 'G5']), io: {} });
  assert.strictEqual(report.instrument.anchored, true);
  assert.strictEqual(report.instrument.baseRef, 'HEAD');
  assert.strictEqual(report.instrument.moves[0].key, 'node-ts.exclude');
  assert.strictEqual(report.instrument.moves[0].direction, 'loosening');
});

test('--base-ref outranks the scope and anchors a project-scope run too', () => {
  const d = repo({ baseCfg: cfgWith([]), workingCfg: cfgWith(['src/b.ts']) });
  const { report } = run({ root: d, options: parseArgs(['--scope', 'project', '--gates', 'G5', '--base-ref', 'HEAD']), io: {} });
  assert.strictEqual(report.instrument.anchored, true);
  assert.strictEqual(report.instrument.moves.length, 1);
});

test('a run with nothing to anchor against says so rather than claiming an anchor', () => {
  const d = repo({ baseCfg: cfgWith([]), workingCfg: cfgWith([]) });
  const { report } = run({ root: d, options: parseArgs(['--scope', 'project', '--gates', 'G5']), io: {} });
  assert.strictEqual(report.instrument.anchored, false);
  assert.deepStrictEqual(report.instrument.moves, []);
});

test('the branch exclusion does not take effect — the widened file is still gated', () => {
  const d = repo({ baseCfg: cfgWith([]), workingCfg: cfgWith(['src/b.ts']) });
  const { report } = run({ root: d, options: parseArgs(['--scope', 'diff:HEAD', '--gates', 'G5']), io: {} });
  const g5 = report.gates.find(g => g.gate === 'G5');
  assert.strictEqual(g5.status, 'fail', 'the comment in the excluded file must still be found');
  assert.ok(g5.findings.some(f => f.file === 'src/b.ts'));
});

test('the moved-instrument line reaches both the markdown report and stderr', () => {
  const d = repo({ baseCfg: cfgWith([]), workingCfg: cfgWith(['src/b.ts']) });
  const r = cp.spawnSync(process.execPath, [BIN, '--scope', 'diff:HEAD', '--gates', 'G5', '--out', '.cleancode'],
    { cwd: d, encoding: 'utf8' });
  assert.match(r.stderr, /^INSTRUMENT MOVED — node-ts\.exclude \+1 glob \(loosening\) — measured against merge-base \(HEAD\) values$/m);
  const md = fs.readFileSync(path.join(d, '.cleancode', 'report.md'), 'utf8');
  assert.match(md, /INSTRUMENT MOVED —/);
});

test('an unmoved instrument prints nothing — the line is a finding, not a banner', () => {
  const d = repo({ baseCfg: cfgWith([]), workingCfg: cfgWith([]) });
  const r = cp.spawnSync(process.execPath, [BIN, '--scope', 'diff:HEAD', '--gates', 'G5', '--out', '-'],
    { cwd: d, encoding: 'utf8' });
  assert.doesNotMatch(r.stderr, /INSTRUMENT MOVED/);
});

test('toMarkdown renders no instrument section when nothing moved', () => {
  const md = toMarkdown({
    summary: { status: 'pass', blockers: 0, warnings: 0, gatesMissingTool: [], gatesErrored: [] },
    scope: { kind: 'project', files: [], stacks: [] },
    instrument: { anchored: true, baseRef: 'origin/main', source: 'merge-base', moves: [] },
    gates: [],
  });
  assert.doesNotMatch(md, /INSTRUMENT MOVED/);
});
