'use strict';
// The barrier's report parsers (contract §5.2 step 3), run on committed samples.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseReport, totals } = require('../src/instruments/reports.cjs');

const sample = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', 'instruments', 'reports', name), 'utf8');
const byFile = (parsed) => Object.fromEntries(parsed.suites.map((s) => [s.file, s]));
const pick = (s, ...keys) => Object.fromEntries(keys.map((k) => [k, s[k]]));
const COUNTS = ['result', 'executed', 'passed', 'failed', 'skipped'];

test('jest-json: suites map from runner_cwd into the repo, and a suite that failed to run is error', () => {
  const parsed = parseReport('jest-json', sample('jest-runner-cwd.json'), { cwd: 'apps/api', runnerCwd: '/app', tierId: 'e2e' });
  const s = byFile(parsed);
  assert.deepEqual(parsed.suites.map((x) => x.file),
    ['apps/api/test/notes.e2e-spec.ts', 'apps/api/test/orders.e2e-spec.ts', 'apps/api/test/widgets.e2e-spec.ts']);
  assert.deepEqual(pick(s['apps/api/test/notes.e2e-spec.ts'], ...COUNTS),
    { result: 'pass', executed: 2, passed: 2, failed: 0, skipped: 2 }, 'pending and todo count as skipped');
  const orders = s['apps/api/test/orders.e2e-spec.ts'];
  assert.deepEqual(pick(orders, ...COUNTS), { result: 'error', executed: 0, passed: 0, failed: 0, skipped: 0 });
  assert.equal(orders.message, '● Test suite failed to run');
  const widgets = s['apps/api/test/widgets.e2e-spec.ts'];
  assert.deepEqual(pick(widgets, ...COUNTS), { result: 'fail', executed: 2, passed: 1, failed: 1, skipped: 0 });
  assert.equal(widgets.failures.length, 1);
  assert.equal(widgets.failures[0].name, 'widgets PATCH /widgets/:id updates one');
  assert.match(widgets.failures[0].message, /^Error: expected 200, got 500 /);
  assert.doesNotMatch(widgets.failures[0].message, /synthetic-secret-1|\u001b/, 'messages are redacted and ANSI-free');
  assert.deepEqual(totals(parsed.suites), { executed: 4, passed: 3, failed: 1, skipped: 2 });
});

test('jest-json: a failure message is its first non-empty line, cut to 300 characters', () => {
  const doc = JSON.parse(sample('jest-runner-cwd.json'));
  doc.testResults[0].assertionResults[1].failureMessages = [`\n\n  ${'x'.repeat(400)}\nsecond line`];
  const parsed = parseReport('jest-json', JSON.stringify(doc), { cwd: 'apps/api', runnerCwd: '/app', tierId: 'e2e' });
  assert.equal(byFile(parsed)['apps/api/test/widgets.e2e-spec.ts'].failures[0].message, 'x'.repeat(300));
});

test('jest-json: a suite path outside runner_cwd makes the report unparseable, never a guess', () => {
  const doc = JSON.parse(sample('jest-runner-cwd.json'));
  doc.testResults[0].name = '/elsewhere/test/widgets.e2e-spec.ts';
  assert.equal(parseReport('jest-json', JSON.stringify(doc), { cwd: 'apps/api', runnerCwd: '/app', tierId: 'e2e' }), null);
  assert.equal(parseReport('jest-json', '{ torn', { cwd: 'apps/api', runnerCwd: '/app', tierId: 'e2e' }), null);
  assert.equal(parseReport('jest-json', null, { cwd: 'apps/api', runnerCwd: '/app', tierId: 'e2e' }), null);
});

test('junit: failure, error and skipped cases, file keys, and top-level cases in the tier\'s pseudo-suite', () => {
  const parsed = parseReport('junit', sample('junit-mixed.xml'), { cwd: 'pkg', runnerCwd: '/work/proj/pkg', tierId: 'unit' });
  const s = byFile(parsed);
  assert.deepEqual(Object.keys(s), ['pkg/test/order_spec.js', 'pkg/test/widget_spec.js', 'unit']);
  const widget = s['pkg/test/widget_spec.js'];
  assert.deepEqual(pick(widget, ...COUNTS), { result: 'fail', executed: 2, passed: 1, failed: 1, skipped: 1 });
  assert.deepEqual(widget.failures, [{ name: 'widget saves', message: 'expected saved to be true' }]);
  assert.equal(widget.hasFile, true);
  const order = s['pkg/test/order_spec.js'];
  assert.deepEqual(pick(order, ...COUNTS), { result: 'error', executed: 2, passed: 0, failed: 2, skipped: 0 },
    'a suite whose every case errored is error');
  assert.deepEqual(order.failures.map((f) => f.name), ['order boots', 'order totals']);
  assert.equal(order.failures[0].message, "Cannot find module './order'");
  assert.match(order.failures[1].message, /^TypeError: total is not a function /);
  assert.doesNotMatch(order.failures[1].message, /synthetic-secret-2/);
  const pseudo = s.unit;
  assert.deepEqual(pick(pseudo, ...COUNTS), { result: 'fail', executed: 2, passed: 1, failed: 1, skipped: 0 });
  assert.equal(pseudo.hasFile, false, 'a pseudo-suite has no file to select on a rerun');
  assert.deepEqual(pseudo.failures, [{ name: 'note top-level fails & <breaks>', message: '1 == 2' }]);
});

test('flutter-json: hidden loading tests never count, and a suite whose loading test failed is error', () => {
  const parsed = parseReport('flutter-json', sample('flutter-events.jsonl'), { cwd: 'apps/mobile', runnerCwd: '/work/app', tierId: 'mobile' });
  const s = byFile(parsed);
  assert.deepEqual(Object.keys(s), ['apps/mobile/test/order_test.dart', 'apps/mobile/test/widget_test.dart']);
  const widget = s['apps/mobile/test/widget_test.dart'];
  assert.deepEqual(pick(widget, ...COUNTS), { result: 'fail', executed: 2, passed: 1, failed: 1, skipped: 1 });
  assert.deepEqual(widget.failures, [{ name: 'widget saves a draft', message: 'Expected: true' }]);
  const order = s['apps/mobile/test/order_test.dart'];
  assert.deepEqual(pick(order, ...COUNTS), { result: 'error', executed: 0, passed: 0, failed: 0, skipped: 0 });
  assert.equal(order.message, 'Failed to load "/work/app/test/order_test.dart":');
});

test('junit: a <skipped> wins over a later <failure>, the way Node reports a failing todo test and counts it todo', () => {
  const xml = '<testsuites><testcase name="widget exports a draft" classname="test" failure="no export">'
    + '<skipped type="todo" message="not yet built"/><failure type="testCodeFailure" message="no export">[Error: no export]</failure>'
    + '</testcase><testcase name="widget saves" classname="test"/></testsuites>';
  const [unit] = parseReport('junit', xml, { cwd: 'pkg', runnerCwd: '/r', tierId: 'unit' }).suites;
  assert.deepEqual(pick(unit, ...COUNTS), { result: 'pass', executed: 1, passed: 1, failed: 0, skipped: 1 });
  assert.deepEqual(unit.failures, []);
});

test('flutter-json: a stream cut off before its done event is unparseable (vacuous), never a pass', () => {
  const lines = sample('flutter-events.jsonl').trimEnd().split('\n');
  assert.equal(JSON.parse(lines.at(-1)).type, 'done');
  const opts = { cwd: 'apps/mobile', runnerCwd: '/work/app', tierId: 'mobile' };
  assert.equal(parseReport('flutter-json', lines.slice(0, -1).join('\n'), opts), null);
  // Killed mid-test: every test that ran had passed, and the one that started never finished.
  const cut = [...lines.slice(0, 4), lines[8], lines[9], lines[10]].join('\n');
  assert.equal(parseReport('flutter-json', cut, opts), null);
});

test('flutter-json: a test that started and never finished makes its suite error, even beside a done event', () => {
  const lines = sample('flutter-events.jsonl').trimEnd().split('\n');
  const unfinished = lines.filter((l) => !/"testID":5,"result"/.test(l));
  assert.equal(unfinished.length, lines.length - 1);
  const parsed = parseReport('flutter-json', unfinished.join('\n'), { cwd: 'apps/mobile', runnerCwd: '/work/app', tierId: 'mobile' });
  const widget = byFile(parsed)['apps/mobile/test/widget_test.dart'];
  assert.equal(widget.result, 'error');
  assert.equal(widget.message, 'widget shows a title: started, never finished');
});

test('exit-code: one pseudo-suite, a pass or fail with an unknown executed count', () => {
  const pass = parseReport('exit-code', null, { cwd: '.', runnerCwd: '/r', tierId: 'smoke', exit: 0 });
  assert.deepEqual(pick(pass.suites[0], 'file', 'hasFile', ...COUNTS),
    { file: 'smoke', hasFile: false, result: 'pass', executed: null, passed: null, failed: null, skipped: null });
  assert.deepEqual(totals(pass.suites), { executed: null, passed: null, failed: null, skipped: null });
  const fail = parseReport('exit-code', null, { cwd: '.', runnerCwd: '/r', tierId: 'smoke', exit: 2 });
  assert.equal(fail.suites[0].result, 'fail');
});
