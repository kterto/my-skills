const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const adapter = require('../src/adapters/node-ts.cjs');
const { defaultStackConfig } = require('../defaults.cjs');

function tmpProject() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-runner-'));
  fs.writeFileSync(path.join(d, 'package.json'), '{}');
  fs.writeFileSync(path.join(d, 'tsconfig.json'), '{}');
  fs.mkdirSync(path.join(d, 'src'), { recursive: true });
  fs.writeFileSync(path.join(d, 'src', 'a.ts'), 'export const a = 1;\n');
  return d;
}

function stubBin(root, name) {
  const dir = path.join(root, 'node_modules', '.bin');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), '#!/bin/sh\nexit 0\n');
}

// ---- resolveRunner / detectRunner matrix -------------------------------

test('detectRunner: vitest-only → vitest', () => {
  const d = tmpProject();
  stubBin(d, 'vitest');
  assert.equal(adapter.detectRunner(d), 'vitest');
});

test('detectRunner: jest-only → jest', () => {
  const d = tmpProject();
  stubBin(d, 'jest');
  assert.equal(adapter.detectRunner(d), 'jest');
});

test('detectRunner: both present → jest (back-compat tie-break)', () => {
  const d = tmpProject();
  stubBin(d, 'jest');
  stubBin(d, 'vitest');
  assert.equal(adapter.detectRunner(d), 'jest');
});

test('detectRunner: neither → null', () => {
  const d = tmpProject();
  assert.equal(adapter.detectRunner(d), null);
});

test('resolveRunner: explicit override wins over detection', () => {
  const d = tmpProject();
  stubBin(d, 'jest'); // detection would say jest
  assert.equal(adapter.resolveRunner(d, 'vitest'), 'vitest');
  assert.equal(adapter.resolveRunner(d, 'jest'), 'jest');
});

test('resolveRunner: auto / undefined falls back to detection', () => {
  const d = tmpProject();
  stubBin(d, 'vitest');
  assert.equal(adapter.resolveRunner(d, 'auto'), 'vitest');
  assert.equal(adapter.resolveRunner(d, undefined), 'vitest');
});

// ---- G1 vitest branches -------------------------------------------------

test('G1: vitest detected but no coverage provider → missing_tool naming the provider', () => {
  const d = tmpProject();
  stubBin(d, 'vitest');
  const cfg = defaultStackConfig('node-ts');
  const res = adapter.run('G1', ['src/a.ts'], cfg, { root: d });
  assert.equal(res.status, 'missing_tool');
  assert.match(res.installHint, /@vitest\/coverage-v8/);
});

test('G1: no test runner at all → missing_tool', () => {
  const d = tmpProject();
  const cfg = defaultStackConfig('node-ts');
  const res = adapter.run('G1', ['src/a.ts'], cfg, { root: d });
  assert.equal(res.status, 'missing_tool');
});

test('G1: explicit gates.G1.tool=vitest override forces vitest path', () => {
  const d = tmpProject();
  stubBin(d, 'jest'); // jest present, but config forces vitest
  const cfg = defaultStackConfig('node-ts');
  cfg.gates.G1.tool = 'vitest';
  const res = adapter.run('G1', ['src/a.ts'], cfg, { root: d });
  assert.equal(res.status, 'missing_tool');
  assert.match(res.installHint, /@vitest\/coverage-v8/);
});

// ---- G6 vitest branch ---------------------------------------------------

test('G6: vitest runner but no @stryker-mutator/vitest-runner → missing_tool', () => {
  const d = tmpProject();
  stubBin(d, 'stryker');
  stubBin(d, 'vitest');
  const cfg = defaultStackConfig('node-ts');
  const res = adapter.run('G6', ['src/a.ts'], cfg, { root: d });
  assert.equal(res.status, 'missing_tool');
  assert.match(res.installHint, /@stryker-mutator\/vitest-runner/);
});
