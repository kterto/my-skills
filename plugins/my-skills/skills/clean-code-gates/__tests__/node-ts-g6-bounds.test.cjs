// G6 / Stryker: the bounds and the measurement state.
//
// The dart adapter already implements the shared G6 contract from SKILL.md —
// a budget that refuses before it spends, a hard bound on the child, and a
// `measurement` block so "did it pass" and "was it actually verified" are two
// questions. The node-ts adapter implemented none of it: an empty mutant
// denominator scored 100, and the Stryker child was spawned with no timeout at
// all. These tests pin the port.
//
// One divergence from dart is deliberate and pinned here: Stryker counts a
// `Timeout` as DETECTED (a mutant that hangs the suite was caught by the
// suite), while mutation_test's timeouts mean the mutant never ran. The
// adapters follow their own tool's semantics; the tests say so out loud.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const adapter = require('../src/adapters/node-ts.cjs');
const { defaultStackConfig } = require('../defaults.cjs');

const { g6Score, g6Verdict, g6Budget, writeStrykerConfig, runG6 } = adapter._internals || {};

const cfg = defaultStackConfig('node-ts');
const opts = (extra = {}) => ({
  targets: ['src/a.ts'],
  threshold: 70,
  command: 'stryker run',
  ...extra,
});

const mutant = (status, id = `m${status}`) => ({
  id,
  status,
  mutatorName: 'ConditionalExpression',
  location: { start: { line: 3 } },
});

function tmpProject() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-g6-node-'));
  fs.writeFileSync(path.join(d, 'package.json'), '{}');
  fs.mkdirSync(path.join(d, 'node_modules', '.bin'), { recursive: true });
  for (const bin of ['stryker', 'vitest']) {
    fs.writeFileSync(path.join(d, 'node_modules', '.bin', bin), '#!/bin/sh\nexit 0\n');
  }
  const runnerPkg = path.join(d, 'node_modules', '@stryker-mutator', 'vitest-runner');
  fs.mkdirSync(runnerPkg, { recursive: true });
  // require.resolve needs a real entry point, not just a manifest.
  fs.writeFileSync(
    path.join(runnerPkg, 'package.json'),
    '{"name":"@stryker-mutator/vitest-runner","version":"0.0.0","main":"index.js"}',
  );
  fs.writeFileSync(path.join(runnerPkg, 'index.js'), 'module.exports = {};\n');
  fs.mkdirSync(path.join(d, 'src'), { recursive: true });
  fs.writeFileSync(path.join(d, 'src', 'a.ts'), 'export const a = 1;\n');
  return d;
}

// ---- classification ----------------------------------------------------

test('g6Score: a file whose mutants were all excluded by the tool has no score', () => {
  const r = g6Score([mutant('CompileError'), mutant('Ignored'), mutant('RuntimeError')]);
  assert.equal(r.score, null, 'an empty denominator must not fabricate 100');
  assert.equal(r.valid, 0);
});

test('g6Score: Stryker timeouts count as detected', () => {
  const r = g6Score([mutant('Killed'), mutant('Timeout'), mutant('Survived')]);
  assert.equal(r.score, (2 / 3) * 100);
  assert.equal(r.undetected, 1);
});

test('g6Score: pending mutants are unrun, not undetected', () => {
  const r = g6Score([mutant('Killed'), mutant('Pending')]);
  assert.equal(r.score, 100, 'a mutant that never ran cannot lower the ratio');
  assert.equal(r.unrun, 1);
});

// ---- gate verdict ------------------------------------------------------

test('g6Verdict: an empty scope is an empty measurement, not a bare pass', () => {
  const v = g6Verdict(null, opts({ targets: [] }));
  assert.equal(v.status, 'pass');
  assert.equal(v.measurement.state, 'empty');
  assert.equal(v.measurement.mutants, 0);
});

test('g6Verdict: a report with no valid mutants passes as empty, never as a score', () => {
  const report = { files: { 'src/a.ts': { mutants: [mutant('CompileError')] } } };
  const v = g6Verdict(report, opts());
  assert.equal(v.measurement.state, 'empty');
  assert.ok(!(v.findings || []).some((f) => f.rule === 'mutation/score'));
});

test('g6Verdict: unrun mutants make the measurement partial', () => {
  const report = {
    files: { 'src/a.ts': { mutants: [mutant('Killed'), mutant('Pending')] } },
  };
  const v = g6Verdict(report, opts());
  assert.equal(v.measurement.state, 'partial');
  assert.equal(v.measurement.mutants, 2);
  assert.equal(v.measurement.measured, 1);
});

test('g6Verdict: a fully scored file is measured', () => {
  const report = {
    files: { 'src/a.ts': { mutants: [mutant('Killed'), mutant('Survived')] } },
  };
  const v = g6Verdict(report, opts());
  assert.equal(v.measurement.state, 'measured');
  assert.equal(v.status, 'fail', '50% is below the 70 threshold');
});

test('g6Verdict: a run that produced no report is unmeasured, never pass', () => {
  const v = g6Verdict(null, opts({ unmeasured: { reason: 'no-report' } }));
  assert.equal(v.status, 'error');
  assert.equal(v.measurement.state, 'unmeasured');
  assert.equal(v.measurement.reason, 'no-report');
});

// ---- bounds ------------------------------------------------------------

test('g6Budget: defaults match the documented shared G6 contract', () => {
  assert.deepEqual(g6Budget({}), {
    perMutantSeconds: 120,
    totalSeconds: 1800,
    maxMutants: 400,
  });
  assert.equal(g6Budget({ budget: { totalSeconds: 60 } }).totalSeconds, 60);
});

test('writeStrykerConfig: the per-mutant cap reaches the generated config', () => {
  const p = writeStrykerConfig(['src/a.ts'], '/tmp/out.json', [], 'vitest', {
    perMutantSeconds: 30,
    totalSeconds: 300,
    maxMutants: 400,
  });
  const written = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.equal(written.timeoutMS, 30000);
});

test('runG6: the Stryker child is bounded by the total budget and killed with SIGKILL', () => {
  const root = tmpProject();
  let seen = null;
  const execFileSync = (bin, args, o) => { seen = o; throw new Error('no report'); };
  const stackCfg = { ...cfg, gates: { ...cfg.gates, G6: { ...cfg.gates.G6, budget: { totalSeconds: 90 } } } };
  runG6(['src/a.ts'], stackCfg, { root }, { execFileSync });
  assert.equal(seen.timeout, 90000);
  assert.equal(seen.killSignal, 'SIGKILL');
});

test('runG6: a child killed on the clock reports unmeasured, not pass', () => {
  const root = tmpProject();
  const execFileSync = () => {
    const e = new Error('spawn timed out');
    e.code = 'ETIMEDOUT';
    throw e;
  };
  const r = runG6(['src/a.ts'], cfg, { root }, { execFileSync });
  assert.equal(r.status, 'error');
  assert.equal(r.measurement.state, 'unmeasured');
  assert.equal(r.measurement.reason, 'killed-on-clock');
});
