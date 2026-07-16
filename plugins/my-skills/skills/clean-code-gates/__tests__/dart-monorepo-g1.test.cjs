const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolvePackageDir, lcovKeyToRepoRel } = require('../src/adapters/dart-flutter.cjs');

function fixture(layout) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-mono-'));
  for (const rel of layout) {
    const p = path.join(d, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, '');
  }
  return d;
}

// G1 shells `flutter test`, which only runs from the directory holding
// pubspec.yaml. In a monorepo that is not the repo root, so the gate could
// never execute — and an errored gate used to read as pass.
test('resolvePackageDir finds the Flutter package from a monorepo root', () => {
  const root = fixture(['apps/mobile/pubspec.yaml', 'apps/mobile/lib/main.dart']);
  assert.strictEqual(resolvePackageDir(root, { roots: ['apps/mobile/lib'] }), 'apps/mobile');
});

test('resolvePackageDir honours an explicit packageDir', () => {
  const root = fixture(['x/pubspec.yaml']);
  assert.strictEqual(resolvePackageDir(root, { roots: ['whatever'], packageDir: 'x' }), 'x');
});

test('resolvePackageDir returns the root for a single-package repo', () => {
  const root = fixture(['pubspec.yaml', 'lib/main.dart']);
  assert.strictEqual(resolvePackageDir(root, { roots: ['lib'] }), '');
});

// lcov keys are package-relative; scoped files are repo-relative. Without
// re-rooting, every lookup misses and the gate passes having measured nothing.
test('lcovKeyToRepoRel re-roots a package-relative lcov key', () => {
  assert.strictEqual(
    lcovKeyToRepoRel('lib/src/x.dart', '/repo', 'apps/mobile'),
    'apps/mobile/lib/src/x.dart',
  );
});

test('lcovKeyToRepoRel leaves a single-package key alone', () => {
  assert.strictEqual(lcovKeyToRepoRel('lib/src/x.dart', '/repo', ''), 'lib/src/x.dart');
});

test('lcovKeyToRepoRel relativises an absolute lcov key', () => {
  assert.strictEqual(
    lcovKeyToRepoRel('/repo/apps/mobile/lib/x.dart', '/repo', 'apps/mobile'),
    'apps/mobile/lib/x.dart',
  );
});
