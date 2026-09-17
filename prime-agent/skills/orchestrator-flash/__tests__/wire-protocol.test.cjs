#!/usr/bin/env node
'use strict';
/**
 * The stdout lines a role prints are a wire protocol, not a summary: the pipeline
 * extracts IDs, statuses and paths from exact strings and cannot advance on a miss.
 * These tests assert both halves of the contract agree.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const FLASH = join(__dirname, '..');
const tpl = (n) => readFileSync(join(FLASH, 'templates', `${n}.md`), 'utf8');
const skill = () => readFileSync(join(FLASH, 'SKILL.md'), 'utf8');

test('the brainstormer prints the two lines the pipeline parses', () => {
  const b = tpl('brainstormer');
  assert.match(b, /^Spec: /m);
  assert.match(b, /^Status: /m);
  assert.ok(skill().includes('Spec:'), 'SKILL.md never parses the Spec: line');
});

test('the architect prints the two lines the pipeline parses', () => {
  const a = tpl('architect');
  assert.match(a, /ARCHITECT — \{ID\} created/);
  assert.match(a, /^Plan: /m);
});

test('a flash spec can never be DRAFT', () => {
  const b = tpl('brainstormer');
  assert.ok(!/status:\s*DRAFT/.test(b), 'the brainstormer can still emit a DRAFT spec');
  assert.match(b, /always `?status: ACTIVE/);
  assert.match(b, /assumption/i, 'unknowns must become recorded assumptions');
});

test('the brainstormer batches its questions instead of one per turn', () => {
  assert.match(tpl('brainstormer'), /single message|one message|batch/i);
});

test('functional requirements are numbered, because two later steps count them', () => {
  assert.match(tpl('brainstormer'), /## Functional requirements/);
  assert.match(tpl('architect'), /## Functional requirements|FR #/);
});

test('the architect orders tests before implementation', () => {
  assert.match(tpl('architect'), /test.{0,40}before.{0,40}implementation|TDD/i);
});

test('the architect is handed a spec, never a Plan: line', () => {
  const md = skill();
  const architectStep = md.slice(md.indexOf('## Step 2'), md.indexOf('## Step 3'));
  assert.ok(!/^Plan: /m.test(architectStep),
    'a Plan: line in the architect prompt collides with the line Step 2 extracts');
  assert.match(architectStep, /Source spec:/);
});

test('neither template asks for a progress sidecar', () => {
  for (const n of ['brainstormer', 'architect']) {
    assert.ok(!tpl(n).includes('progress'), `${n}.md still writes a progress log`);
  }
});
