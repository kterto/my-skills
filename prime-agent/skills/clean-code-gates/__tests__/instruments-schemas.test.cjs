'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validate, unhandledKeywords, unsupportedKeywordForms } = require('./helpers/schema-validate.cjs');
const { KINDS } = require('../src/instruments/vocab.cjs');

const SCHEMA_DIR = path.join(__dirname, '..', 'schema');
const SCHEMAS = fs.readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.json')).sort();
const read = (file) => JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf8'));

// The §2.1 envelope with nothing kind-specific: whatever else a kind schema
// requires, it must also name `status` among its required keys.
const envelopeOnly = (kind) => ({
  schemaVersion: '1.0', kind, mode: null, generatedAt: '2026-01-02T03:04:05Z',
  tool: { name: 'clean-code-gates', version: '0.1.0' },
  tree: { base: 'a'.repeat(40), baseTree: 'b'.repeat(40), candidateTree: 'c'.repeat(40) },
  instruments: { source: 'defaults', from: null, digest: 'd'.repeat(64), moves: [] },
  isolation: null, status: 'pass', timing: {},
});

test('the schema directory is read, legacy report schema included', () => {
  assert.ok(SCHEMAS.includes('report.schema.json'), SCHEMAS.join(', '));
});

for (const file of SCHEMAS) {
  test(`${file} is draft-07 and asserts only with keywords and forms the validator enforces`, () => {
    const schema = read(file);
    assert.match(schema.$schema, /draft-07/);
    assert.deepEqual(unhandledKeywords(schema), [], `${file} asserts with keywords the validator would ignore`);
    assert.deepEqual(unsupportedKeywordForms(schema), [], `${file} uses keyword forms the validator does not walk`);
  });
}

for (const kind of KINDS) {
  const file = `${kind}.schema.json`;
  test(`${file} rejects a report with status removed`, () => {
    const report = envelopeOnly(kind);
    delete report.status;
    assert.ok(validate(read(file), report).includes('$: missing required key "status"'),
      `${file} must require status`);
  });
}

test('validate throws when handed a report where the schema belongs', () => {
  const schema = read('report.schema.json');
  assert.throws(() => validate(envelopeOnly('select'), schema), /neither \$schema nor type/);
  assert.throws(() => validate({ properties: {} }, {}), /neither \$schema nor type/);
  assert.deepEqual(validate({ type: 'object', required: ['a'] }, {}), ['$: missing required key "a"']);
});
