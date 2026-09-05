const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { scaffoldAdvice, formatAdvice } = require('../src/scaffold.cjs');

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-scaffold-'));
}
function stubBin(root, name) {
  const dir = path.join(root, 'node_modules', '.bin');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), '#!/bin/sh\nexit 0\n');
}
function find(advice, label) {
  return advice.find((a) => a.label === label);
}

test('node-ts: empty project → test runner missing, install suggests vitest', () => {
  const d = tmp();
  const advice = scaffoldAdvice(d, ['node-ts']);
  const runner = find(advice, 'test runner (coverage)');
  assert.equal(runner.present, false);
  assert.match(runner.install, /vitest/);
  assert.match(runner.install, /jest/); // both offered
});

test('node-ts: jest binary present → test runner satisfied', () => {
  const d = tmp();
  stubBin(d, 'jest');
  const runner = find(scaffoldAdvice(d, ['node-ts']), 'test runner (coverage)');
  assert.equal(runner.present, true);
});

test('node-ts: vitest-only surfaces the coverage-provider need', () => {
  const d = tmp();
  stubBin(d, 'vitest');
  const advice = scaffoldAdvice(d, ['node-ts']);
  const provider = find(advice, 'vitest coverage provider');
  assert.ok(provider, 'provider entry present when vitest is the runner');
  assert.equal(provider.present, false);
  assert.match(provider.install, /@vitest\/coverage-v8/);
});

test('node-ts: stryker + dependency-cruiser entries carry install commands', () => {
  const d = tmp();
  const advice = scaffoldAdvice(d, ['node-ts']);
  assert.match(find(advice, 'stryker (mutation)').install, /@stryker-mutator\/core/);
  assert.match(find(advice, 'dependency-cruiser').install, /dependency-cruiser/);
});

test('dart-flutter: dart_code_linter + both G6 tools advertised with install commands', () => {
  const d = tmp();
  const advice = scaffoldAdvice(d, ['dart-flutter']);
  assert.match(find(advice, 'dart_code_linter').install, /dart pub add -d dart_code_linter/);
  assert.match(find(advice, 'mutation_test (default)').install, /dart pub global activate mutation_test/);
  assert.match(
    find(advice, 'dart_mutant (only with gates.G6.tool: "dart_mutant")').install,
    /brew install dart_mutant/,
  );
});

test('formatAdvice: advice-only banner + no supported stack message', () => {
  const d = tmp();
  const text = formatAdvice(scaffoldAdvice(d, []), []);
  assert.match(text, /advice only/);
  assert.match(text, /no supported stack/);
});

test('formatAdvice: lists install command for a missing tool', () => {
  const d = tmp();
  const text = formatAdvice(scaffoldAdvice(d, ['node-ts']), ['node-ts']);
  assert.match(text, /npm i -D/);
  assert.match(text, /\[node-ts\]/);
});

test('dart-flutter: the dart_mutant entry is declared a fallback, not a requirement', () => {
  const d = tmp();
  const fallback = find(
    scaffoldAdvice(d, ['dart-flutter']),
    'dart_mutant (only with gates.G6.tool: "dart_mutant")',
  );
  assert.equal(fallback.optional, true);
});

test('formatAdvice: an absent optional tool is not a gap and is not marked MISS', () => {
  // Driven directly rather than through scaffoldAdvice: whether dart_mutant is
  // installed on the machine running the tests is not what this asserts.
  const advice = [
    { stack: 'dart-flutter', gates: 'G2/G4', label: 'dart_code_linter', present: false, install: 'x' },
    { stack: 'dart-flutter', gates: 'G6', label: 'mutation_test (default)', present: true, install: 'y' },
    { stack: 'dart-flutter', gates: 'G6', label: 'dart_mutant (fallback)', present: false, install: 'z', optional: true },
  ];
  const text = formatAdvice(advice, ['dart-flutter']);
  // One real gap, not two: G6 is satisfied by mutation_test alone.
  assert.match(text, /^1 tool group\(s\) missing/m);
  assert.match(text, /opt\s+G6\s+dart_mutant \(fallback\)/);
  assert.doesNotMatch(text, /MISS.*dart_mutant/);
  // Its install line still shows, because it is advice worth having.
  assert.match(text, /↳ z/);
});
