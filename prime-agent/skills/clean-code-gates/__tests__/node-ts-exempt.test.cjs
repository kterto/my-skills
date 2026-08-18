const { test } = require('node:test');
const assert = require('node:assert');
const { isExempt, TEST_FILE_RE } = require('../src/adapters/node-ts.cjs');

// NestJS scaffolds end-to-end specs as `*.e2e-spec.ts` — a hyphen before
// "spec", not a dot. A test-file pattern that only accepts `.spec.` therefore
// treats every e2e file as production code the moment `test/` enters roots.
test('TEST_FILE_RE recognises the NestJS e2e-spec convention', () => {
  assert.ok(TEST_FILE_RE.test('app.e2e-spec.ts'));
  assert.ok(TEST_FILE_RE.test('billing-webhooks.e2e-spec.ts'));
});

test('TEST_FILE_RE still recognises the dot conventions', () => {
  assert.ok(TEST_FILE_RE.test('auth.service.spec.ts'));
  assert.ok(TEST_FILE_RE.test('foo.test.ts'));
  assert.ok(TEST_FILE_RE.test('foo.test.tsx'));
  assert.ok(TEST_FILE_RE.test('foo.spec.mjs'));
});

test('TEST_FILE_RE does not swallow production files that merely end in spec/test', () => {
  assert.ok(!TEST_FILE_RE.test('myspec.ts'));
  assert.ok(!TEST_FILE_RE.test('latest.ts'));
  assert.ok(!TEST_FILE_RE.test('manifest.ts'));
});

test('isExempt exempts an e2e-spec file from a production gate', () => {
  assert.strictEqual(isExempt('apps/backend/test/app.e2e-spec.ts', {}, 'G4'), true);
});

test('isExempt does not exempt production source', () => {
  assert.strictEqual(isExempt('apps/backend/src/auth/auth.service.ts', {}, 'G4'), false);
});
