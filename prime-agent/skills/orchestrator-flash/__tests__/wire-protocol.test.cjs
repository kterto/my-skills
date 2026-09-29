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

test('the live role prints the verdict line the pipeline branches on', () => {
  assert.match(tpl('live'), /^LIVE: PASS \| FAIL \| NOT RUN$/m);
  for (const f of ['Exercised:', 'Evidence:', 'Read-back:', 'Reason:']) assert.match(tpl('live'), new RegExp(`^${f}`, 'm'));
  const md = skill();
  const step = md.slice(md.indexOf('## Step 3c'), md.indexOf('## Step 4'));
  for (const v of ['LIVE: PASS', 'LIVE: FAIL', 'LIVE: NOT RUN']) assert.ok(step.includes(v), `Step 3c has no branch for ${v}`);
  assert.match(md, /`Exercised:` and `Reason:`/, 'Step 5 never says where the banner\'s flow and reason come from');
});

test('every prompt reads its role file first, and an artifact handed by ID comes with its path', () => {
  // The prompt opens with the preamble, whose `Role file:` line is that first instruction. The
  // path rule binds an artifact handed over, not the `ID to use:` a role has yet to write.
  const md = skill();
  assert.match(md, /The prompt's first instruction is \*\*read `\.orchestrator\/flash\/\{role\}\.md` and follow it\*\*/);
  assert.match(md, /^Role file: \.orchestrator\/flash\/\{role\}\.md +← read this first$/m);
  assert.match(md, /An artifact handed by ID travels with its path\./);
  assert.doesNotMatch(md, /The prompt opens with|Every artifact ID travels with its path/);
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

test('the interview travels on the wire, because a subagent cannot ask and wait', () => {
  // A role file may instruct an interview all it likes; without a relay the question dies
  // inside the spawn. This asserts both halves — the role emits the question block, and
  // the pipeline knows what to do with it.
  const b = tpl('brainstormer');
  assert.match(b, /^STATUS: QUESTION$/m, 'the brainstormer has no way to return a question');
  assert.match(b, /\(default: /, 'a question with no stated default cannot be answered with "defaults"');
  assert.match(b, /first return is the question block, not a spec/i,
    'nothing stops the role writing the spec on the spawn that should have asked');

  const md = skill();
  const step1 = md.slice(md.indexOf('## Step 1'), md.indexOf('## Step 2'));
  assert.match(step1, /STATUS: QUESTION/, 'Step 1 never parses the question block');
  assert.match(step1, /hand control back to the user/i, 'Step 1 never returns the questions to the user');
  assert.match(step1, /Answers:/, 'Step 1 never feeds the answers back in');
  assert.match(step1, /One round is the whole budget/, 'the interview has no bound and can become a conversation');
  assert.match(step1, /interview: skipped/, 'a skipped interview would look like one that found nothing');
});

test('the interview is a resolved config key, not a role-level whim', () => {
  const md = skill();
  assert.match(md, /^\| `interview` \| `true` \|/m, 'interview is not in the configuration table');
  // The fence is normative — it is what an executing agent copies. A fence that lists
  // fewer values than the wire carries sends the role a value it has no branch for.
  assert.match(md, /interview=\{on\|answered\|off\}/,
    'the preamble fence does not declare every value the wire carries');
  assert.match(md, /automation_level: autonomous/,
    "a project's own automation_level is still ignored without a word");
  assert.match(tpl('brainstormer'), /interview=off/, 'the role cannot tell an interview run from a silent one');
  // Three values, three first moves. The answer spawn is the one that is easy to forget,
  // and a role that falls through it asks the same questions a second time.
  for (const v of ['interview=on', 'interview=answered', 'interview=off']) {
    assert.ok(tpl('brainstormer').includes(v), `the role has no branch for ${v}`);
  }
  assert.match(skill(), /interview=answered/, 'the session never tells the answer spawn that the asking is done');
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
