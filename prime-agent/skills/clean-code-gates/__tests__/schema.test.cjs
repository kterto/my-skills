'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { buildReport } = require('../src/report.cjs');

const TYPE_PREDICATES = {
  object: v => v !== null && typeof v === 'object' && !Array.isArray(v),
  array: v => Array.isArray(v),
  string: v => typeof v === 'string',
  integer: v => Number.isInteger(v),
  number: v => typeof v === 'number',
  boolean: v => typeof v === 'boolean',
  null: v => v === null,
};

function describeValue(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function checkType(value, type, path, errs) {
  if (!type) return true;
  const allowed = Array.isArray(type) ? type : [type];
  if (allowed.some(t => TYPE_PREDICATES[t] && TYPE_PREDICATES[t](value))) return true;
  errs.push(`${path}: expected type ${allowed.join('|')}, got ${describeValue(value)}`);
  return false;
}

function checkObject(value, schema, path, errs) {
  const properties = schema.properties || {};
  for (const key of schema.required || []) {
    if (!Object.hasOwn(value, key)) errs.push(`${path}: missing required key "${key}"`);
  }
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(properties, key)) errs.push(`${path}: unknown key "${key}"`);
    }
  }
  for (const [key, subSchema] of Object.entries(properties)) {
    if (key in value) checkNode(value[key], subSchema, `${path}.${key}`, errs);
  }
}

/** Generic recursive check honouring type, required, additionalProperties, properties, items, enum, const. */
function checkNode(value, schema, path, errs) {
  if (!schema || typeof schema !== 'object') return;
  if (!checkType(value, schema.type, path, errs)) return;
  if ('const' in schema && value !== schema.const) {
    errs.push(`${path}: must equal ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errs.push(`${path}: must be one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(value)}`);
  }
  if (Array.isArray(value)) {
    if (schema.items) value.forEach((item, i) => checkNode(item, schema.items, `${path}[${i}]`, errs));
    return;
  }
  if (TYPE_PREDICATES.object(value)) checkObject(value, schema, path, errs);
}

/** Structural validator against report.schema.json (no external deps). */
function validate(report, schema) {
  const errs = [];
  checkNode(report, schema, '$', errs);
  return errs;
}

const sampleReport = buildReport({
  scope: { kind: 'project', files: ['a.ts'], stacks: ['node-ts'] },
  gateResults: [
    {
      gate: 'G5', name: 'no-comments', stack: 'node-ts', status: 'fail', tool: 'builtin',
      findings: [{ id: 'G5-a.ts:2', severity: 'blocker', file: 'a.ts', line: 2, rule: 'no-comments', message: 'disallowed comment', fixHint: 'remove it' }],
    },
    {
      gate: 'G6', name: 'mutation', stack: 'node-ts', status: 'missing_tool', tool: 'stryker',
      findings: [], installHint: 'add stryker',
    },
  ],
  now: '2026-05-31T00:00:00Z',
  version: '0.1.0',
});

const schemaPath = path.join(__dirname, '../schema/report.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

test('buildReport output conforms to report.schema.json (top-level required keys and types)', () => {
  const errs = validate(sampleReport, schema);
  assert.deepStrictEqual(errs, [], `schema violations: ${errs.join('; ')}`);
});

test('schema: schemaVersion is exactly "1.0"', () => {
  assert.strictEqual(sampleReport.schemaVersion, '1.0');
});

test('schema: scope.kind enum values accepted', () => {
  const kindEnum = schema.properties.scope.properties.kind.enum;
  assert.deepStrictEqual(kindEnum, ['project', 'diff', 'module', 'files']);
  assert.ok(kindEnum.includes(sampleReport.scope.kind));
});

test('schema: summary.status enum values accepted', () => {
  const statusEnum = schema.properties.summary.properties.status.enum;
  assert.deepStrictEqual(statusEnum, ['pass', 'warn', 'blocked', 'error']);
  assert.ok(statusEnum.includes(sampleReport.summary.status));
});

test('buildReport output with an errored gate conforms to report.schema.json', () => {
  const errored = buildReport({
    scope: { kind: 'project', files: ['a.ts'], stacks: ['node-ts'] },
    gateResults: [
      { gate: 'G1', name: 'coverage', stack: 'node-ts', status: 'error', tool: 'jest', findings: [] },
      { gate: 'G5', name: 'no-comments', stack: 'node-ts', status: 'pass', tool: 'builtin', findings: [] },
    ],
    now: '2026-05-31T00:00:00Z',
    version: '0.1.0',
  });
  assert.strictEqual(errored.summary.status, 'error');
  assert.deepStrictEqual(errored.summary.gatesErrored, ['G1']);
  const errs = validate(errored, schema);
  assert.deepStrictEqual(errs, [], `schema violations: ${errs.join('; ')}`);
});

/** Deep clone of the sample report, mutated by `mutate`, so the negative cases stay independent. */
function corrupt(mutate) {
  const clone = JSON.parse(JSON.stringify(sampleReport));
  mutate(clone);
  return clone;
}

const negativeCases = [
  ['unknown key inside summary', r => { r.summary.bogusKey = 1; }],
  ['unknown key at top level', r => { r.bogusTopLevel = 1; }],
  ['out-of-enum summary.status', r => { r.summary.status = 'catastrophe'; }],
  ['out-of-enum per-gate status', r => { r.gates[0].status = 'exploded'; }],
  ['out-of-enum finding severity', r => { r.gates[0].findings[0].severity = 'nitpick'; }],
  ['missing required key in summary', r => { delete r.summary.gatesErrored; }],
  ['missing required key in a finding', r => { delete r.gates[0].findings[0].message; }],
  ['wrong type for gates', r => { r.gates = {}; }],
  ['wrong item type inside scope.files', r => { r.scope.files = [7]; }],
  ['wrong item type inside gates', r => { r.gates = ['not-an-object']; }],
  ['schemaVersion violating its const', r => { r.schemaVersion = '9.9'; }],
];

for (const [label, mutate] of negativeCases) {
  test(`validator rejects an invalid report: ${label}`, () => {
    const errs = validate(corrupt(mutate), schema);
    assert.ok(errs.length >= 1, `expected at least one violation for ${label}, got none`);
  });
}

test('schema: gate finding required fields and severity enum', () => {
  const finding = sampleReport.gates[0].findings[0];
  assert.ok('id' in finding);
  assert.ok('severity' in finding);
  assert.ok('file' in finding);
  assert.ok('line' in finding);
  assert.ok('rule' in finding);
  assert.ok('message' in finding);
  const sevEnum = schema.properties.gates.items.properties.findings.items.properties.severity.enum;
  assert.ok(sevEnum.includes(finding.severity));
});
