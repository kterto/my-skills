const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadConfig } = require('../src/config.cjs');

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
