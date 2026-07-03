const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('../src/adapters/dart-flutter.cjs');
const { parseLcov, fileMetrics, coverageFindings, parseDclJson, g2Findings, parseAnalyzeLine, parseDartMutantReport, g6Glob, g6Verdict, runG6, resolveImport, buildImportGraph, findCycles } = adapter._internals;

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

const LCOV = [
  'SF:lib/src/a.dart',
  'FNF:4', 'FNH:3',
  'LF:10', 'LH:9',
  'end_of_record',
  'SF:lib/src/b.dart',
  'FNF:2', 'FNH:1',
  'LF:4', 'LH:1',
  'BRF:4', 'BRH:1',
  'end_of_record',
].join('\n');

test('parseLcov extracts per-file line/function/branch counters', () => {
  const files = parseLcov(LCOV);
  assert.deepStrictEqual(Object.keys(files), ['lib/src/a.dart', 'lib/src/b.dart']);
  assert.strictEqual(files['lib/src/a.dart'].lf, 10);
  assert.strictEqual(files['lib/src/a.dart'].lh, 9);
  assert.strictEqual(files['lib/src/b.dart'].brf, 4);
});

test('fileMetrics maps statements→lines and skips branches when absent', () => {
  const files = parseLcov(LCOV);
  const a = fileMetrics(files['lib/src/a.dart']);
  assert.strictEqual(a.statements, 90);
  assert.strictEqual(a.lines, 90);
  assert.strictEqual(a.functions, 75);
  assert.strictEqual(a.branches, null); // no BRF for a.dart

  const b = fileMetrics(files['lib/src/b.dart']);
  assert.strictEqual(b.statements, 25);
  assert.strictEqual(b.branches, 25); // BRF present → checked
});

test('coverageFindings flags only metrics below threshold', () => {
  const files = parseLcov(LCOV);
  const thresholds = { statements: 85, branches: 80 };

  // a.dart: statements 90 ≥ 85 pass; branches null skipped → no findings
  assert.strictEqual(coverageFindings('lib/src/a.dart', files['lib/src/a.dart'], thresholds).length, 0);

  // b.dart: statements 25 < 85, branches 25 < 80 → two findings
  const fb = coverageFindings('lib/src/b.dart', files['lib/src/b.dart'], thresholds);
  assert.strictEqual(fb.length, 2);
  assert.strictEqual(fb[0].rule, 'coverage/statements');
  assert.strictEqual(fb[0].severity, 'blocker');
});

test('parseDclJson strips spinner preamble before the JSON document', () => {
  const raw = '[2K⠙ Analyzing...{"records":[]}';
  assert.deepStrictEqual(parseDclJson(raw), { records: [] });
  assert.strictEqual(parseDclJson('no json here'), null);
});

test('g2Findings flags raw value > threshold, ignoring DCL level bands', () => {
  const record = {
    path: 'lib/src/a.dart',
    functions: {
      'A.build': {
        codeSpan: { start: { line: 12 } },
        metrics: [
          { metricsId: 'source-lines-of-code', value: 31, level: 'none' }, // > 30 despite level=none
          { metricsId: 'cyclomatic-complexity', value: 5, level: 'none' }, // ok
        ],
      },
      'A.ok': {
        codeSpan: { start: { line: 40 } },
        metrics: [{ metricsId: 'number-of-parameters', value: 4, level: 'none' }], // == limit → ok
      },
    },
  };
  const thresholds = { 'cyclomatic-complexity': 8, 'source-lines-of-code': 30, 'number-of-parameters': 4 };
  const f = g2Findings(record, thresholds);
  assert.strictEqual(f.length, 1);
  assert.strictEqual(f[0].rule, 'source-lines-of-code');
  assert.strictEqual(f[0].line, 12);
  assert.strictEqual(f[0].severity, 'blocker');
});

test('parseAnalyzeLine splits machine format and preserves messages with pipes', () => {
  const line = "INFO|LINT|CAMEL_CASE_TYPES|/p/a.dart|1|7|7|The type name 'x' isn't right|extra";
  const r = parseAnalyzeLine(line);
  assert.strictEqual(r.type, 'LINT');
  assert.strictEqual(r.code, 'CAMEL_CASE_TYPES');
  assert.strictEqual(r.line, 1);
  assert.strictEqual(r.message, "The type name 'x' isn't right|extra");
  assert.strictEqual(parseAnalyzeLine('too|few'), null);
});

test('parseDartMutantReport (a) reads top-level score and total, no survivors when all killed', () => {
  const r = parseDartMutantReport(fixture('g6-dart-mutant-pass.json'));
  assert.strictEqual(r.score, 85);
  assert.strictEqual(r.total, 2);
  assert.deepStrictEqual(r.byFile, {});
});

test('parseDartMutantReport (b) collects survivor lines case-insensitively across statuses', () => {
  const r = parseDartMutantReport(fixture('g6-dart-mutant-fail.json'));
  assert.strictEqual(r.score, 42.5);
  assert.strictEqual(r.total, 5);
  // Survived, survived (lowercase), NoCoverage → lines 5, 8, 12; Killed (line 3) excluded.
  assert.deepStrictEqual(r.byFile['lib/calc.dart'], [5, 8, 12]);
  // no_coverage → line 7.
  assert.deepStrictEqual(r.byFile['lib/util.dart'], [7]);
});

test('parseDartMutantReport (c) returns null for malformed/empty JSON', () => {
  assert.strictEqual(parseDartMutantReport(fixture('g6-dart-mutant-malformed.json')), null);
  assert.strictEqual(parseDartMutantReport(''), null);
});

test('parseDartMutantReport (d) yields null score when mutationScore is absent', () => {
  const r = parseDartMutantReport(fixture('g6-dart-mutant-no-score.json'));
  assert.strictEqual(r.score, null);
  assert.strictEqual(r.total, 1);
  assert.deepStrictEqual(r.byFile, {});
});

test('parseDartMutantReport (e) reports zero total when files carry no mutants', () => {
  const r = parseDartMutantReport(fixture('g6-dart-mutant-zero-mutants.json'));
  assert.strictEqual(r.score, 0);
  assert.strictEqual(r.total, 0);
  assert.deepStrictEqual(r.byFile, {});
});

test('g6Glob maps the stack roots (default lib) to a single wildcard dart glob', () => {
  assert.strictEqual(g6Glob({}), 'lib/**/*.dart');
  assert.strictEqual(g6Glob({ roots: [] }), 'lib/**/*.dart');
  assert.strictEqual(g6Glob({ roots: ['lib'] }), 'lib/**/*.dart');
  assert.strictEqual(g6Glob({ roots: ['packages'] }), 'packages/**/*.dart');
  assert.strictEqual(g6Glob({ roots: ['lib', 'src'] }), '{lib,src}/**/*.dart');
});

const dartCfg = require('../defaults.cjs').defaultStackConfig('dart-flutter');
const g6Io = { root: '/abs/root' };
const g6Command = 'dart_mutant --json --quiet --ai none';
const g6Opts = (targets) => ({ targets, threshold: 70, command: g6Command, stackCfg: dartCfg, io: g6Io });

test('g6Verdict (a) passes with no findings when score ≥ threshold', () => {
  const parsed = parseDartMutantReport(fixture('g6-dart-mutant-pass.json'));
  const r = g6Verdict(parsed, g6Opts(['lib/calc.dart']));
  assert.strictEqual(r.status, 'pass');
  assert.strictEqual(r.findings.length, 0);
});

test('g6Verdict (e) passes when files carry zero mutants (nothing to verify)', () => {
  const parsed = parseDartMutantReport(fixture('g6-dart-mutant-zero-mutants.json'));
  const r = g6Verdict(parsed, g6Opts(['lib/simple.dart']));
  assert.strictEqual(r.status, 'pass');
  assert.strictEqual(r.findings.length, 0);
});

test('g6Verdict (b) fails with one score blocker plus per-line survivor warnings', () => {
  const parsed = parseDartMutantReport(fixture('g6-dart-mutant-fail.json'));
  const r = g6Verdict(parsed, g6Opts(['lib/calc.dart', 'lib/util.dart']));
  assert.strictEqual(r.status, 'fail');
  const blockers = r.findings.filter((f) => f.severity === 'blocker');
  const warnings = r.findings.filter((f) => f.severity === 'warning');
  assert.strictEqual(blockers.length, 1);
  assert.strictEqual(blockers[0].id, 'G6:score');
  assert.strictEqual(blockers[0].rule, 'mutation/score');
  assert.strictEqual(blockers[0].file, 'lib/calc.dart');
  assert.strictEqual(blockers[0].line, 1);
  assert.deepStrictEqual(blockers[0].metric, { value: 42.5, limit: 70, unit: 'percent' });
  // survivors: calc lines 5,8,12 + util line 7
  assert.strictEqual(warnings.length, 4);
  assert.deepStrictEqual(
    warnings.map((f) => `${f.file}:${f.line}`).sort(),
    ['lib/calc.dart:12', 'lib/calc.dart:5', 'lib/calc.dart:8', 'lib/util.dart:7'],
  );
  assert.strictEqual(warnings[0].rule, 'mutation/survived');
  assert.strictEqual(warnings[0].id, `G6-${warnings[0].file}:${warnings[0].line}`);
});

test('g6Verdict relativizes absolute survivor paths and skips exempt files', () => {
  const parsed = {
    score: 40,
    total: 3,
    byFile: {
      '/abs/root/lib/a.dart': [3],   // absolute → relativized
      'lib/a_test.dart': [9],        // test file → exempt
      'lib/b.g.dart': [4],           // generated glob → exempt
    },
  };
  const r = g6Verdict(parsed, g6Opts(['lib/a.dart']));
  assert.strictEqual(r.status, 'fail');
  const warnings = r.findings.filter((f) => f.severity === 'warning');
  assert.strictEqual(warnings.length, 1);
  assert.strictEqual(warnings[0].file, 'lib/a.dart');
  assert.strictEqual(warnings[0].line, 3);
});

test('g6Verdict (c/d) errors when the report is unparseable or missing a score', () => {
  assert.strictEqual(g6Verdict(null, g6Opts(['lib/a.dart'])).status, 'error');
  const noScore = parseDartMutantReport(fixture('g6-dart-mutant-no-score.json'));
  assert.strictEqual(g6Verdict(noScore, g6Opts(['lib/a.dart'])).status, 'error');
});

test('g6Verdict passes without error when there are no in-scope targets', () => {
  const r = g6Verdict(null, g6Opts([]));
  assert.strictEqual(r.status, 'pass');
  assert.strictEqual(r.findings.length, 0);
});

test('runG6 returns missing_tool when Flutter or dart_mutant is absent', () => {
  const noFlutter = runG6(['lib/a.dart'], dartCfg, g6Io, {
    resolveFlutter: () => null,
    commandExists: () => true,
    runMutant: () => { throw new Error('must not run'); },
  });
  assert.strictEqual(noFlutter.status, 'missing_tool');
  const noBinary = runG6(['lib/a.dart'], dartCfg, g6Io, {
    resolveFlutter: () => ({ cmd: 'flutter', pre: [] }),
    commandExists: () => false,
    runMutant: () => { throw new Error('must not run'); },
  });
  assert.strictEqual(noBinary.status, 'missing_tool');
});

test('runG6 passes without invoking dart_mutant when no targets are in scope', () => {
  let invoked = false;
  const r = runG6(['lib/a_test.dart', 'README.md'], dartCfg, g6Io, {
    resolveFlutter: () => ({ cmd: 'flutter', pre: [] }),
    commandExists: () => true,
    runMutant: () => { invoked = true; return null; },
  });
  assert.strictEqual(r.status, 'pass');
  assert.strictEqual(invoked, false);
});

test('runG6 wires the parsed report through the verdict matrix (fail case)', () => {
  const r = runG6(['lib/calc.dart', 'lib/util.dart'], dartCfg, g6Io, {
    resolveFlutter: () => ({ cmd: 'flutter', pre: [] }),
    commandExists: () => true,
    runMutant: () => fixture('g6-dart-mutant-fail.json'),
  });
  assert.strictEqual(r.status, 'fail');
  assert.strictEqual(r.tool, 'dart_mutant');
  assert.ok(r.findings.some((f) => f.id === 'G6:score'));
});

test('runG6 errors when the report is missing (null from the runner)', () => {
  const r = runG6(['lib/calc.dart'], dartCfg, g6Io, {
    resolveFlutter: () => ({ cmd: 'flutter', pre: [] }),
    commandExists: () => true,
    runMutant: () => null,
  });
  assert.strictEqual(r.status, 'error');
});

test('resolveImport maps package-self and relative imports, skips externals', () => {
  assert.strictEqual(resolveImport('package:app/src/x.dart', 'lib/src/y.dart', 'app'), 'lib/src/x.dart');
  assert.strictEqual(resolveImport('../models/m.dart', 'lib/src/views/v.dart', 'app'), 'lib/src/models/m.dart');
  assert.strictEqual(resolveImport('dart:async', 'lib/a.dart', 'app'), null);
  assert.strictEqual(resolveImport('package:other/x.dart', 'lib/a.dart', 'app'), null);
});

test('findCycles detects an import cycle and ignores acyclic graphs', () => {
  const cyclic = new Map([
    ['a', new Set(['b'])],
    ['b', new Set(['c'])],
    ['c', new Set(['a'])],
    ['d', new Set(['a'])],
  ]);
  const cycles = findCycles(cyclic);
  assert.strictEqual(cycles.length, 1);
  assert.ok(cycles[0].length >= 3);

  const acyclic = new Map([
    ['a', new Set(['b'])],
    ['b', new Set(['c'])],
    ['c', new Set()],
  ]);
  assert.strictEqual(findCycles(acyclic).length, 0);
});

test('buildImportGraph resolves only in-scope intra-package edges', () => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-graph-'));
  fs.mkdirSync(path.join(d, 'lib/src'), { recursive: true });
  fs.writeFileSync(path.join(d, 'lib/src/a.dart'), "import 'package:app/src/b.dart';\nimport 'dart:async';\n");
  fs.writeFileSync(path.join(d, 'lib/src/b.dart'), "import './a.dart';\n");
  const graph = buildImportGraph(['lib/src/a.dart', 'lib/src/b.dart'], d, 'app');
  assert.deepStrictEqual([...graph.get('lib/src/a.dart')], ['lib/src/b.dart']);
  assert.deepStrictEqual([...graph.get('lib/src/b.dart')], ['lib/src/a.dart']);
});
