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

// A banner block, from its headline to the fence that closes it. Bounding by a byte
// count instead let a deleted line slide the window into the prose below, where the
// same labels are discussed — so removing the fix was what made the assertion pass.
function block(md, headline) {
  const start = md.indexOf(headline);
  assert.ok(start > -1, `SKILL.md has no ${headline} banner`);
  const end = md.indexOf('```', start);
  assert.ok(end > start, `the ${headline} banner block is not fenced — its bounds are prose`);
  return md.slice(start, end);
}

function section(md, heading, sentinel) {
  const start = md.indexOf(heading);
  const end = md.indexOf(sentinel);
  // indexOf returns -1 on a renamed sentinel, and slice(start, -1) is "everything" —
  // which silently turns a scoped assertion into a whole-file grep.
  assert.ok(start > -1, `SKILL.md has no ${heading}`);
  assert.ok(end > start, `the sentinel "${sentinel}" was renamed — this test was reading the whole file`);
  return md.slice(start, end);
}

test('the headline carries the literal product-manager matches on', () => {
  // PM's success test is the orchestrator's headline, not the bare status line
  // (product-manager/SKILL.md → step 3, "Read terminal state"). `(flash)` rides
  // behind it so the substring survives while the banner still names the pipeline.
  const md = skill();
  assert.match(md, /^ORCHESTRATOR — pipeline complete \(flash\)$/m);
  assert.doesNotMatch(md, /^ORCHESTRATOR-FLASH — /m,
    'the old headline is back; it does not contain the string any wrapper matches');
});

test('both terminal banners carry the paths a wrapper reads', () => {
  // PM reads spec_id and run_dir on EVERY terminal state and final_report_path before
  // it commits. A banner missing them sends it searching, or stops it dead after the
  // work is already done. `Final report:` is success-only — a halt is precisely the
  // case where the FINAL may not exist.
  const md = skill();
  const success = block(md, 'ORCHESTRATOR — pipeline complete (flash)');
  for (const re of [/^Spec:\s+\S/m, /^Run folder:\s+\S/m, /^Final report:\s+\S/m, /^Plan:\s+\S/m]) {
    assert.match(success, re, `the success banner has no line matching ${re}`);
  }
  const halt = block(md, 'ORCHESTRATOR — halted (flash)');
  for (const re of [/^Spec:\s+\S/m, /^Run folder:\s+\S/m]) {
    assert.match(halt, re, `the halt banner has no line matching ${re}`);
  }
  assert.doesNotMatch(halt, /^Final report:/m,
    'the halt banner promises a FINAL — the one artifact a halt may not have written');
});

test('the verdict distinguishes an approval from a budget that ran out', () => {
  // A reviewer's blocking finding cleared by the cycle counter reaching its limit is the
  // one claim flash must never make. READY_WITH_WARNINGS is a value PM already treats as
  // success, so saying so costs a wrapper nothing.
  const md = skill();
  assert.match(md, /^Status: READY_TO_COMMIT$/m, 'the plain success string product-manager matches is gone');
  assert.match(md, /READY_WITH_WARNINGS/, 'nothing distinguishes an APPROVED run from one that exhausted its review budget');
  const step4 = section(md, '## Step 4', '## Step 5');
  assert.match(step4, /READY_WITH_WARNINGS/,
    'Step 4 still sends a budget-exhausted REQUEST_CHANGES to Step 5 without saying what verdict it carries');
  assert.match(step4, /every\*{0,2} open finding|Must Fix labelled/i,
    'Step 4 does not require the open Must Fix findings to reach the banner, the only list a wrapper reads');
});

test('a run with no reviewer says so in the record, not only in the session', () => {
  const step5 = section(skill(), '## Step 5', '## What flash does not verify');
  assert.match(step5, /code review — review: skipped \(config\)/,
    'a --no-review FINAL is indistinguishable from one a reviewer approved with nothing to say');
  assert.match(step5, /Review cycles: — \(review: skipped \(config\)\)/,
    'a --no-review run still reports a cycle count, which reads as a review that found nothing');
  // A live FAIL is a Must Fix even when no reviewer ran, and Must Fix lines come first, so
  // the review-skip entry goes last rather than replacing the whole list.
  assert.match(step5, /no reviewer ran` last under `Issues found:`/,
    'a --no-review run with a live FAIL would write Issues found: as "none" over its own Must Fix');
});

test('the success banner carries the six lines product-manager copies into a PR', () => {
  // Absent, they do not read as absent: pr-body.template.md renders the all-clear
  // sentence when all six are empty, so a flash run would publish a PR claiming
  // measurement no gate performed.
  const success = block(skill(), 'ORCHESTRATOR — pipeline complete (flash)');
  for (const label of ['Rigor:', 'Delivered:', 'Unmeasured:', 'Instrument moved:', 'Deferred by decision:', 'Issues found:']) {
    assert.ok(success.includes(label), `the success banner has no ${label} line`);
  }
  assert.match(success, /^Rigor:\s+flash/m, 'the Rigor cell must say flash — it is what tells two greens apart in PM\'s run log');
  for (const label of ['Proposed commit message:', 'Proposed PR message:']) {
    assert.ok(success.includes(label), `the banner has no ${label} block — PM reads both from this report`);
  }
});

test('the FINAL file carries the banner, not only stdout', () => {
  const step5 = section(skill(), '## Step 5', '## What flash does not verify');
  assert.match(step5, /fenced, comes the banner block below, verbatim/);
  assert.match(step5, /Read the FINAL back before printing/);
  assert.match(step5, /status:` stays `COMPLETE`/,
    'Step 5 no longer states which field holds the lifecycle and which holds the verdict');
});

test('the live verdict rides existing banner lines, and the line set does not move', () => {
  // product-manager copies the six lines from Rigor: to Issues found: verbatim; a new line
  // would change what it parses. So the verdict extends Verified:, NOT VERIFIED: and
  // Issues found: instead.
  const success = block(skill(), 'ORCHESTRATOR — pipeline complete (flash)');
  assert.match(success, /^Verified:.*\{ · live: PASS — \{flow\}\}$/m);
  assert.match(success, /· live check \(\{FAIL \| not run\} — \{reason\}\)/);
  assert.match(success, /MUST FIX: live check failed/);
  // Whether the one live rework was spent: a FAIL it fixed leaves no other trace in the record.
  assert.match(success, /^Elapsed: +\{m\}m {3}Review cycles: \{n\}\/\{budget\} {3}Live rework: \{0\|1\}\/1$/m);
  const labels = success.split('\n').map((l) => /^([A-Z][A-Za-z ]*):/.exec(l)?.[1]).filter(Boolean);
  assert.deepEqual(labels, ['Status', 'Pipeline', 'Spec', 'Run folder', 'Final report', 'Plan', 'Built', 'Verified',
    'NOT VERIFIED', 'Interview', 'Rigor', 'Delivered', 'Unmeasured', 'Instrument moved', 'Deferred by decision',
    'Issues found', 'QA report', 'Elapsed', 'Index', 'Proposed commit message', 'Proposed PR message']);
});

test('READY_TO_COMMIT needs a live PASS; a live FAIL or NOT RUN warns', () => {
  const step5 = section(skill(), '## Step 5', '## What flash does not verify');
  assert.match(step5, /READY_TO_COMMIT` only with a live `PASS` and no open Must Fix/);
  assert.match(step5, /anything else is `READY_WITH_WARNINGS`/);
});

test('a retry halts only when the retry failed too', () => {
  // Each artifact check gets one retry, and the halt belongs to the retry's failure. Without the
  // condition, "write it once more, then halt" stalls a run whose rewrite passed.
  const md = skill();
  const sites = [
    [section(md, '## Step 1', '## Step 2'), /one re-invoke naming the exact path; still missing, the halt banner/],
    [section(md, '## Step 2', '## Step 3'), /re-invoke once; still not, halt/],
    [section(md, '## Step 4', '## Step 5'), /re-invoke once naming it; still missing, halt with `Reason: CR not written`/],
    [section(md, '## Step 5', '## What flash does not verify'), /write it once more; still so, halt with `Reason: FINAL report not written`/],
  ];
  for (const [step, re] of sites) assert.match(step, re, `a retry lost its "still" condition: ${re}`);
  assert.doesNotMatch(md, /(re-invoke once|naming the exact path|naming it|once more), then (the )?halt/,
    'a retry halts whatever the retry returned');
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

test('every step is present, numbered and in order', () => {
  const md = skill();
  const at = ['## Step 0', '## Step 1', '## Step 2', '## Step 3 ', '## Step 3b', '## Step 3c', '## Step 4', '## Step 5'].map((s) => md.indexOf(s));
  assert.ok(at.every((i) => i > -1), 'SKILL.md is missing a step heading');
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'the steps are out of order');
});

test('the review loop routes the CR to the coder, not to the architect', () => {
  const md = skill();
  const step4 = section(md, '## Step 4', '## Step 5');
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
  const step = md.slice(start, md.indexOf('## Step 3c'));
  assert.match(step, /advisory/i);
  assert.match(step, /neither blocks|never blocks|does not block/i);
});

test('the run is not indexed silently when the indexer is absent', () => {
  assert.match(skill(), /index-plans\.cjs/);
  assert.match(skill(), /not indexed/i);
});
