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

/** `format` asserts, it does not annotate; an unrecognized value is a validator error, never a silent pass. */
const FORMAT_PREDICATES = {
  'date-time': v => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v),
};

/** One entry per honoured assertion keyword; `checkNode` dispatches through this table and nothing else. */
const ASSERTIONS = {
  type: (value, schema, path, errs) => checkType(value, schema.type, path, errs),
  const: (value, schema, path, errs) => {
    if (value === schema.const) return;
    errs.push(`${path}: must equal ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
  },
  enum: (value, schema, path, errs) => {
    if (schema.enum.includes(value)) return;
    errs.push(`${path}: must be one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(value)}`);
  },
  minimum: (value, schema, path, errs) => {
    if (!TYPE_PREDICATES.number(value) || value >= schema.minimum) return;
    errs.push(`${path}: must be >= ${schema.minimum}, got ${JSON.stringify(value)}`);
  },
  pattern: (value, schema, path, errs) => {
    if (!TYPE_PREDICATES.string(value) || new RegExp(schema.pattern).test(value)) return;
    errs.push(`${path}: must match ${schema.pattern}, got ${JSON.stringify(value)}`);
  },
  format: (value, schema, path, errs) => {
    const matchesFormat = FORMAT_PREDICATES[schema.format];
    if (!matchesFormat) throw new Error(`${path}: unsupported schema format "${schema.format}"`);
    if (!TYPE_PREDICATES.string(value) || matchesFormat(value)) return;
    errs.push(`${path}: must be a valid ${schema.format}, got ${JSON.stringify(value)}`);
  },
  required: (value, schema, path, errs) => {
    if (!TYPE_PREDICATES.object(value)) return;
    for (const key of schema.required) {
      if (!Object.hasOwn(value, key)) errs.push(`${path}: missing required key "${key}"`);
    }
  },
  additionalProperties: (value, schema, path, errs) => {
    if (schema.additionalProperties !== false || !TYPE_PREDICATES.object(value)) return;
    const known = schema.properties || {};
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(known, key)) errs.push(`${path}: unknown key "${key}"`);
    }
  },
  properties: (value, schema, path, errs) => {
    if (!TYPE_PREDICATES.object(value)) return;
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      if (key in value) checkNode(value[key], subSchema, `${path}.${key}`, errs);
    }
  },
  items: (value, schema, path, errs) => {
    if (!Array.isArray(value)) return;
    value.forEach((item, i) => checkNode(item, schema.items, `${path}[${i}]`, errs));
  },
};

const POST_TYPE_KEYWORDS = Object.keys(ASSERTIONS).filter(keyword => keyword !== 'type');

/** Generic recursive check. The honoured keyword set is exactly the keys of `ASSERTIONS`. */
function checkNode(value, schema, path, errs) {
  if (!TYPE_PREDICATES.object(schema)) return;
  if (!ASSERTIONS.type(value, schema, path, errs)) return;
  for (const keyword of POST_TYPE_KEYWORDS) {
    if (keyword in schema) ASSERTIONS[keyword](value, schema, path, errs);
  }
}

/** Core keywords: they identify and version the schema document itself and constrain no instance. */
const CORE_KEYWORDS = new Set(['$schema', '$id']);

/** Keywords that annotate rather than assert; they are allowed to be unimplemented. */
const ANNOTATION_KEYWORDS = new Set([
  'title', 'description', 'default', 'examples', 'deprecated', 'readOnly', 'writeOnly', '$comment',
]);

/**
 * Every keyword set that carries no assertion, keyed by name. `unhandledKeywords` and the
 * disjointness guard both read this registry, so a set added here is covered by both at once and
 * a set added anywhere else is covered by neither — there is one place to look.
 */
const NON_ASSERTING_SETS = { CORE_KEYWORDS, ANNOTATION_KEYWORDS };

/** True when the keyword belongs to any non-asserting set, so the coverage guard may skip it. */
function isNonAsserting(keyword) {
  return Object.values(NON_ASSERTING_SETS).some(set => set.has(keyword));
}

/**
 * Schema-aware walk: keys of a schema node are keywords, but keys under `properties` are
 * property names. Only `properties.*`, `items`, and an object-valued `additionalProperties`
 * are sub-schemas; `required`/`enum` array contents and boolean `additionalProperties` are values.
 *
 * Deliberate divergence from `checkNode`: this walk descends an object-valued
 * `additionalProperties`, a form `checkNode` does not enforce. The divergence is the safe
 * direction — descending finds MORE keywords, so the coverage guard stays stricter; teaching this
 * walk to stop descending would leave keywords nested inside an object-form sub-schema uncounted
 * and make the guard silently permissive. `unsupportedKeywordForms` is the guard that closes the
 * loop: it goes red the day `report.schema.json` actually adopts the object form (or tuple-form
 * `items`), so the unenforced form can never arrive unannounced.
 */
function collectSchemaKeywords(node, found = new Set()) {
  if (!TYPE_PREDICATES.object(node)) return found;
  for (const [keyword, sub] of Object.entries(node)) {
    found.add(keyword);
    if (keyword === 'properties') Object.values(sub).forEach(s => collectSchemaKeywords(s, found));
    if (keyword === 'items' || keyword === 'additionalProperties') collectSchemaKeywords(sub, found);
  }
  return found;
}

/** Keywords the given schema asserts with that `checkNode` would silently ignore. */
function unhandledKeywords(schemaNode) {
  const implemented = new Set(Object.keys(ASSERTIONS));
  return [...collectSchemaKeywords(schemaNode)]
    .filter(keyword => !implemented.has(keyword) && !isNonAsserting(keyword))
    .sort();
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
  ['summary.blockers below its minimum of 0', r => { r.summary.blockers = -5; }],
  ['gate id violating its pattern ^G[1-9][0-9]*$', r => { r.gates[0].gate = 'NOTAGATE'; }],
  ['generatedAt violating format: date-time', r => { r.generatedAt = 'not-a-date'; }],
  ['optional finding.endLine below its minimum (optional-property path is walked, not only required ones)', r => { r.gates[0].findings[0].endLine = 0; }],
  ['finding.line below its minimum of 1 — the explicit check commit 6ab2224 carried and the generic rewrite dropped', r => { r.gates[0].findings[0].line = 0; }],
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

test('validator honours every assertion keyword report.schema.json actually uses', () => {
  const unhandled = unhandledKeywords(schema);
  assert.deepStrictEqual(
    unhandled, [],
    `report.schema.json asserts with keyword(s) the validator silently ignores: ${unhandled.join(', ')}`,
  );
});

test('keyword-coverage guard reports a keyword the validator does not implement', () => {
  const fixture = {
    type: 'object',
    properties: { count: { type: 'integer', multipleOf: 5 } },
  };
  assert.deepStrictEqual(unhandledKeywords(fixture), ['multipleOf']);
});

test('keyword-coverage guard treats keys under `properties` as property names, not keywords', () => {
  const fixture = {
    type: 'object',
    properties: {
      multipleOf: { type: 'integer' },
      maxLength: { type: 'string' },
      not: { type: 'boolean' },
    },
  };
  assert.deepStrictEqual(unhandledKeywords(fixture), []);
});

test('keyword-coverage guard descends `items` and `properties.*` but not `required`/`enum` contents', () => {
  const fixture = {
    type: 'object',
    required: ['multipleOf'],
    additionalProperties: true,
    properties: {
      tags: { type: 'array', items: { type: 'string', enum: ['maxLength', 'anyOf'] } },
    },
  };
  assert.deepStrictEqual(unhandledKeywords(fixture), []);

  const nested = JSON.parse(JSON.stringify(fixture));
  nested.properties.tags.items.maxLength = 8;
  assert.deepStrictEqual(unhandledKeywords(nested), ['maxLength']);
});

/**
 * The allow-list exists so a purely documentary edit to a schema cannot redden the coverage guard.
 * These fixtures are in-memory on purpose — `report.schema.json` carries no annotation keyword today,
 * so only a fixture can prove the allow-list works in the direction it was widened for.
 */
test('keyword-coverage guard ignores every documentary keyword but still reports an unimplemented assertion', () => {
  const documentary = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://example.test/fixture.json',
    $comment: 'a note for schema maintainers, not a constraint',
    title: 'Fixture',
    description: 'Carries every annotation keyword and asserts nothing new.',
    type: 'object',
    properties: {
      count: {
        type: 'integer',
        default: 0,
        examples: [1, 2],
        deprecated: false,
        readOnly: true,
        writeOnly: false,
      },
    },
  };
  assert.deepStrictEqual(
    unhandledKeywords(documentary), [],
    'a documentary-only schema edit must not redden the coverage guard',
  );

  const asserting = {
    type: 'object',
    properties: { count: { type: 'integer', default: 0, exclusiveMinimum: 0 } },
  };
  assert.deepStrictEqual(
    unhandledKeywords(asserting), ['exclusiveMinimum'],
    'widening the allow-list must not blind the guard to a genuine unimplemented assertion',
  );
});

test('validator raises on an unrecognized `format` value rather than ignoring it', () => {
  const fixture = { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } };
  assert.throws(
    () => validate({ id: 'not-a-uuid' }, fixture),
    /unsupported schema format "uuid"/,
  );
});

/**
 * `negativeCases` asserts only that *some* violation was raised, so a case can stay green while
 * being caught by the wrong keyword. These pin each newly honoured keyword to the exact violation
 * it must raise, so a regression in `minimum`/`pattern`/`format` cannot hide behind a type error.
 */
const rightReasonCases = [
  ['minimum', r => { r.summary.blockers = -5; }, '$.summary.blockers: must be >= 0, got -5'],
  ['minimum at the second summary site', r => { r.summary.warnings = -1; }, '$.summary.warnings: must be >= 0, got -1'],
  ['pattern', r => { r.gates[0].gate = 'NOTAGATE'; }, '$.gates[0].gate: must match ^G[1-9][0-9]*$, got "NOTAGATE"'],
  ['format', r => { r.generatedAt = 'not-a-date'; }, '$.generatedAt: must be a valid date-time, got "not-a-date"'],
  ['minimum on a required finding property', r => { r.gates[0].findings[0].line = 0; }, '$.gates[0].findings[0].line: must be >= 1, got 0'],
  ['minimum on an optional finding property', r => { r.gates[0].findings[0].endLine = 0; }, '$.gates[0].findings[0].endLine: must be >= 1, got 0'],
];

for (const [keyword, mutate, expected] of rightReasonCases) {
  test(`validator rejects for the right reason — ${keyword}`, () => {
    assert.deepStrictEqual(validate(corrupt(mutate), schema), [expected]);
  });
}

/** Every `minimum` in the schema is inclusive; a boundary value must validate clean, not be off by one. */
const boundaryCases = [
  ['summary.blockers at its minimum of 0', r => { r.summary.blockers = 0; }],
  ['summary.warnings at its minimum of 0', r => { r.summary.warnings = 0; }],
  ['finding.line at its minimum of 1', r => { r.gates[0].findings[0].line = 1; }],
  ['finding.endLine at its minimum of 1', r => { r.gates[0].findings[0].endLine = 1; }],
];

for (const [label, mutate] of boundaryCases) {
  test(`validator accepts a valid report: ${label}`, () => {
    const errs = validate(corrupt(mutate), schema);
    assert.deepStrictEqual(errs, [], `unexpected violations: ${errs.join('; ')}`);
  });
}

test('format: date-time accepts the RFC-3339 forms and rejects the near misses', () => {
  const accepted = ['2026-05-31T00:00:00Z', '2026-05-31T00:00:00.123Z', '2026-05-31T00:00:00+02:00'];
  const rejected = ['2026-05-31 00:00:00', '2026-05-31T00:00:00', '2026-05-31', ''];
  for (const value of accepted) {
    assert.deepStrictEqual(validate(corrupt(r => { r.generatedAt = value; }), schema), [], `should accept ${value}`);
  }
  for (const value of rejected) {
    assert.deepStrictEqual(
      validate(corrupt(r => { r.generatedAt = value; }), schema),
      [`$.generatedAt: must be a valid date-time, got ${JSON.stringify(value)}`],
      `should reject ${value}`,
    );
  }
});

test('every non-asserting keyword set is disjoint from the implemented set', () => {
  const implemented = Object.keys(ASSERTIONS);
  const names = Object.keys(NON_ASSERTING_SETS);
  assert.ok(names.length >= 1, 'the non-asserting registry must not be empty, or this guard checks nothing');
  for (const [name, set] of Object.entries(NON_ASSERTING_SETS)) {
    const overlap = implemented.filter(keyword => set.has(keyword));
    assert.deepStrictEqual(
      overlap, [],
      `${name} overlaps the implemented set; a keyword in both makes the coverage guard silently permissive: ${overlap.join(', ')}`,
    );
  }
});

/**
 * `unhandledKeywords` guards keyword *names*. `additionalProperties` and `items` are each honoured
 * in one form only — the boolean form and the single-sub-schema form — so the schema adopting the
 * object form or the tuple form would be unenforced AND unreported by that guard. This guards the
 * forms, and goes red the day the schema starts using one the validator does not walk.
 */
function unsupportedKeywordForms(node, path = '$', found = []) {
  if (!TYPE_PREDICATES.object(node)) return found;
  if (Array.isArray(node.items)) found.push(`${path}.items: tuple form`);
  if (TYPE_PREDICATES.object(node.additionalProperties)) found.push(`${path}.additionalProperties: sub-schema form`);
  if (node.properties) {
    for (const [key, sub] of Object.entries(node.properties)) unsupportedKeywordForms(sub, `${path}.${key}`, found);
  }
  if (TYPE_PREDICATES.object(node.items)) unsupportedKeywordForms(node.items, `${path}[]`, found);
  return found;
}

test('report.schema.json uses only the keyword forms the validator actually walks', () => {
  const unsupported = unsupportedKeywordForms(schema);
  assert.deepStrictEqual(
    unsupported, [],
    `report.schema.json uses a keyword form checkNode does not enforce: ${unsupported.join(', ')}`,
  );
});

test('the keyword-form guard detects the forms it exists to catch', () => {
  const tuple = { type: 'object', properties: { pair: { type: 'array', items: [{ type: 'string' }, { type: 'integer' }] } } };
  assert.deepStrictEqual(unsupportedKeywordForms(tuple), ['$.pair.items: tuple form']);

  const objectAdditional = { type: 'object', properties: { bag: { type: 'object', additionalProperties: { type: 'number' } } } };
  assert.deepStrictEqual(unsupportedKeywordForms(objectAdditional), ['$.bag.additionalProperties: sub-schema form']);

  const nestedInItems = { type: 'array', items: { type: 'object', properties: { bag: { type: 'object', additionalProperties: { type: 'number' } } } } };
  assert.deepStrictEqual(unsupportedKeywordForms(nestedInItems), ['$[].bag.additionalProperties: sub-schema form']);
});
