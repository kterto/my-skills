'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { buildReport } = require('../src/report.cjs');
const {
  validate, unhandledKeywords, unsupportedKeywordForms, ASSERTIONS, NON_ASSERTING_SETS,
} = require('./helpers/schema-validate.cjs');

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
  const errs = validate(schema, sampleReport);
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
  const errs = validate(schema, errored);
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
    const errs = validate(schema, corrupt(mutate));
    assert.ok(errs.length >= 1, `expected at least one violation for ${label}, got none`);
  });
}

test('a report whose instrument moved conforms to report.schema.json', () => {
  const moved = buildReport({
    scope: { kind: 'diff', baseRef: 'origin/main', files: ['a.ts'], stacks: ['node-ts'] },
    gateResults: [{ gate: 'G5', name: 'no-comments', stack: 'node-ts', status: 'pass', tool: 'builtin', findings: [] }],
    instrument: {
      anchored: true, baseRef: 'origin/main', source: 'merge-base',
      moves: [
        { key: 'node-ts.gates.G1.thresholds.statements', from: 85, to: 60, direction: 'loosening' },
        { key: 'node-ts.gates.G2.exempt', added: 3, removed: 0, direction: 'loosening' },
      ],
    },
    now: '2026-05-31T00:00:00Z', version: '0.1.0',
  });
  assert.deepStrictEqual(validate(schema, moved), []);
});

test('a report whose rigor demoted and skipped gates conforms to report.schema.json', () => {
  const r = buildReport({
    scope: { kind: 'diff', baseRef: 'origin/main', files: ['a.ts'], stacks: ['node-ts'] },
    gateResults: [{
      gate: 'G2', name: 'complexity', stack: 'node-ts', status: 'warn', tool: 'eslint',
      findings: [{ id: 'G2-a.ts:4', severity: 'warning', file: 'a.ts', line: 4, rule: 'complexity',
        message: 'too complex', demotedFrom: 'blocker', rigor: 'sketch' }],
    }],
    rigor: { level: 'sketch', source: 'cli', demoted: { G2: 1 }, reportOnly: ['G2'], skipped: ['G6'] },
    now: '2026-05-31T00:00:00Z', version: '0.1.0',
  });
  assert.deepStrictEqual(validate(schema, r), []);
});

test('a report built with no rigor still carries the hardened stamp', () => {
  assert.deepStrictEqual(sampleReport.rigor,
    { level: 'hardened', source: 'default', demoted: {}, reportOnly: [], skipped: [] });
});

test('a report built with no instrument still carries the unanchored block', () => {
  assert.deepStrictEqual(sampleReport.instrument,
    { anchored: false, baseRef: null, source: 'working-tree', moves: [] });
  assert.deepStrictEqual(validate(schema, sampleReport), []);
});

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
    () => validate(fixture, { id: 'not-a-uuid' }),
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
    assert.deepStrictEqual(validate(schema, corrupt(mutate)), [expected]);
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
    const errs = validate(schema, corrupt(mutate));
    assert.deepStrictEqual(errs, [], `unexpected violations: ${errs.join('; ')}`);
  });
}

test('format: date-time accepts the RFC-3339 forms and rejects the near misses', () => {
  const accepted = ['2026-05-31T00:00:00Z', '2026-05-31T00:00:00.123Z', '2026-05-31T00:00:00+02:00'];
  const rejected = ['2026-05-31 00:00:00', '2026-05-31T00:00:00', '2026-05-31', ''];
  for (const value of accepted) {
    assert.deepStrictEqual(validate(schema, corrupt(r => { r.generatedAt = value; })), [], `should accept ${value}`);
  }
  for (const value of rejected) {
    assert.deepStrictEqual(
      validate(schema, corrupt(r => { r.generatedAt = value; })),
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

// A gate result carrying the measurement block — the field that separates
// "did it pass" from "was it actually verified". The dart G6 adapter has
// emitted it since the mutation-test port and node-ts emits it now, while the
// published schema rejected it: any consumer validating a real report before
// trusting it (the natural thing to do with a schema that ships beside the
// tool) would have thrown on the one result that admits it measured nothing.
test('a gate result with a measurement block conforms to report.schema.json', () => {
  const measured = buildReport({
    scope: { kind: 'diff', files: ['src/a.ts'], stacks: ['node-ts'] },
    gateResults: [
      {
        gate: 'G6',
        name: 'mutation',
        stack: 'node-ts',
        status: 'error',
        tool: 'stryker',
        findings: [],
        measurement: {
          state: 'unmeasured',
          reason: 'bounded',
          mutants: null,
          budgetSeconds: 1800,
          onBound: 'disclose',
        },
      },
      {
        gate: 'G5', name: 'no-comments', stack: 'node-ts', status: 'pass', tool: 'builtin', findings: [],
        measurement: { state: 'measured', mutants: 12, measured: 12, unrun: 0, excluded: 3 },
      },
    ],
    now: '2026-09-11T00:00:00Z',
    version: '0.1.0',
  });
  const errs = validate(schema, measured);
  assert.deepStrictEqual(errs, [], `schema violations: ${errs.join('; ')}`);
});

test('schema: measurement.state rejects a value outside the four documented states', () => {
  const errs = validate(
    schema,
    corrupt((r) => {
      r.gates[0].measurement = { state: 'probably-fine' };
    }),
  );
  assert.ok(errs.length > 0, 'an undocumented measurement state must not validate');
});

test('schema: measurement.onBound rejects a value outside the two policies', () => {
  const errs = validate(
    schema,
    corrupt((r) => {
      r.gates[0].measurement = { state: 'unmeasured', reason: 'bounded', onBound: 'maybe' };
    }),
  );
  assert.deepStrictEqual(errs, ['$.gates[0].measurement.onBound: must be one of ["disclose","stop"], got "maybe"']);
});
