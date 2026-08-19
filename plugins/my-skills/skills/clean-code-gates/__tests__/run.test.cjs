const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { run, registerAdapter, assertNonEmptyScope, sourcePredicate } = require('../src/run.cjs');
const {
  cssOnlyCommitRepo, docsOnlyCommitRepo, docsOnlyProject,
  EMPTY_FILES_SCOPE, EMPTY_MODULE_SCOPE, UNGATEABLE_FILES_SCOPE, UNGATEABLE_MODULE_SCOPE,
} = require('./fixtures/empty-scope.cjs');

const invoke = (root, scope, extra) => run({
  root,
  options: { scope, gates: null, skip: [], out: '-', scaffold: false, requireTools: false, ...extra },
  io: { now: 'n', version: 'v' },
});

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

// Two runs that measured exactly nothing used to get opposite verdicts: an
// errored gate exits 4, while a scope holding no gateable file reported the
// byte-identical `gatesRun: []` as `pass` and exit 0.
test('an empty files: scope throws instead of passing with nothing measured', () => {
  assert.throws(() => invoke(docsOnlyProject(), EMPTY_FILES_SCOPE), /zero gateable files/i);
});

// `/module/` also matches Node's own `Cannot find module` / `MODULE_NOT_FOUND`,
// so the assertion could be satisfied by the exact opposite of what the test
// name promises. The message shape is pinned instead.
test('an empty module: scope throws and the message names the scope kind', () => {
  assert.throws(() => invoke(docsOnlyProject(), EMPTY_MODULE_SCOPE), /zero gateable files \(module\)/);
});

test('an empty diff: scope names its base ref and says nothing was measured', () => {
  let message = '';
  try { invoke(docsOnlyCommitRepo(), { kind: 'diff', baseRef: 'HEAD~1' }); } catch (e) { message = e.message; }
  assert.match(message, /diff/);
  assert.match(message, /HEAD~1/);
  assert.match(message, /nothing was measured/i);
});

// A file under a stack root is kept by `resolveScope` whatever its extension,
// but every gate then filters it against that stack's `SOURCE_FILE_RE`. Counting
// scoped files instead of gateable ones let a CSS-only scope run zero gates and
// report `pass` with a named `gatesRun`, so the caller could not even tell.
test('a files: scope of only non-source files under a stack root throws', () => {
  assert.throws(() => invoke(docsOnlyProject(), UNGATEABLE_FILES_SCOPE), /zero gateable files \(files\)/);
});

test('a module: scope of only non-source files under a stack root throws', () => {
  assert.throws(() => invoke(docsOnlyProject(), UNGATEABLE_MODULE_SCOPE), /zero gateable files \(module\)/);
});

test('a diff: scope of only non-source files under a stack root throws', () => {
  assert.throws(
    () => invoke(cssOnlyCommitRepo(), { kind: 'diff', baseRef: 'HEAD~1' }),
    /zero gateable files \(diff HEAD~1\)/,
  );
});

// The project case used to empty `src` outright, which proved the weaker
// property that an empty directory is caught. Here the directory still has
// contents; only the gateable set is empty, which is what the guard is about.
test('a project: scope of only non-source files under a stack root throws', () => {
  const d = docsOnlyProject();
  fs.rmSync(path.join(d, 'src', 'a.ts'));
  assert.ok(fs.readdirSync(path.join(d, 'src')).length, 'the directory itself still has contents');
  assert.throws(() => invoke(d, { kind: 'project' }), /zero gateable files \(project\)/);
});

// The guard is a pure function of a scope and a predicate, so the "would any
// gate read this file" decision is exercised here without touching the registry.
test('the guard passes as soon as one scoped file satisfies the predicate', () => {
  const scope = { kind: 'files', files: ['src/theme.css', 'src/a.ts'] };
  assert.doesNotThrow(() => assertNonEmptyScope(scope, (rel) => rel.endsWith('.ts')));
});

test('the guard throws when no scoped file satisfies the predicate', () => {
  const scope = { kind: 'files', files: ['src/theme.css', 'src/styles/tokens.css'] };
  assert.throws(() => assertNonEmptyScope(scope, (rel) => rel.endsWith('.ts')), /zero gateable files \(files\)/);
});

test('sourcePredicate answers from the resolved stack adapter, not from the extension alone', () => {
  const isSource = sourcePredicate({ stacks: { 'node-ts': { roots: ['src'], gates: {} } } });
  assert.strictEqual(isSource('src/a.ts'), true);
  assert.strictEqual(isSource('src/theme.css'), false);
});

// `ADAPTERS` is a mutable registry. A third-party adapter that exports no
// `SOURCE_FILE_RE` must keep serving the runs it served before, so its files
// stay gateable — the same fallback ternary `runG5` uses for its own scan set.
test('a stack whose adapter exports no SOURCE_FILE_RE keeps its files gateable', () => {
  registerAdapter('bare-stack', { supports: () => false, run: () => ({}) });
  const isSource = sourcePredicate({ stacks: { 'bare-stack': { roots: ['bare'], gates: {} } } });
  assert.strictEqual(isSource('bare/anything.css'), true);
  assert.doesNotThrow(() => assertNonEmptyScope({ kind: 'files', files: ['bare/anything.css'] }, isSource));
});

test('a non-empty scope still returns a verdict rather than throwing', () => {
  const { report, exitCode } = invoke(docsOnlyProject(), { kind: 'files', files: ['src/a.ts'] }, { gates: ['G5'] });
  assert.strictEqual(report.summary.status, 'pass');
  assert.strictEqual(exitCode, 0);
});

test('non-G5 gate with no adapter yet reports missing_tool, not crash', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-run2-'));
  fs.writeFileSync(path.join(d, 'package.json'), '{}'); fs.writeFileSync(path.join(d, 'tsconfig.json'), '{}');
  fs.mkdirSync(path.join(d, 'src')); fs.writeFileSync(path.join(d, 'src/a.ts'), 'export const a=1;\n');
  const { report } = run({ root: d, options: { scope: { kind: 'files', files: ['src/a.ts'] }, gates: ['G2'], skip: [], scaffold: false, requireTools: false }, io: { now: 'n', version: 'v' } });
  assert.strictEqual(report.gates.find(g => g.gate === 'G2').status, 'missing_tool');
});
