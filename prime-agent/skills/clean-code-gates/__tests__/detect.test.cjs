const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { detectStacks } = require('../src/detect.cjs');

function tmpTree(spec) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-'));
  for (const [rel, content] of Object.entries(spec)) {
    const f = path.join(dir, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, content);
  }
  return dir;
}

test('node-ts detected via package.json + tsconfig', () => {
  const d = tmpTree({ 'package.json': '{}', 'tsconfig.json': '{}' });
  assert.deepStrictEqual(detectStacks(d), ['node-ts']);
});

test('dart-flutter detected via pubspec.yaml', () => {
  const d = tmpTree({ 'apps/mobile/pubspec.yaml': 'name: x' });
  assert.deepStrictEqual(detectStacks(d), ['dart-flutter']);
});

test('polyglot monorepo detects both, sorted', () => {
  const d = tmpTree({ 'apps/backend/package.json': '{}', 'apps/backend/tsconfig.json': '{}',
                      'apps/mobile/pubspec.yaml': 'name: x' });
  assert.deepStrictEqual(detectStacks(d), ['dart-flutter', 'node-ts']);
});

test('empty repo detects nothing', () => {
  assert.deepStrictEqual(detectStacks(tmpTree({ 'README.md': '#' })), []);
});
