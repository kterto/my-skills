const { test } = require('node:test');
const assert = require('node:assert');
const { parseArgs } = require('../src/args.cjs');

test('parseArgs is exported', () => {
  assert.strictEqual(typeof parseArgs, 'function');
});
