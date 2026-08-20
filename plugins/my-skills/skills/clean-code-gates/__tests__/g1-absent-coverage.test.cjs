const { test } = require('node:test');
const assert = require('node:assert');
const nodeTs = require('../src/adapters/node-ts.cjs');
const dart = require('../src/adapters/dart-flutter.cjs');

const THRESHOLDS = { statements: 85, branches: 80 };

const CASES = [
  { label: 'node-ts', find: nodeTs.fileCoverageFindings, source: 'src/a.ts', other: 'src/schema.json' },
  { label: 'dart-flutter', find: (...a) => dart._internals.fileCoverageFindings(...a), source: 'lib/a.dart', other: 'lib/assets.json' },
];

// A scoped source file that never appears in the coverage report was never
// measured. Skipping it reports the gate as pass having scored nothing — the
// exact vacuous green the gate exists to prevent.
for (const { label, find, source, other } of CASES) {
  test(`${label}: a source file absent from the coverage report is a zero-coverage blocker`, () => {
    const findings = find(source, undefined, THRESHOLDS, { gates: {} });
    assert.strictEqual(findings.length, 2, JSON.stringify(findings));
    for (const f of findings) {
      assert.strictEqual(f.severity, 'blocker');
      assert.strictEqual(f.file, source);
      assert.strictEqual(f.metric.value, 0);
    }
    const byRule = Object.fromEntries(findings.map((f) => [f.rule, f]));
    assert.strictEqual(byRule['coverage/statements'].metric.limit, 85);
    assert.strictEqual(byRule['coverage/branches'].metric.limit, 80);
  });

  test(`${label}: a non-source file under a stack root is not blocked`, () => {
    assert.deepStrictEqual(find(other, undefined, THRESHOLDS, { gates: {} }), []);
  });

  test(`${label}: stackCfg.exclude still suppresses the finding`, () => {
    const dir = source.split('/')[0];
    assert.deepStrictEqual(find(source, undefined, THRESHOLDS, { gates: {}, exclude: [`${dir}/**`] }), []);
  });

  test(`${label}: gates.G1.exempt still suppresses the finding`, () => {
    assert.deepStrictEqual(find(source, undefined, THRESHOLDS, { gates: { G1: { exempt: [source] } } }), []);
  });

  test(`${label}: no thresholds configured yields no findings`, () => {
    assert.deepStrictEqual(find(source, undefined, {}, { gates: {} }), []);
  });
}

// The absent-coverage change gated the non-Dart skip on `!entry`, so a non-Dart
// file that happened to carry an lcov entry started being scored — a widening
// nothing asked for, and one backward compatibility says to close.
test('dart-flutter: a non-Dart file carrying an lcov entry is not scored', () => {
  const entry = { lh: 1, lf: 10, fnh: 0, fnf: 1, brh: 1, brf: 10 };
  assert.deepStrictEqual(dart._internals.fileCoverageFindings('lib/assets.json', entry, THRESHOLDS, { gates: {} }), []);
});

// The `CASES` loop above only ever passes `entry: undefined` — the one argument
// for which the two adapters agree — so it reads as a parity they do not have.
// With an entry present they diverge, and this pins that divergence as today's
// deliberate behaviour rather than repairing it: node-ts's G1 has ALWAYS scored
// any scoped file carrying a coverage entry (the pre-change loop at 09fa490 had
// no `TS_FILE_RE` filter at all), while dart's has always filtered on
// `DART_FILE_RE`. Narrowing node-ts to match would itself be the backward-compat
// break. Asserting both sides in one test keeps it honest in either direction.
test('node-ts scores a non-source file carrying a coverage entry where dart-flutter does not', () => {
  const scored = nodeTs.fileCoverageFindings(
    'src/schema.json', { statements: { pct: 50 }, branches: { pct: 90 } }, THRESHOLDS, { gates: {} });
  assert.strictEqual(scored.length, 1, JSON.stringify(scored));
  assert.strictEqual(scored[0].rule, 'coverage/statements');
  assert.strictEqual(scored[0].file, 'src/schema.json');

  assert.deepStrictEqual(
    dart._internals.fileCoverageFindings(
      'lib/assets.json', { lh: 5, lf: 10, fnh: 1, fnf: 1, brh: 9, brf: 10 }, THRESHOLDS, { gates: {} }),
    [],
    'dart-flutter filters the same shape out — the divergence this test exists to pin',
  );
});

test('node-ts: G1_EXEMPTIONS still suppresses the finding', () => {
  assert.deepStrictEqual(nodeTs.fileCoverageFindings('src/user.interface.ts', undefined, THRESHOLDS, { gates: {} }), []);
});

test('dart-flutter: G1_EXEMPTIONS still suppresses the finding', () => {
  assert.deepStrictEqual(dart._internals.fileCoverageFindings('lib/main.dart', undefined, THRESHOLDS, { gates: {} }), []);
});

test('node-ts: TEST_FILE_RE still suppresses the finding', () => {
  assert.deepStrictEqual(nodeTs.fileCoverageFindings('src/a.spec.ts', undefined, THRESHOLDS, { gates: {} }), []);
});

test('dart-flutter: TEST_FILE_RE still suppresses the finding', () => {
  assert.deepStrictEqual(dart._internals.fileCoverageFindings('lib/a_test.dart', undefined, THRESHOLDS, { gates: {} }), []);
});

test('node-ts: a measured entry is scored exactly as before', () => {
  const entry = { statements: { pct: 50 }, branches: { pct: 90 } };
  const findings = nodeTs.fileCoverageFindings('src/a.ts', entry, THRESHOLDS, { gates: {} });
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].rule, 'coverage/statements');
  assert.strictEqual(findings[0].metric.value, 50);
});

test('dart-flutter: a measured entry is scored exactly as before', () => {
  const entry = { lh: 5, lf: 10, fnh: 1, fnf: 1, brh: 9, brf: 10 };
  const findings = dart._internals.fileCoverageFindings('lib/a.dart', entry, THRESHOLDS, { gates: {} });
  assert.ok(findings.some((f) => f.rule === 'coverage/statements' && f.metric.value === 50));
});
