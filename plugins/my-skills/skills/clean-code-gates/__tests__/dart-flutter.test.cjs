const { test } = require('node:test');
const assert = require('node:assert');
const adapter = require('../src/adapters/dart-flutter.cjs');
const { parseLcov, fileMetrics, coverageFindings, parseDclJson, g2Findings, parseAnalyzeLine, parseMutationReport, resolveImport, buildImportGraph, findCycles } = adapter._internals;

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

test('parseMutationReport extracts success verdict + undetected mutation lines', () => {
  const xml = `<?xml version="1.0"?>
<undetected-mutations>
<result rating="C" success="false"/>
<file name="lib/a.dart">
<mutation line="12"><original>&&</original><modified>||</modified></mutation>
<mutation line="20"><original>+</original><modified>-</modified></mutation>
</file>
<file name="lib/b.dart">
</file>
</undetected-mutations>`;
  const r = parseMutationReport(xml);
  assert.strictEqual(r.success, false);
  assert.deepStrictEqual(r.byFile['lib/a.dart'], [12, 20]);
  assert.deepStrictEqual(r.byFile['lib/b.dart'], []);
});

test('parseMutationReport reads success=true', () => {
  assert.strictEqual(parseMutationReport('<result rating="A" success="true"/>').success, true);
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
