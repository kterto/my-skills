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

test('dart-flutter: dart_code_linter + dart_mutant advice with install commands', () => {
  const d = tmp();
  const advice = scaffoldAdvice(d, ['dart-flutter']);
  assert.match(find(advice, 'dart_code_linter').install, /dart pub add -d dart_code_linter/);
  assert.match(find(advice, 'dart_mutant (external CLI)').install, /brew install dart_mutant/);
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
