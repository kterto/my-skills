const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { detectStacks, detectPackages } = require('../src/detect.cjs');
const { loadConfig } = require('../src/config.cjs');
const { defaultStackConfig } = require('../defaults.cjs');
const { resolvePackageDir } = require('../src/adapters/dart-flutter.cjs');

function tree(spec) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-roots-'));
  for (const rel of spec) {
    const f = path.join(d, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, '{}');
  }
  return d;
}

// Hardcoding `roots: ['src']` at the repo root means a monorepo scopes zero
// files: nothing under `apps/backend/src` matches, so every gate runs over an
// empty file set and the run reports pass having measured nothing.
test('detectPackages preserves the package directory of a node-ts monorepo package', () => {
  const d = tree(['apps/backend/package.json', 'apps/backend/tsconfig.json']);
  assert.deepStrictEqual(detectPackages(d), [{ stack: 'node-ts', dir: 'apps/backend' }]);
});

test('detectPackages preserves every package of the same stack', () => {
  const d = tree([
    'apps/api/package.json', 'apps/api/tsconfig.json',
    'apps/web/package.json', 'apps/web/tsconfig.json',
  ]);
  assert.deepStrictEqual(detectPackages(d), [
    { stack: 'node-ts', dir: 'apps/api' },
    { stack: 'node-ts', dir: 'apps/web' },
  ]);
});

test('detectPackages preserves a polyglot monorepo, sorted', () => {
  const d = tree([
    'apps/backend/package.json', 'apps/backend/tsconfig.json',
    'apps/mobile/pubspec.yaml',
  ]);
  assert.deepStrictEqual(detectPackages(d), [
    { stack: 'dart-flutter', dir: 'apps/mobile' },
    { stack: 'node-ts', dir: 'apps/backend' },
  ]);
});

test('detectStacks keeps its existing string-array contract', () => {
  const d = tree([
    'apps/api/package.json', 'apps/api/tsconfig.json',
    'apps/web/package.json', 'apps/web/tsconfig.json',
    'apps/mobile/pubspec.yaml',
  ]);
  assert.deepStrictEqual(detectStacks(d), ['dart-flutter', 'node-ts']);
});

test('roots are derived relative to each detected package', () => {
  const d = tree([
    'apps/api/package.json', 'apps/api/tsconfig.json',
    'apps/web/package.json', 'apps/web/tsconfig.json',
    'apps/mobile/pubspec.yaml',
  ]);
  const cfg = loadConfig(d, detectPackages(d));
  assert.deepStrictEqual(cfg.stacks['node-ts'].roots, ['apps/api/src', 'apps/web/src']);
  assert.deepStrictEqual(cfg.stacks['dart-flutter'].roots, ['apps/mobile/lib']);
});

test('a single-package repo at the project root keeps today defaults byte-for-byte', () => {
  const d = tree(['package.json', 'tsconfig.json']);
  const cfg = loadConfig(d, detectPackages(d));
  assert.deepStrictEqual(cfg.stacks['node-ts'], defaultStackConfig('node-ts'));
  assert.deepStrictEqual(cfg.stacks['node-ts'].roots, ['src']);
});

test('defaultStackConfig without package dirs is unchanged', () => {
  assert.deepStrictEqual(defaultStackConfig('node-ts').roots, ['src']);
  assert.deepStrictEqual(defaultStackConfig('dart-flutter').roots, ['lib']);
  assert.deepStrictEqual(defaultStackConfig('unknown'), { roots: [], gates: {} });
});

test('loadConfig still accepts the legacy array-of-stack-names form', () => {
  const d = tree(['package.json', 'tsconfig.json']);
  const cfg = loadConfig(d, ['node-ts']);
  assert.deepStrictEqual(cfg.stacks['node-ts'].roots, ['src']);
});

test('an existing .cleancode-gates.json loads and executes unchanged', () => {
  const d = tree(['package.json', 'tsconfig.json']);
  fs.writeFileSync(path.join(d, '.cleancode-gates.json'), JSON.stringify({
    schemaVersion: '1.0',
    stacks: { 'node-ts': { roots: ['lib', 'src'], gates: { G5: { tool: 'builtin' } } } },
  }));
  const cfg = loadConfig(d, detectPackages(d));
  assert.strictEqual(cfg.created, false);
  assert.deepStrictEqual(cfg.stacks['node-ts'].roots, ['lib', 'src']);
  assert.ok(cfg.stacks['node-ts'].roots.every((r) => typeof r === 'string'));
});

test('the Dart packageDir walk-up still resolves against derived roots', () => {
  const d = tree(['apps/mobile/pubspec.yaml', 'apps/mobile/lib/main.dart']);
  const cfg = loadConfig(d, detectPackages(d));
  assert.strictEqual(resolvePackageDir(d, cfg.stacks['dart-flutter']), 'apps/mobile');
});

test('an explicit stackCfg.packageDir still overrides the walk-up', () => {
  const d = tree(['apps/mobile/pubspec.yaml']);
  const cfg = loadConfig(d, detectPackages(d));
  assert.strictEqual(resolvePackageDir(d, { ...cfg.stacks['dart-flutter'], packageDir: 'x' }), 'x');
});
