const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadConfig, configWarnings } = require('../src/config.cjs');
const { g6OnBound } = require('../src/adapters/g6-budget.cjs');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-cfg-')); }

test('auto-creates .cleancode-gates.json from detected stacks', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'package.json'), '{}');
  fs.writeFileSync(path.join(d, 'tsconfig.json'), '{}');
  const cfg = loadConfig(d, ['node-ts']);
  assert.ok(fs.existsSync(path.join(d, '.cleancode-gates.json')), 'config file written');
  assert.deepStrictEqual(cfg.stacks['node-ts'].gates.G1.thresholds, { statements: 85, branches: 80 });
  assert.strictEqual(cfg.created, true);
});

test('existing config is loaded and merged over defaults (user wins)', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, '.cleancode-gates.json'), JSON.stringify({
    schemaVersion: '1.0',
    stacks: { 'node-ts': { gates: { G1: { thresholds: { statements: 90 } } } } },
  }));
  const cfg = loadConfig(d, ['node-ts']);
  assert.strictEqual(cfg.created, false);
  assert.strictEqual(cfg.stacks['node-ts'].gates.G1.thresholds.statements, 90); // user override
  assert.strictEqual(cfg.stacks['node-ts'].gates.G1.thresholds.branches, 80);   // default kept
});

test('invalid JSON config throws config error', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, '.cleancode-gates.json'), '{ not json');
  assert.throws(() => loadConfig(d, ['node-ts']), /config/i);
});

// gates.G6.on_bound: what a G6 killed on its own bound asks of the run that
// consumes the report. It never moves the verdict, so the only things to pin
// here are the default, and what an unrecognised value falls back to.

test('both stacks write gates.G6.on_bound "disclose" into the auto-created config', () => {
  const d = tmp();
  const cfg = loadConfig(d, ['node-ts', 'dart-flutter']);
  const written = JSON.parse(fs.readFileSync(path.join(d, '.cleancode-gates.json'), 'utf8'));
  assert.strictEqual(written.stacks['node-ts'].gates.G6.on_bound, 'disclose');
  assert.strictEqual(written.stacks['dart-flutter'].gates.G6.on_bound, 'disclose');
  assert.deepStrictEqual(configWarnings(cfg), []);
});

test('a config written before on_bound existed resolves to disclose, without a warning', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, '.cleancode-gates.json'), JSON.stringify({
    schemaVersion: '1.0',
    stacks: { 'dart-flutter': { gates: { G6: { tool: 'mutation_test' } } } },
  }));
  const cfg = loadConfig(d, ['dart-flutter']);
  assert.strictEqual(g6OnBound(cfg.stacks['dart-flutter'].gates.G6), 'disclose');
  assert.deepStrictEqual(configWarnings(cfg), []);
});

test('an unrecognised on_bound resolves to stop and is named in exactly one warning', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, '.cleancode-gates.json'), JSON.stringify({
    schemaVersion: '1.0',
    stacks: { 'node-ts': { gates: { G6: { on_bound: 'disclosed' } } } },
  }));
  const cfg = loadConfig(d, ['node-ts', 'dart-flutter']);
  assert.strictEqual(g6OnBound(cfg.stacks['node-ts'].gates.G6), 'stop', 'the conservative legacy behaviour');
  assert.deepStrictEqual(configWarnings(cfg), [
    'node-ts.gates.G6.on_bound "disclosed" is not one of disclose, stop — resolving to stop',
  ]);

  fs.writeFileSync(path.join(d, '.cleancode-gates.json'), JSON.stringify({
    schemaVersion: '1.0',
    stacks: { 'node-ts': { gates: { G6: { on_bound: 'stop' } } } },
  }));
  assert.deepStrictEqual(configWarnings(loadConfig(d, ['node-ts'])), [], 'stop is a policy, not a typo');
});
