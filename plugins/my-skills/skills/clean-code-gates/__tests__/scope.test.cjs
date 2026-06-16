const { test } = require('node:test');
const assert = require('node:assert');
const { resolveScope, fileStack } = require('../src/scope.cjs');

const cfg = { stacks: {
  'node-ts': { roots: ['apps/backend/src', 'apps/landing/src'] },
  'dart-flutter': { roots: ['apps/mobile/lib'] },
} };

test('fileStack maps path to owning stack via roots', () => {
  assert.strictEqual(fileStack('apps/backend/src/x.ts', cfg), 'node-ts');
  assert.strictEqual(fileStack('apps/mobile/lib/y.dart', cfg), 'dart-flutter');
  assert.strictEqual(fileStack('README.md', cfg), null);
});

test('files scope keeps only files under a known stack root', () => {
  const r = resolveScope({ scope: { kind: 'files', files: ['apps/backend/src/a.ts', 'README.md'] } }, cfg, { root: '/r' });
  assert.deepStrictEqual(r.files, ['apps/backend/src/a.ts']);
  assert.deepStrictEqual(r.stacks, ['node-ts']);
});

test('diff scope uses injected gitDiff and merge-base default', () => {
  const calls = [];
  const gitDiff = (baseRef) => { calls.push(baseRef); return ['apps/mobile/lib/z.dart', 'apps/backend/src/q.ts']; };
  const r = resolveScope({ scope: { kind: 'diff', baseRef: null } }, cfg, { root: '/r', gitDiff });
  assert.deepStrictEqual(calls, [null]);
  assert.deepStrictEqual(r.stacks, ['dart-flutter', 'node-ts']);
});

test('module scope expands a path to its files via injected lister', () => {
  const listFiles = (target) => [`${target}/a.ts`, `${target}/b.ts`];
  const r = resolveScope({ scope: { kind: 'module', target: 'apps/backend/src' } }, cfg, { root: '/r', listFiles });
  assert.deepStrictEqual(r.files, ['apps/backend/src/a.ts', 'apps/backend/src/b.ts']);
  assert.deepStrictEqual(r.stacks, ['node-ts']);
});

test('diff scope carries baseRef in returned object', () => {
  const gitDiff = () => ['apps/backend/src/a.ts'];
  const r = resolveScope({ scope: { kind: 'diff', baseRef: 'origin/dev' } }, cfg, { root: '/r', gitDiff });
  assert.strictEqual(r.baseRef, 'origin/dev');
});

test('per-stack exclude globs drop generated files from scope', () => {
  const cfgX = { stacks: { 'dart-flutter': {
    roots: ['apps/mobile/lib'],
    exclude: ['**/*.g.dart', '**/*.freezed.dart', '**/__generated__/**'],
  } } };
  const r = resolveScope({ scope: { kind: 'files', files: [
    'apps/mobile/lib/src/a.dart',
    'apps/mobile/lib/src/a.g.dart',
    'apps/mobile/lib/src/a.freezed.dart',
    'apps/mobile/lib/src/gql/__generated__/schema.gql.dart',
  ] } }, cfgX, { root: '/r' });
  assert.deepStrictEqual(r.files, ['apps/mobile/lib/src/a.dart']);
});

test('exclude only applies within the owning stack (no cross-stack leakage)', () => {
  const cfgX = { stacks: {
    'dart-flutter': { roots: ['apps/mobile/lib'], exclude: ['**/*.g.dart'] },
    'node-ts': { roots: ['apps/backend/src'] },
  } };
  const r = resolveScope({ scope: { kind: 'files', files: [
    'apps/backend/src/a.g.dart',
    'apps/mobile/lib/x.g.dart',
  ] } }, cfgX, { root: '/r' });
  assert.deepStrictEqual(r.files, ['apps/backend/src/a.g.dart']);
});
