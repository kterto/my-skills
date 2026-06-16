const { test } = require('node:test');
const assert = require('node:assert');
const { buildReport, toMarkdown } = require('../src/report.cjs');

const base = {
  scope: { kind: 'project', files: ['a.ts'], stacks: ['node-ts'] },
  gateResults: [
    { gate: 'G5', name: 'no-comments', stack: 'node-ts', status: 'fail', tool: 'builtin',
      findings: [{ id: 'G5-a.ts:2', severity: 'blocker', file: 'a.ts', line: 2, rule: 'no-comments', message: 'x', fixHint: 'y' }] },
    { gate: 'G6', name: 'mutation', stack: 'node-ts', status: 'missing_tool', tool: 'stryker', findings: [], installHint: 'add stryker' },
  ],
  now: '2026-05-31T00:00:00Z', version: '0.1.0',
};

test('summary.status is blocked when any blocker finding exists', () => {
  const r = buildReport(base);
  assert.strictEqual(r.summary.status, 'blocked');
  assert.strictEqual(r.summary.blockers, 1);
  assert.deepStrictEqual(r.summary.gatesMissingTool, ['G6']);
  assert.deepStrictEqual(r.summary.gatesRun, ['G5']);
});

test('status pass when no findings and no blockers', () => {
  const r = buildReport({ ...base, gateResults: [{ gate: 'G5', name: 'no-comments', stack: 'node-ts', status: 'pass', tool: 'builtin', findings: [] }] });
  assert.strictEqual(r.summary.status, 'pass');
});

test('toMarkdown renders a per-gate section and the blocker', () => {
  const md = toMarkdown(buildReport(base));
  assert.match(md, /G5/);
  assert.match(md, /a\.ts:2/);
  assert.match(md, /missing_tool/i);
});
