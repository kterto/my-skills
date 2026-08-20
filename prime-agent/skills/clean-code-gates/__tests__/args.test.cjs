const { test } = require('node:test');
const assert = require('node:assert');
const { parseArgs } = require('../src/args.cjs');

test('defaults: scope=project, all gates, out=./.cleancode', () => {
  const o = parseArgs([]);
  assert.deepStrictEqual(o.scope, { kind: 'project' });
  assert.strictEqual(o.gates, null);
  assert.strictEqual(o.skip.length, 0);
  assert.strictEqual(o.out, './.cleancode');
  assert.strictEqual(o.scaffold, false);
  assert.strictEqual(o.requireTools, false);
});
test('--scope diff:origin/dev parses kind+baseRef', () => {
  const o = parseArgs(['--scope', 'diff:origin/dev']);
  assert.deepStrictEqual(o.scope, { kind: 'diff', baseRef: 'origin/dev' });
});
test('--scope diff defaults baseRef to null', () => {
  assert.deepStrictEqual(parseArgs(['--scope', 'diff']).scope, { kind: 'diff', baseRef: null });
});
test('--scope module:apps/backend/src', () => {
  assert.deepStrictEqual(parseArgs(['--scope', 'module:apps/backend/src']).scope, { kind: 'module', target: 'apps/backend/src' });
});
test('--scope files:a.ts,b.dart splits', () => {
  assert.deepStrictEqual(parseArgs(['--scope', 'files:a.ts,b.dart']).scope, { kind: 'files', files: ['a.ts', 'b.dart'] });
});
test('--gates G1,G5 and --skip G6', () => {
  const o = parseArgs(['--gates', 'G1,G5', '--skip', 'G6']);
  assert.deepStrictEqual(o.gates, ['G1', 'G5']);
  assert.deepStrictEqual(o.skip, ['G6']);
});
test('--out and flags', () => {
  const o = parseArgs(['--out', '-', '--scaffold', '--require-tools']);
  assert.strictEqual(o.out, '-');
  assert.strictEqual(o.scaffold, true);
  assert.strictEqual(o.requireTools, true);
});
test('unknown scope kind throws usage error', () => {
  assert.throws(() => parseArgs(['--scope', 'bogus:x']), /unknown scope/i);
});
