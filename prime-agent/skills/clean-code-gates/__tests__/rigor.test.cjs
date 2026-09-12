const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseArgs } = require('../src/args.cjs');
const { loadConfig } = require('../src/config.cjs');
const { RIGOR_POLICY, gateAction, resolveRigor, applyRigor } = require('../src/rigor.cjs');

// A selectable standard is a selectable verdict. These tests pin the two
// properties that keep it from being one: a lower level demotes findings, it
// never deletes them; and the level itself is anchored, so the change under
// review cannot set the bar it is about to be measured against.

function tmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-rigor-'));
  fs.writeFileSync(path.join(d, 'package.json'), '{}');
  fs.writeFileSync(path.join(d, 'tsconfig.json'), '{}');
  return d;
}

test('the default is hardened — every gate blocks, exactly as before rigor existed', () => {
  for (const g of ['G1', 'G2', 'G4', 'G5', 'G6', 'G7']) {
    assert.strictEqual(gateAction('hardened', g), 'block', `${g} must block at hardened`);
  }
  assert.strictEqual(resolveRigor({ baseRef: null }, {}).level, 'hardened');
});

test('delivery blocks coverage only — the happy path is what it claims', () => {
  assert.strictEqual(gateAction('delivery', 'G1'), 'block');
  for (const g of ['G2', 'G4', 'G5', 'G7']) assert.strictEqual(gateAction('delivery', g), 'report');
  assert.strictEqual(gateAction('delivery', 'G6'), 'skip');
});

test('sketch blocks nothing and claims nothing', () => {
  for (const g of ['G1', 'G2', 'G4', 'G5', 'G7']) assert.strictEqual(gateAction('sketch', g), 'report');
  assert.strictEqual(gateAction('sketch', 'G6'), 'skip');
});

test('an unknown gate id falls back to blocking, never to reporting', () => {
  assert.strictEqual(gateAction('sketch', 'G9'), 'block');
  assert.strictEqual(gateAction('delivery', 'G9'), 'block');
});

test('--rigor is parsed and outranks the config file', () => {
  assert.strictEqual(parseArgs([]).rigor, null);
  assert.strictEqual(parseArgs(['--rigor', 'sketch']).rigor, 'sketch');
  assert.throws(() => parseArgs(['--rigor', 'medium']), /rigor/i);
  const r = resolveRigor({ rigor: 'sketch' }, { rigor: 'hardened' });
  assert.deepStrictEqual(r, { level: 'sketch', source: 'cli' });
});

test('with no flag the level comes from the config, and its absence means hardened', () => {
  assert.deepStrictEqual(resolveRigor({}, { rigor: 'delivery' }), { level: 'delivery', source: 'config' });
  assert.deepStrictEqual(resolveRigor({}, {}), { level: 'hardened', source: 'default' });
});

test('an unrecognised level in the config fails closed to hardened rather than to the lowest bar', () => {
  assert.deepStrictEqual(resolveRigor({}, { rigor: 'yolo' }), { level: 'hardened', source: 'default' });
});

test('rigor is anchored: a branch that demotes itself runs at the merge-base level', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, '.cleancode-gates.json'), JSON.stringify({ schemaVersion: '1.0', rigor: 'sketch', stacks: {} }));
  const cfg = loadConfig(d, ['node-ts'], {
    baseRef: 'mb', readBase: () => JSON.stringify({ schemaVersion: '1.0', rigor: 'hardened', stacks: {} }),
  });
  assert.strictEqual(cfg.rigor, 'hardened');
  assert.deepStrictEqual(cfg.instrument.moves.find(m => m.key === 'rigor'),
    { key: 'rigor', from: 'hardened', to: 'sketch', direction: 'loosening' });
});

test('raising rigor on the branch is a tightening, and it does not take effect either', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, '.cleancode-gates.json'), JSON.stringify({ schemaVersion: '1.0', rigor: 'hardened', stacks: {} }));
  const cfg = loadConfig(d, ['node-ts'], {
    baseRef: 'mb', readBase: () => JSON.stringify({ schemaVersion: '1.0', rigor: 'sketch', stacks: {} }),
  });
  assert.strictEqual(cfg.rigor, 'sketch');
  assert.strictEqual(cfg.instrument.moves.find(m => m.key === 'rigor').direction, 'tightening');
});

const finding = (rule) => ({ id: `x-${rule}`, severity: 'blocker', file: 'a.ts', line: 1, rule, message: 'm' });

test('a demoted finding is kept, marked, and attributed to the level that demoted it', () => {
  const results = [{ gate: 'G2', name: 'complexity', stack: 'node-ts', status: 'fail', tool: 'eslint', findings: [finding('complexity')] }];
  const { gateResults, rigor } = applyRigor('sketch', results);
  const f = gateResults[0].findings[0];
  assert.strictEqual(f.severity, 'warning');
  assert.strictEqual(f.demotedFrom, 'blocker');
  assert.strictEqual(f.rigor, 'sketch');
  assert.strictEqual(f.rule, 'complexity', 'the finding keeps everything a fixer needs');
  assert.strictEqual(gateResults[0].status, 'warn', 'a gate whose blockers were all demoted no longer fails');
  assert.deepStrictEqual(rigor.demoted, { G2: 1 });
  assert.deepStrictEqual(rigor.reportOnly, ['G2']);
});

test('a blocking gate at the same level is untouched', () => {
  const results = [{ gate: 'G1', name: 'coverage', stack: 'node-ts', status: 'fail', tool: 'jest', findings: [finding('coverage')] }];
  const { gateResults, rigor } = applyRigor('delivery', results);
  assert.strictEqual(gateResults[0].findings[0].severity, 'blocker');
  assert.strictEqual(gateResults[0].status, 'fail');
  assert.deepStrictEqual(rigor.demoted, {});
});

test('hardened changes nothing at all — the results object is returned as it came in', () => {
  const results = [{ gate: 'G2', name: 'complexity', stack: 'node-ts', status: 'fail', tool: 'eslint', findings: [finding('complexity')] }];
  const { gateResults, rigor } = applyRigor('hardened', results);
  assert.strictEqual(gateResults[0].findings[0].severity, 'blocker');
  assert.strictEqual(gateResults[0].findings[0].demotedFrom, undefined);
  assert.deepStrictEqual(rigor.demoted, {});
  assert.deepStrictEqual(rigor.reportOnly, []);
});

test('a warning is not touched by a demotion — only blockers move', () => {
  const results = [{ gate: 'G7', name: 'deps', stack: 'node-ts', status: 'warn', tool: 'depcruise',
    findings: [{ id: 'w', severity: 'warning', file: 'a.ts', line: 1, rule: 'r', message: 'm' }] }];
  const { gateResults, rigor } = applyRigor('sketch', results);
  assert.strictEqual(gateResults[0].findings[0].severity, 'warning');
  assert.strictEqual(gateResults[0].findings[0].demotedFrom, undefined);
  assert.deepStrictEqual(rigor.demoted, {});
});
