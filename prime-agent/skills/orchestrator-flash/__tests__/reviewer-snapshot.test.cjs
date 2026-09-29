#!/usr/bin/env node
'use strict';
/**
 * Nothing in this pipeline ever commits. A reviewer that diffs a commit range
 * reviews an empty change set and approves it — quietly, and every time. The
 * isolated-index snapshot is the only correct way to see the work, so flash's copy
 * must match the orchestrator's line for line.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const REPO = join(__dirname, '..', '..', '..', '..', '..');
const FLASH = join(__dirname, '..');
const tpl = (n) => readFileSync(join(FLASH, 'templates', `${n}.md`), 'utf8');

const SNAPSHOT_LINES = [
  'export GIT_INDEX_FILE="$(mktemp -u)"',
  'git read-tree HEAD',
  'git add -A',
  'snap="$(git write-tree)"',
];

test('the reviewer snapshots the working tree through an isolated index', () => {
  const r = tpl('reviewer');
  for (const line of SNAPSHOT_LINES) {
    assert.ok(r.includes(line), `the reviewer snapshot is missing: ${line}`);
  }
});

test('the reviewer never substitutes a commit range', () => {
  const r = tpl('reviewer');
  assert.ok(!r.includes('main...HEAD') || /never|not|do not/i.test(
    r.split('\n').find((l) => l.includes('main...HEAD')) || ''),
    'main...HEAD appears outside a prohibition');
});

test('the reviewer prefers the run base over a merge-base fallback', () => {
  assert.match(tpl('reviewer'), /MAESTRO_REVIEW_BASE:-/);
});

test('the reviewer splits findings into Must Fix and Should Fix', () => {
  const r = tpl('reviewer');
  assert.match(r, /Must Fix/);
  assert.match(r, /Should Fix/);
});

test('the reviewer verdict vocabulary is the one the pipeline branches on', () => {
  const r = tpl('reviewer');
  assert.match(r, /APPROVED/);
  assert.match(r, /REQUEST_CHANGES/);
});

test('the coder keeps the rule that stops green-by-deletion', () => {
  const c = tpl('coder');
  const orch = readFileSync(join(REPO, 'plugins/my-skills/skills/orchestrator/templates/coder.md'), 'utf8');
  const rule = 'never modify a test to make it pass';
  assert.ok(orch.toLowerCase().includes(rule), 'the orchestrator no longer states the rule');
  assert.ok(c.toLowerCase().includes(rule), 'flash dropped the rule');
});

test('the coder runs its own tests, since no tester or QA will', () => {
  const c = tpl('coder');
  assert.match(c, /changed scope|scope you changed|the tests you wrote/i);
  assert.ok(!/whole[- ]app suite|full suite/i.test(c) || /never|do not/i.test(c),
    'the coder claims a full suite that nothing in flash runs');
});

test('the coder flips status twice and keeps no other bookkeeping', () => {
  const c = tpl('coder');
  assert.match(c, /status: DONE/);
  assert.ok(!/append[^.]*progress|progress log|progress sidecar file/i.test(c),
    'the coder still writes a progress log');
});

test('the first flip names its value, and the plan vocabulary has it', () => {
  // "Flip the status" with no target left each run to invent one; the vocabulary had none.
  assert.match(tpl('coder'), /Flip the plan's frontmatter to `status: IN_PROGRESS` when you start/);
  assert.match(tpl('artifact-format-flash'), /plan is `TODO`, `IN_PROGRESS` while the coder works, then `DONE` or `BLOCKED`/);
});

test('a rework reproduces its report through the same channel first, and leaves the plan alone', () => {
  // A live or review rework hands the coder a finished plan and a report. A test that only
  // asserts the store was called goes red, then green, while the defect it was for survives.
  const c = tpl('coder');
  const rework = c.slice(c.indexOf('## Rework'), c.indexOf('## Output to user'));
  assert.ok(rework.startsWith('## Rework'), 'the coder has no rework rule');
  assert.match(rework, /Handed a live report or a `CR` with the plan, first write a test that reproduces what it reports through the same channel/);
  assert.match(rework, /watch it fail for that reason/);
  assert.match(rework, /Leave the plan's tasks and `status` as they are, and return `Status: DONE`, or `Status: BLOCKED`/);
});
