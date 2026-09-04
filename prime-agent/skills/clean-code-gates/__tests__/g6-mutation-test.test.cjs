// G6 / mutation_test, driven by reports the real tool emits.
//
// Every junit fixture here was produced by mutation_test 1.8.0 on a throwaway
// Dart package, not hand-written. That distinction is the point: the previous
// suite asserted against a hand-authored document with `errors="0"` and one
// `<testcase>` per suite, and both shipped parser defects were invisible in it
// because the real writer emits neither of those shapes.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const adapter = require('../src/adapters/dart-flutter.cjs');

const {
  parseMutationTestJunit,
  parseDartMutantReport,
  g6Verdict,
  runG6,
  runMutationTest,
} = adapter._internals;

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

// mutation_test 1.8.0 over a package with one strong file, one weak file, one
// uncovered file and one file whose mutation makes the suite hang:
// tests=7 failures=3 errors=3 => detected 1, survived 3, timeout 2, notCovered 1.
const FOUR_OUTCOMES = fixture('g6-mutation-test-four-outcomes.junit.xml');
// A killed mutant in lib/strong.dart (self-closing) followed by a survivor in
// lib/weak.dart (paired). The shape that inverts a pattern-pairing parser.
const KILLED_THEN_SURVIVED = fixture('g6-mutation-test-killed-then-survived.junit.xml');
// What the tool really writes for a scope that yields no mutants: 35 bytes.
const EMPTY_SCOPE = fixture('g6-mutation-test-empty-scope.junit.xml');

const dartCfg = require('../defaults.cjs').defaultStackConfig('dart-flutter');
const io = { root: '/abs/root' };
const opts = (targets, extra = {}) => ({
  targets,
  threshold: 70,
  command: 'dart pub global run mutation_test -f junit',
  stackCfg: dartCfg,
  io,
  tool: 'mutation_test',
  ...extra,
});

// ---- D1: mutants that never ran are not mutants the tests killed ---------

test('parseMutationTestJunit scores un-run mutants against the code, not for it', () => {
  const parsed = parseMutationTestJunit(FOUR_OUTCOMES);

  assert.strictEqual(parsed.total, 7);
  assert.deepStrictEqual(parsed.counts, {
    detected: 1, survived: 3, timeout: 2, notCovered: 1, blocked: 0,
  });
  // 1 of 7 mutants was killed. The old formula read (7 - 3)/7 = 57.1%.
  assert.ok(Math.abs(parsed.score - (1 / 7) * 100) < 0.001, `score was ${parsed.score}`);
  // Of the mutants that actually ran, 1 of 4 was killed.
  assert.strictEqual(parsed.measured, 4);
  assert.ok(Math.abs(parsed.measuredScore - 25) < 0.001, `measuredScore was ${parsed.measuredScore}`);
});

test('g6Verdict compares the pessimistic score, not the inflated one', () => {
  const parsed = parseMutationTestJunit(FOUR_OUTCOMES);
  const r = g6Verdict(parsed, opts(['lib/strong.dart', 'lib/weak.dart', 'lib/uncov.dart', 'lib/slow2.dart']));
  assert.strictEqual(r.status, 'fail');
  const score = r.findings.find((f) => f.id === 'G6:score');
  assert.ok(score, 'no G6:score blocker was filed');
  // The number the operator reads has to be the one the gate compared. Counting
  // errors= as kills reports 57.1% here; only 1 of 7 mutants was actually killed.
  const reported = Number(/([\d.]+)%/.exec(score.message)[1]);
  assert.ok(reported < 20, `the blocker reported ${reported}%, which is the inflated score`);
});

// ---- D2: a killed mutant is self-closing, and must not lend its file ------

test('parseMutationTestJunit attributes a survivor to its own file, not its predecessor', () => {
  const parsed = parseMutationTestJunit(KILLED_THEN_SURVIVED);

  assert.strictEqual(parsed.counts.detected, 1);
  assert.strictEqual(parsed.counts.survived, 1);
  // The document's only survivor is lib/weak.dart:20. lib/strong.dart's mutant
  // was killed and must appear nowhere in the findings.
  assert.deepStrictEqual(parsed.byStatus.survived, { 'lib/weak.dart': [20] });
  assert.deepStrictEqual(parsed.byFile, { 'lib/weak.dart': [20] });
  assert.strictEqual(parsed.byFile['lib/strong.dart'], undefined);
});

test('parseMutationTestJunit keeps each outcome in its own bucket', () => {
  const parsed = parseMutationTestJunit(FOUR_OUTCOMES);
  assert.deepStrictEqual(parsed.byStatus.timeout, { 'lib/slow2.dart': [2, 6] });
  assert.deepStrictEqual(parsed.byStatus.notCovered, { 'lib/uncov.dart': [2] });
  // A timed-out mutant is not a survivor: it is unmeasured, and blaming the
  // test's assertions for it sends a fixer after the wrong thing.
  assert.strictEqual(parsed.byStatus.survived['lib/uncov.dart'], undefined);
  assert.ok(!(parsed.byFile['lib/slow2.dart'] || []).includes(6));
});

// ---- D3: an empty scope is nothing to verify, not a broken run -----------

test('parseMutationTestJunit reads the real empty-scope report as zero mutants', () => {
  const parsed = parseMutationTestJunit(EMPTY_SCOPE);
  assert.notStrictEqual(parsed, null);
  assert.strictEqual(parsed.total, 0);
});

test('g6Verdict passes an empty scope and marks it as measuring nothing', () => {
  const r = g6Verdict(parseMutationTestJunit(EMPTY_SCOPE), opts(['lib/enum_only.dart']));
  assert.strictEqual(r.status, 'pass');
  assert.strictEqual(r.measurement.state, 'empty');
});

// ---- a truncated report is an error, never "few mutants" -----------------

test('parseMutationTestJunit rejects a report whose elements contradict its totals', () => {
  // Cut inside the third suite, after its opening tag: the suite declares two
  // mutants and the document now carries none of them.
  const head = FOUR_OUTCOMES.indexOf('<testsuite id="10"');
  const truncated = FOUR_OUTCOMES.slice(0, FOUR_OUTCOMES.indexOf('>', head) + 1);
  assert.strictEqual(parseMutationTestJunit(truncated), null);
  assert.strictEqual(parseMutationTestJunit('not xml'), null);
  assert.strictEqual(parseMutationTestJunit(null), null);
});

test('parseMutationTestJunit rejects a report that miscounts its own outcomes', () => {
  // Every real 1.8.0 document satisfies survived == Σfailures and
  // timeout+notCovered+blocked == Σerrors. A document that declares five
  // undetected mutants while listing one is not a low score — it is not a
  // document this writer produced, and scoring it would invent a number.
  const miscounted = `<?xml version="1.0"?>
<testsuites>
  <testsuite id="0" name="x" package="x" tests="2" failures="2" errors="0" time="1.0">
    <testcase name="Line3_x_0" classname="lib/a.dart" time="0.1"/>
    <testcase name="Line4_x_0" classname="lib/a.dart" time="0.1">
      <failure type="undetected" message="undetected"/>
    </testcase>
  </testsuite>
</testsuites>`;
  assert.strictEqual(parseMutationTestJunit(miscounted), null);
});

test('parseMutationTestJunit is not fooled by markup inside comments or attributes', () => {
  const xml = `<?xml version="1.0"?>
<testsuites>
  <!-- <testcase name="Line99_x_0" classname="ghost.dart"/> -->
  <testsuite id="0" name="x" package="x" tests="1" failures="1" errors="0" time="1.0">
    <testcase name="Line8_x_0" classname="lib/a&gt;b.dart" time="1.0">
      <failure type="undetected" message="All tests passed despite changing the code!">
File: lib/a&gt;b.dart
Line: 8
</failure>
    </testcase>
  </testsuite>
</testsuites>`;
  const parsed = parseMutationTestJunit(xml);
  assert.strictEqual(parsed.total, 1);
  assert.deepStrictEqual(parsed.byStatus.survived, { 'lib/a>b.dart': [8] });
});

// ---- D5 (report side): four outcomes reach the fixer as four rules -------

test('g6Verdict files survived, not-covered and timeout as distinct rules', () => {
  const parsed = parseMutationTestJunit(FOUR_OUTCOMES);
  const r = g6Verdict(parsed, opts(['lib/strong.dart', 'lib/weak.dart', 'lib/uncov.dart', 'lib/slow2.dart']));
  const rules = new Set(r.findings.map((f) => f.rule));
  assert.ok(rules.has('mutation/survived'));
  assert.ok(rules.has('mutation/not-covered'));
  assert.ok(rules.has('mutation/timeout'));

  const notCovered = r.findings.filter((f) => f.rule === 'mutation/not-covered');
  assert.deepStrictEqual(notCovered.map((f) => `${f.file}:${f.line}`), ['lib/uncov.dart:2']);
});

test('a report where nothing ran is unmeasured, never a pass', () => {
  const allTimedOut = `<?xml version="1.0"?>
<testsuites>
  <testsuite id="0" name="x" package="x" tests="1" failures="0" errors="1" time="1.0">
    <testcase name="Line3_x_0" classname="lib/a.dart" time="30.0">
      <error type="timeout" message="The test command timed out after 30.0 s">
File: lib/a.dart
Line: 3
</error>
    </testcase>
  </testsuite>
</testsuites>`;
  const parsed = parseMutationTestJunit(allTimedOut);
  assert.strictEqual(parsed.measured, 0);
  const r = g6Verdict(parsed, opts(['lib/a.dart']));
  assert.notStrictEqual(r.status, 'pass');
  assert.strictEqual(r.measurement.state, 'unmeasured');
});

test('g6Verdict reports how much of the scope it actually measured', () => {
  const full = g6Verdict(parseMutationTestJunit(KILLED_THEN_SURVIVED), opts(['lib/strong.dart', 'lib/weak.dart']));
  assert.strictEqual(full.measurement.state, 'measured');
  assert.strictEqual(full.measurement.mutants, 2);

  const partial = g6Verdict(parseMutationTestJunit(FOUR_OUTCOMES), opts(['lib/weak.dart']));
  assert.strictEqual(partial.measurement.state, 'partial');
  assert.strictEqual(partial.measurement.measured, 4);
});

// ---- the dart_mutant path reports the same shape -------------------------

test('parseDartMutantReport splits its statuses the same way mutation_test does', () => {
  const report = JSON.stringify({
    mutationScore: 50,
    files: {
      'lib/a.dart': {
        mutants: [
          { status: 'Killed', location: { start: { line: 1 } } },
          { status: 'Survived', location: { start: { line: 2 } } },
          { status: 'NoCoverage', location: { start: { line: 3 } } },
          { status: 'Timeout', location: { start: { line: 4 } } },
        ],
      },
    },
  });
  const parsed = parseDartMutantReport(report);
  assert.strictEqual(parsed.counts.detected, 1);
  assert.strictEqual(parsed.counts.survived, 1);
  assert.strictEqual(parsed.counts.notCovered, 1);
  assert.strictEqual(parsed.counts.timeout, 1);
  assert.deepStrictEqual(parsed.byStatus.timeout, { 'lib/a.dart': [4] });
});

// ---- D6: the fallback ----------------------------------------------------

const flutterOk = () => ({ cmd: 'flutter', pre: [] });
const pinned = (tool) => ({ ...dartCfg, gates: { ...dartCfg.gates, G6: { ...dartCfg.gates.G6, tool } } });

test('G6 falls back to dart_mutant when mutation_test is not activated', () => {
  const r = runG6(['lib/calc.dart'], dartCfg, io, {
    resolveFlutter: flutterOk,
    mutationTestAvailable: () => false,
    commandExists: (c) => c === 'dart_mutant',
    runMutationTest: () => { throw new Error('mutation_test must not run'); },
    runMutant: () => JSON.stringify({ mutationScore: 90, files: {} }),
  });
  assert.strictEqual(r.tool, 'dart_mutant');
  assert.strictEqual(r.status, 'pass');
});

test('G6 reports missing_tool only when neither tool is available', () => {
  const r = runG6(['lib/calc.dart'], dartCfg, io, {
    resolveFlutter: flutterOk,
    mutationTestAvailable: () => false,
    commandExists: () => false,
  });
  assert.strictEqual(r.status, 'missing_tool');
  assert.match(r.installHint, /dart pub global activate mutation_test/);
  assert.match(r.installHint, /dart_mutant/);
});

test('an explicit dart_mutant pin never silently switches to mutation_test', () => {
  const r = runG6(['lib/calc.dart'], pinned('dart_mutant'), io, {
    resolveFlutter: flutterOk,
    commandExists: () => false,
    mutationTestAvailable: () => true,
    runMutationTest: () => { throw new Error('a pinned run must not switch tools'); },
  });
  assert.strictEqual(r.status, 'missing_tool');
});

test('G6 names the tool that actually produced the verdict', () => {
  const r = runG6(['lib/calc.dart'], dartCfg, io, {
    resolveFlutter: flutterOk,
    mutationTestAvailable: () => true,
    commandExists: () => { throw new Error('dart_mutant must not be probed'); },
    runMutationTest: () => ({ xml: KILLED_THEN_SURVIVED }),
  });
  assert.strictEqual(r.tool, 'mutation_test');
  assert.strictEqual(r.status, 'fail');
  assert.ok(r.findings.some((f) => f.rule === 'mutation/survived' && f.file === 'lib/weak.dart'));
});

// ---- D4/D7: the run declines rather than hangs ---------------------------

test('G6 refuses a scope whose worst case cannot fit the budget, and does not score it', () => {
  const r = runG6(['lib/calc.dart'], dartCfg, io, {
    resolveFlutter: flutterOk,
    mutationTestAvailable: () => true,
    runMutationTest: () => ({
      unmeasured: true,
      reason: 'mutant-cap',
      mutants: 826,
      chargeable: 800,
      worstCaseSeconds: 96000,
      budget: { perMutantSeconds: 120, totalSeconds: 1800, maxMutants: 400 },
    }),
  });
  assert.strictEqual(r.status, 'error');
  assert.strictEqual(r.measurement.state, 'unmeasured');
  assert.strictEqual(r.measurement.reason, 'mutant-cap');
  assert.strictEqual(r.measurement.mutants, 826);
  // The arithmetic that caused the refusal has to reach the report, or the
  // operator cannot tell a declined run from a broken one.
  assert.ok(r.findings.some((f) => /96000/.test(f.message) && /1800/.test(f.message)));
});

test('a run we killed on the clock is not scored from its partial report', () => {
  const r = runG6(['lib/calc.dart'], dartCfg, io, {
    resolveFlutter: flutterOk,
    mutationTestAvailable: () => true,
    runMutationTest: () => ({ xml: KILLED_THEN_SURVIVED, timedOut: true, reason: 'run-timeout' }),
  });
  assert.strictEqual(r.status, 'error');
  assert.strictEqual(r.measurement.state, 'unmeasured');
  assert.strictEqual(r.measurement.reason, 'run-timeout');
});

test('runMutationTest bounds the child process and asks for a dry run first', () => {
  const calls = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-g6-test-'));
  fs.writeFileSync(path.join(dir, 'a.dart'), 'int f() => 1;\n');
  try {
    runMutationTest(
      { cmd: 'flutter', pre: [] },
      dartCfg,
      { root: dir },
      ['a.dart'],
      {},
      {
        execFileSync: (cmd, args, o) => { calls.push({ args, o }); return ''; },
        readReport: () => EMPTY_SCOPE,
      },
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  assert.ok(calls.length >= 1, 'mutation_test was never invoked');
  assert.ok(calls[0].args.includes('-d'), 'the first invocation must be the dry run');
  for (const c of calls) {
    assert.ok(Number.isFinite(c.o.timeout) && c.o.timeout > 0, 'every invocation must carry a timeout');
    assert.strictEqual(c.o.killSignal, 'SIGKILL');
  }
});

test('a scoring run that writes no report is never scored from the preflight report', () => {
  // Both invocations write to the same path, so a scoring run that dies without
  // producing a report would otherwise be scored from the dry run's document —
  // which lists every mutant as undetected, because no test was ever run.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-g6-test-'));
  fs.writeFileSync(path.join(dir, 'a.dart'), 'int f(int a, int b) => a + b;\n');
  const dryReport = `<?xml version="1.0"?>
<testsuites>
  <testsuite id="0" name="x" package="x" tests="1" failures="1" errors="0" time="0.0">
    <testcase name="Line1_x_0" classname="a.dart" time="0.0">
      <failure type="undetected" message="undetected"/>
    </testcase>
  </testsuite>
</testsuites>`;
  try {
    // Model the report file rather than the reads: only the preflight writes it,
    // and the scoring run produces nothing. If production does not clear it, the
    // stale document is still there to be scored.
    let onDisk = null;
    let call = 0;
    const run = runMutationTest(
      { cmd: 'flutter', pre: [] }, dartCfg, { root: dir }, ['a.dart'], {},
      {
        execFileSync: () => { call += 1; if (call === 1) onDisk = dryReport; },
        readReport: () => onDisk,
        dropReport: () => { onDisk = null; },
      },
    );
    assert.strictEqual(call, 2, 'the scoring run should have been attempted');
    assert.ok(run.unmeasured, `expected an unmeasured run, got ${JSON.stringify(run)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a scope with no mutants is answered by the preflight alone', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-g6-test-'));
  fs.writeFileSync(path.join(dir, 'a.dart'), 'enum E { a, b }\n');
  try {
    let calls = 0;
    const run = runMutationTest(
      { cmd: 'flutter', pre: [] }, dartCfg, { root: dir }, ['a.dart'], {},
      { execFileSync: () => { calls += 1; }, readReport: () => EMPTY_SCOPE },
    );
    // Nothing to mutate means nothing to run: a third of a real project's files
    // are in this state, and each pointless scoring run costs a suite start.
    assert.strictEqual(calls, 1, 'the scoring run should be skipped when the preflight finds no mutants');
    assert.strictEqual(parseMutationTestJunit(run.xml).total, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('runMutationTest restores a mutated file when the run is interrupted', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-g6-test-'));
  const target = path.join(dir, 'a.dart');
  const original = 'int f(int a, int b) => a + b;\n';
  fs.writeFileSync(target, original);
  const before = process.listenerCount('SIGTERM');
  let mutated = false;
  try {
    runMutationTest(
      { cmd: 'flutter', pre: [] },
      dartCfg,
      { root: dir },
      ['a.dart'],
      {},
      {
        execFileSync: () => {
          // What an interrupted mutation_test leaves behind: a live mutation on
          // disk, and a signal listener registered so the process survives to
          // put it back.
          assert.ok(process.listenerCount('SIGTERM') > before, 'no SIGTERM listener was armed during the run');
          fs.writeFileSync(target, 'int f(int a, int b) => a - b;\n');
          mutated = true;
          const err = new Error('killed'); err.code = 'ETIMEDOUT'; throw err;
        },
        readReport: () => null,
      },
    );
    // Without this the assertion below is vacuous: a run that never mutated the
    // file trivially leaves it byte-identical.
    assert.ok(mutated, 'the injected run never executed, so restore was never exercised');
    assert.strictEqual(fs.readFileSync(target, 'utf8'), original, 'the mutation was left in the tree');
    assert.strictEqual(process.listenerCount('SIGTERM'), before, 'the signal listener was not removed');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
