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
const { g6OnBound } = require('../src/adapters/g6-budget.cjs');
const { buildReport } = require('../src/report.cjs');

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
  fs.rmSync(path.dirname(p), { recursive: true, force: true });
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
  assert.equal(r.measurement.reason, 'bounded');
});

test('runG6: a runner killed by a signal inside the budget reports killed, never bounded', () => {
  // The OOM killer, a crash or an operator: nothing the engine's own clock did.
  const root = tmpProject();
  const execFileSync = () => {
    const e = new Error('Command failed: stryker run');
    e.signal = 'SIGKILL';
    e.status = null;
    throw e;
  };
  const r = runG6(['src/a.ts'], cfg, { root }, { execFileSync });
  assert.equal(r.status, 'error');
  assert.equal(r.measurement.state, 'unmeasured');
  assert.equal(r.measurement.reason, 'killed');
  assert.equal(r.measurement.onBound, undefined, 'only the engine\'s own bound carries the policy');
  assert.match(r.findings[0].message, /killed by SIGKILL/);
  assert.doesNotMatch(r.findings[0].message, /exceeded/);
});

test('runG6: both temp dirs are removed on every path', () => {
  const root = tmpProject();
  const paths = (args) => {
    const cfgPath = args[1];
    return { cfgDir: path.dirname(cfgPath), reportPath: JSON.parse(fs.readFileSync(cfgPath, 'utf8')).jsonReporter.fileName };
  };
  const outcomes = {
    scored: (bin, args) => {
      const { reportPath } = paths(args);
      fs.writeFileSync(reportPath, JSON.stringify({ files: { 'src/a.ts': { mutants: [mutant('Killed')] } } }));
    },
    bounded: () => { const e = new Error('spawn timed out'); e.code = 'ETIMEDOUT'; throw e; },
    unparseable: (bin, args) => { fs.writeFileSync(paths(args).reportPath, '{ torn'); },
  };
  for (const [label, behave] of Object.entries(outcomes)) {
    let seen = null;
    const execFileSync = (bin, args, o) => {
      seen = paths(args);
      return behave(bin, args, o);
    };
    const r = runG6(['src/a.ts'], cfg, { root }, { execFileSync });
    assert.ok(r.status, label);
    assert.ok(!fs.existsSync(seen.cfgDir), `${label}: the Stryker config dir was left behind`);
    assert.ok(!fs.existsSync(path.dirname(seen.reportPath)), `${label}: the report dir was left behind`);
  }
});

// ---- the bound policy (gates.G6.on_bound) --------------------------------

test('g6OnBound: disclose by default, stop for any value it does not recognise', () => {
  assert.equal(g6OnBound(cfg.gates.G6), 'disclose');
  assert.equal(g6OnBound({}), 'disclose', 'an absent key is the default, not an invalid value');
  assert.equal(g6OnBound({ on_bound: 'stop' }), 'stop');
  assert.equal(g6OnBound({ on_bound: 'disclosed' }), 'stop', 'a typo falls back to the legacy park');
});

test('runG6: a bounded run carries its policy, and is the same non-pass under every policy', () => {
  const root = tmpProject();
  const execFileSync = () => {
    const e = new Error('spawn timed out');
    e.code = 'ETIMEDOUT';
    throw e;
  };
  const withPolicy = (onBound) => ({ ...cfg, gates: { ...cfg.gates, G6: { ...cfg.gates.G6, on_bound: onBound } } });
  const runs = {
    disclose: runG6(['src/a.ts'], cfg, { root }, { execFileSync }),
    stop: runG6(['src/a.ts'], withPolicy('stop'), { root }, { execFileSync }),
    typo: runG6(['src/a.ts'], withPolicy('disclosed'), { root }, { execFileSync }),
  };
  assert.equal(runs.disclose.measurement.onBound, 'disclose');
  assert.equal(runs.stop.measurement.onBound, 'stop');
  assert.equal(runs.typo.measurement.onBound, 'stop');
  for (const r of Object.values(runs)) {
    assert.equal(r.measurement.state, 'unmeasured');
    assert.equal(r.measurement.reason, 'bounded');
    assert.equal(r.measurement.budgetSeconds, 1800);
    const report = buildReport({ scope: { kind: 'files', files: ['src/a.ts'], stacks: ['node-ts'] }, gateResults: [r] });
    assert.notEqual(report.summary.status, 'pass', 'a bounded G6 must never read as a pass');
  }
  // The policy decides whether a run waits, never its verdict.
  const verdict = (r) => ({ ...r, measurement: { ...r.measurement, onBound: undefined } });
  assert.deepStrictEqual(verdict(runs.disclose), verdict(runs.stop));
});
