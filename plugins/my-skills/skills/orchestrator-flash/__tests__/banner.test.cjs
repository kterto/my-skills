#!/usr/bin/env node
'use strict';
/**
 * Flash emits the orchestrator's success string so existing wrappers keep working.
 * The banner is therefore the only place a human can tell a flash green from an
 * orchestrator green, which makes its disclosure lines load-bearing rather than
 * decorative. A step that did not run must never look like one that found nothing.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const skill = () => readFileSync(join(__dirname, '..', 'SKILL.md'), 'utf8');

test('the success string is the one product-manager matches', () => {
  assert.match(skill(), /^Status: READY_TO_COMMIT$/m);
});

test('the halt string is the one product-manager matches', () => {
  assert.match(skill(), /^Status: STALLED$/m);
});

test('the banner self-identifies as the cheaper pipeline', () => {
  assert.match(skill(), /^Pipeline: flash/m);
});

test('the banner names every skipped check by category', () => {
  const md = skill();
  for (const c of ['e2e', 'coverage floor', 'mutation', 'spec grading', 'QA regression', 'full test suite']) {
    assert.ok(md.includes(c), `the banner never names "${c}" as unverified`);
  }
});

test('all five steps are present and numbered', () => {
  const md = skill();
  for (const s of ['## Step 1', '## Step 2', '## Step 3', '## Step 4', '## Step 5']) {
    assert.ok(md.includes(s), `SKILL.md has no ${s}`);
  }
});

test('the review loop routes the CR to the coder, not to the architect', () => {
  const md = skill();
  const step4 = md.slice(md.indexOf('## Step 4'), md.indexOf('## Step 5'));
  assert.match(step4, /REQUEST_CHANGES/);
  assert.match(step4, /hand the \*\*CR itself\*\* to the coder/);
  // The architect may only be named to forbid routing through it.
  for (const line of step4.split('\n').filter((l) => /architect/i.test(l))) {
    assert.match(line, /not route it through|never|do not/i,
      `the flash review cycle re-enters the architect: ${line}`);
  }
});

test('typecheck and build are advisory and never block', () => {
  const md = skill();
  const start = md.indexOf('## Step 3b');
  assert.ok(start > -1, 'SKILL.md has no Step 3b');
  const step = md.slice(start, md.indexOf('## Step 4'));
  assert.match(step, /advisory/i);
  assert.match(step, /neither blocks|never blocks|does not block/i);
});

test('the run is not indexed silently when the indexer is absent', () => {
  assert.match(skill(), /index-plans\.cjs/);
  assert.match(skill(), /not indexed/i);
});
