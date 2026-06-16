'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { buildReport } = require('../src/report.cjs');

/** Minimal hand-rolled structural validator against report.schema.json (no external deps). */
function validate(report, schema) {
  const errs = [];

  // Top-level required keys
  for (const key of schema.required || []) {
    if (!(key in report)) errs.push(`missing top-level key: ${key}`);
  }

  // schemaVersion const
  if (report.schemaVersion !== '1.0') errs.push(`schemaVersion must be "1.0", got ${JSON.stringify(report.schemaVersion)}`);

  // generatedAt string
  if (typeof report.generatedAt !== 'string') errs.push('generatedAt must be a string');

  // tool object
  if (!report.tool || typeof report.tool !== 'object') {
    errs.push('tool must be an object');
  } else {
    for (const k of ['name', 'version']) {
      if (typeof report.tool[k] !== 'string') errs.push(`tool.${k} must be a string`);
    }
  }

  // scope object
  const scopeSchema = schema.properties.scope;
  if (!report.scope || typeof report.scope !== 'object') {
    errs.push('scope must be an object');
  } else {
    for (const key of scopeSchema.required || []) {
      if (!(key in report.scope)) errs.push(`scope missing key: ${key}`);
    }
    const kindEnum = scopeSchema.properties.kind.enum;
    if (!kindEnum.includes(report.scope.kind)) errs.push(`scope.kind must be one of ${kindEnum}, got ${report.scope.kind}`);
    if (!Array.isArray(report.scope.files)) errs.push('scope.files must be an array');
    if (!Array.isArray(report.scope.stacks)) errs.push('scope.stacks must be an array');
  }

  // summary object
  const summarySchema = schema.properties.summary;
  if (!report.summary || typeof report.summary !== 'object') {
    errs.push('summary must be an object');
  } else {
    for (const key of summarySchema.required || []) {
      if (!(key in report.summary)) errs.push(`summary missing key: ${key}`);
    }
    const statusEnum = summarySchema.properties.status.enum;
    if (!statusEnum.includes(report.summary.status)) errs.push(`summary.status must be one of ${statusEnum}, got ${report.summary.status}`);
    if (!Array.isArray(report.summary.gatesRun)) errs.push('summary.gatesRun must be an array');
    if (!Array.isArray(report.summary.gatesMissingTool)) errs.push('summary.gatesMissingTool must be an array');
    if (typeof report.summary.blockers !== 'number') errs.push('summary.blockers must be a number');
    if (typeof report.summary.warnings !== 'number') errs.push('summary.warnings must be a number');
  }

  // gates array
  const gateItemSchema = schema.properties.gates.items;
  if (!Array.isArray(report.gates)) {
    errs.push('gates must be an array');
  } else {
    for (const [i, gate] of report.gates.entries()) {
      for (const key of gateItemSchema.required || []) {
        if (!(key in gate)) errs.push(`gates[${i}] missing key: ${key}`);
      }
      const gateStatusEnum = gateItemSchema.properties.status.enum;
      if (!gateStatusEnum.includes(gate.status)) errs.push(`gates[${i}].status must be one of ${gateStatusEnum}, got ${gate.status}`);
      if (!Array.isArray(gate.findings)) errs.push(`gates[${i}].findings must be an array`);

      // Validate each finding
      const findingSchema = gateItemSchema.properties.findings.items;
      for (const [j, finding] of (gate.findings || []).entries()) {
        for (const key of findingSchema.required || []) {
          if (!(key in finding)) errs.push(`gates[${i}].findings[${j}] missing key: ${key}`);
        }
        const sevEnum = findingSchema.properties.severity.enum;
        if (!sevEnum.includes(finding.severity)) errs.push(`gates[${i}].findings[${j}].severity must be one of ${sevEnum}, got ${finding.severity}`);
        if (typeof finding.line !== 'number' || finding.line < 1) errs.push(`gates[${i}].findings[${j}].line must be integer >= 1`);
      }
    }
  }

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
  assert.deepStrictEqual(statusEnum, ['pass', 'warn', 'blocked']);
  assert.ok(statusEnum.includes(sampleReport.summary.status));
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
